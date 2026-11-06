/**
 * Vault components on the server (vault components plan, V2): find `components/<Name>/` in a
 * vault, bundle each with `Bun.build` (the four shared packages external), and keep the bundles
 * by a hash of the folder's code. The app imports the bundles through the import map; the server
 * imports them too (`serverRegistry.ts`) so the tools and checks know the vault's components.
 *
 * Nothing here runs vault code: bundling only reads it. The trust rule is applied by the callers.
 */
import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync, realpathSync, statSync } from 'node:fs'
import { join, relative, resolve, sep } from 'node:path'
import type { BunPlugin } from 'bun'
import { VAULT_MODULE_NAMES } from '../../shared/vaultRuntime.ts'
import { COMPONENT_ENTRY, COMPONENT_NAME_RE, COMPONENTS_DIR, componentBundleUrl, type ComponentTrust, type VaultComponentInfo, type VaultComponentsListing } from '../../shared/vaultComponents.ts'
import { TEMPLATE_ENTRY, TEMPLATE_ID_RE, TEMPLATES_DIR, type VaultTemplateFile } from '../../shared/vaultTemplates.ts'
import { getComponentTrust, type ContentSource } from './contentSources.ts'

const CODE_FILE = /\.(tsx?|jsx?|mjs)$/

export const componentsDir = (source: ContentSource): string => join(source.path, COMPONENTS_DIR)

/** Component folders in a vault: `components/<Name>/index.tsx`, sorted by name. */
export function componentFolders(source: ContentSource): string[] {
  const dir = componentsDir(source)
  if (!existsSync(dir)) return []
  let names: string[]
  try {
    names = readdirSync(dir)
  } catch {
    return []
  }
  return names.filter((n) => COMPONENT_NAME_RE.test(n) && existsSync(join(dir, n, COMPONENT_ENTRY))).sort()
}

/** A vault's templates: `templates/<id>/index.mdx`, sorted by id. */
export function templateFiles(source: ContentSource): VaultTemplateFile[] {
  const dir = join(source.path, TEMPLATES_DIR)
  if (!existsSync(dir)) return []
  let ids: string[]
  try {
    ids = readdirSync(dir)
  } catch {
    return []
  }
  const out: VaultTemplateFile[] = []
  for (const id of ids.filter((n) => TEMPLATE_ID_RE.test(n)).sort()) {
    try {
      out.push({ id, text: readFileSync(join(dir, id, TEMPLATE_ENTRY), 'utf8') })
    } catch {
      /* a folder without index.mdx is not a template */
    }
  }
  return out
}

function codeFiles(dir: string): string[] {
  const out: string[] = []
  const walk = (d: string) => {
    let entries: string[]
    try {
      entries = readdirSync(d)
    } catch {
      return
    }
    for (const name of entries.sort()) {
      if (name.startsWith('.') || name === 'node_modules') continue
      const path = join(d, name)
      let stat
      try {
        stat = statSync(path)
      } catch {
        continue
      }
      if (stat.isDirectory()) walk(path)
      else if (CODE_FILE.test(name)) out.push(path)
    }
  }
  walk(dir)
  return out
}

/** A hash of every code file in a component folder (paths and contents). */
export function folderHash(dir: string): string {
  const h = createHash('sha256')
  for (const file of codeFiles(dir)) {
    h.update(relative(dir, file).split(sep).join('/'))
    h.update('\0')
    try {
      h.update(readFileSync(file))
    } catch {
      /* removed while hashing; the next look sees it */
    }
    h.update('\0')
  }
  return h.digest('hex').slice(0, 16)
}

/**
 * What changed on disk, cheaply: every code file's path, size and mtime in a vault's
 * `components/`, and its templates' text. The watcher compares it on each poll (macOS directory watchers miss edits).
 */
export function componentsSignature(source: ContentSource): string {
  const parts: string[] = []
  const dir = componentsDir(source)
  if (existsSync(dir)) {
    for (const file of codeFiles(dir)) {
      try {
        const s = statSync(file)
        parts.push(`${relative(dir, file)}:${s.size}:${s.mtimeMs}`)
      } catch {
        /* gone */
      }
    }
  }
  // Templates (V3) reload the same way.
  for (const t of templateFiles(source)) parts.push(`${TEMPLATES_DIR}/${t.id}:${t.text.length}:${t.text}`)
  return parts.join('|')
}

/** Vault code may import the shared packages and files in its own folder, nothing else. */
/** The folder's real path: the bundler reports real paths, and the folder may sit behind a symlink. */
function realFolder(folder: string): string {
  try {
    return realpathSync(folder)
  } catch {
    return resolve(folder)
  }
}

function importGuard(folder: string): BunPlugin {
  const roots = [...new Set([resolve(folder), realFolder(folder)])]
  const allowed = new Set<string>(VAULT_MODULE_NAMES)
  return {
    name: 'slidecraft:vault-imports',
    setup(build) {
      build.onResolve({ filter: /.*/ }, (args) => {
        if (allowed.has(args.path)) return { path: args.path, external: true }
        if ((args.kind as string).startsWith('entry-point')) return undefined
        if (args.path.startsWith('./') || args.path.startsWith('../')) {
          const target = resolve(args.resolveDir, args.path)
          if (roots.some((root) => target === root || target.startsWith(root + sep))) return undefined
          throw new Error(`"${args.path}" is outside the component's folder; a component may import only files in its own folder`)
        }
        throw new Error(`"${args.path}" cannot be imported; a vault component may import only ${VAULT_MODULE_NAMES.map((n) => `'${n}'`).join(', ')} and files in its own folder`)
      })
    },
  }
}

/**
 * An import with attributes (`with { … }` or `assert { … }`, comments allowed in between). Bun
 * runs `type: 'macro'` imports while it bundles, which would run vault code on the server whatever
 * the trust, and macro imports skip the import rule. Vault code has no use for attributes at all.
 */
const IMPORT_ATTRIBUTES = /['"`]\s*(?:\/\*[\s\S]*?\*\/\s*|\/\/[^\n]*\n\s*)*(?:with|assert)\s*\{/

/** Files in a component folder that use import attributes, relative to the folder. */
function filesWithImportAttributes(folder: string): string[] {
  return codeFiles(folder).filter((file) => {
    try {
      return IMPORT_ATTRIBUTES.test(readFileSync(file, 'utf8'))
    } catch {
      return false
    }
  })
}

export type BundleResult = { hash: string; code: string; error?: undefined } | { hash: string; code?: undefined; error: string }

const bundles = new Map<string, BundleResult>()

const relativeTo = (folder: string, file: string | undefined) => (file ? relative(folder, file).split(sep).join('/') : undefined)

/** Bundle one component folder, or return the cached bundle for its current hash. */
export async function bundleComponent(source: ContentSource, name: string): Promise<BundleResult> {
  const folder = join(componentsDir(source), name)
  const hash = folderHash(folder)
  const key = `${source.path}\0${name}`
  const cached = bundles.get(key)
  if (cached?.hash === hash) return cached
  let result: BundleResult
  // Checked before Bun.build sees the code: bundling would run a macro.
  const attributed = filesWithImportAttributes(folder)
  if (attributed.length) {
    result = { hash, error: attributed.map((f) => `${relativeTo(folder, f)}: import attributes (with { … }, such as macros) are not allowed in a vault component`).join('\n') }
    bundles.set(key, result)
    return result
  }
  try {
    const out = await Bun.build({
      entrypoints: [join(folder, COMPONENT_ENTRY)],
      format: 'esm',
      target: 'browser',
      external: [...VAULT_MODULE_NAMES],
      jsx: { runtime: 'automatic', development: false },
      define: { 'process.env.NODE_ENV': '"production"' },
      plugins: [importGuard(folder)],
      throw: false,
    } as Parameters<typeof Bun.build>[0])
    // Bun heads each file's code with a comment naming its path; the bundle need not show it.
    if (out.success && out.outputs[0]) result = { hash, code: (await out.outputs[0].text()).replace(/^\/\/ .*\.(?:tsx?|jsx?|mjs)\n/gm, '') }
    else result = { hash, error: buildMessage(realFolder(folder), out.logs) }
  } catch (error) {
    result = { hash, error: buildMessage(realFolder(folder), (error as AggregateError).errors ?? [error]) }
  }
  bundles.set(key, result)
  return result
}

function buildMessage(folder: string, logs: readonly unknown[]): string {
  const lines = logs
    .filter((l) => !(l as { level?: string }).level || (l as { level?: string }).level === 'error')
    .map((l) => {
      const log = l as { message?: string; position?: { file?: string; line?: number } | null }
      const where = log.position?.file ? `${relativeTo(folder, log.position.file)}${log.position.line ? `:${log.position.line}` : ''}: ` : ''
      return `${where}${(log.message ?? String(l)).replace(/^error: /, '')}`
    })
  return lines.length ? [...new Set(lines)].join('\n') : 'The component did not compile'
}

/** The listing the app reads: every folder with its hash, and its bundle URL or error when trusted. */
export async function listVaultComponents(source: ContentSource): Promise<VaultComponentsListing> {
  const trust: ComponentTrust = getComponentTrust(source)
  const components: VaultComponentInfo[] = []
  for (const name of componentFolders(source)) {
    if (trust !== 'trusted') {
      components.push({ name, hash: folderHash(join(componentsDir(source), name)) })
      continue
    }
    const bundle = await bundleComponent(source, name)
    components.push(bundle.error !== undefined ? { name, hash: bundle.hash, error: bundle.error } : { name, hash: bundle.hash, url: componentBundleUrl(source.id, name, bundle.hash) })
  }
  return { vault: source.id, trust, components, templates: templateFiles(source) }
}

/** `GET /content-source/<vault>/components/<Name>/index.js`: the bundle, for a trusted vault only. */
export async function serveComponentBundle(source: ContentSource, name: string): Promise<Response> {
  const headers = { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'no-cache' }
  if (getComponentTrust(source) !== 'trusted') return new Response('// The components in this vault are not allowed to run.\n', { status: 403, headers })
  if (!componentFolders(source).includes(name)) return new Response('// No such component.\n', { status: 404, headers })
  const bundle = await bundleComponent(source, name)
  if (bundle.error !== undefined) return new Response(`throw new Error(${JSON.stringify(bundle.error)})\n`, { status: 500, headers })
  return new Response(bundle.code, { headers })
}
