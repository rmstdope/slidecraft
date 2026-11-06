/**
 * Single-file HTML export (Part 4 §8.2): the deck compiled on the server, every asset and
 * content-folder theme it uses as data URLs, and the prebuilt viewer, in one offline HTML file.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { compile } from '@mdx-js/mdx'
import { deckName, type DeckRef } from '../../shared/decks.ts'
import { assetKey, mimeType, PAYLOAD_ELEMENT_ID, type ExportedComponents, type ExportedFolder, type ExportedTheme, type ExportPayload } from '../../shared/exportPayload.ts'
import { stripMdxFrontmatter } from '../../shared/frontmatter.ts'
import { ASSET_IMPORT_RE, DeckImportError, resolveDeckRelative, rewriteDeckImports } from '../../shared/mdxImports.ts'
import { readAppBytes, readAppText } from './appFiles.ts'
import { resolveDeckFile, resolveDeckRefInSources, type ResolvedDeck } from './decks.ts'
import { readDeckSource } from './deckStore.ts'
import { discoverThemes, THEMES_DIR } from './themes.ts'
import { getAllComponents, getSourceProblems, sourceOfEntry } from '../../src/components/slides/defineComponent.ts'
import { getComponentTrust, getContentSource } from './contentSources.ts'
import { ensureServerComponents } from './serverRegistry.ts'
import { bundleComponent, componentFolders } from './vaultComponents.ts'
import { inlineVaultImportMap } from './vaultShims.ts'

export class ExportError extends Error {
  constructor(
    message: string,
    readonly status = 500,
  ) {
    super(message)
  }
}

const dataUrl = (file: string): string => `data:${mimeType(file)};base64,${readFileSync(file).toString('base64')}`
const PLACEHOLDER = (n: number) => `__SLIDECRAFT_ASSET_${n}__`

/** Deck-relative media paths written as string props: `src="images/a.png"`. */
const STRING_ASSET_RE = /(["'`])((?:\.\/)?[\w.-][\w./ -]*\.(?:png|jpe?g|gif|webp|avif|svg|mp4|webm|mp3|wav))\1/gi

let viewerCache: { js: string; css: string } | null = null
export const resetViewerCache = () => {
  viewerCache = null
}

/** The prebuilt viewer, with references to the app's own public images (logos) inlined. */
function loadViewer(): { js: string; css: string } {
  if (viewerCache) return viewerCache
  let js = readAppText('dist/viewer/viewer.js')
  const css = readAppText('dist/viewer/viewer.css') ?? ''
  if (!js) throw new ExportError('Export viewer not built. Run "bun run build" first.')
  js = js.replace(/([`"'])\/([\w.-]+\.(?:svg|png|jpe?g|gif|webp|avif))\1/g, (literal, quote: string, name: string) => {
    const bytes = readAppBytes(`dist/${name}`) ?? readAppBytes(`public/${name}`)
    return bytes ? `${quote}data:${mimeType(name)};base64,${bytes.toString('base64')}${quote}` : literal
  })
  viewerCache = { js, css }
  return viewerCache
}

function filesUnder(dir: string): string[] {
  const out: string[] = []
  const walk = (d: string) => {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      if (entry.name.startsWith('.')) continue
      const full = join(d, entry.name)
      if (entry.isDirectory()) walk(full)
      else out.push(full)
    }
  }
  if (existsSync(dir)) walk(dir)
  return out
}

/** Content-folder themes the deck names (on Presentation or any Slide), with what they extend. */
function exportedThemes(resolved: ResolvedDeck, source: string): ExportedTheme[] {
  const available = new Map(discoverThemes(resolved.source).map((t) => [t.id, t]))
  const wanted = new Set([...source.matchAll(/\btheme=["']([a-z0-9-]+)["']/g)].map((m) => m[1]))
  const out: ExportedTheme[] = []
  const seen = new Set<string>()
  const add = (id: string) => {
    const theme = available.get(id)
    if (!theme || seen.has(id) || !theme.raw) return
    seen.add(id)
    const dir = join(resolved.source.path, THEMES_DIR, id)
    const assets: Record<string, string> = {}
    for (const file of filesUnder(dir)) {
      if (file === join(dir, 'theme.json') || statSync(file).size > 20 * 1024 * 1024) continue
      assets[relative(dir, file).split(sep).join('/')] = dataUrl(file)
    }
    out.push({ id, source: resolved.source.id, raw: theme.raw, assets })
    const parent = (theme.raw as { extends?: unknown }).extends
    if (typeof parent === 'string') add(parent)
  }
  wanted.forEach(add)
  return out
}

const toBase64 = (text: string) => Buffer.from(text, 'utf8').toString('base64')
const escapeHtml = (text: string) => text.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)

export interface ExportOptions {
  /** Viewer code and CSS; the prebuilt `dist/viewer` files by default. */
  viewer?: { js: string; css: string }
}

/** Why a component's code is not in an export of a vault whose components may not run. */
export const NOT_TRUSTED_IN_EXPORT = "this vault's components were not allowed to run, so the export does not include them"

/** Capitalised tags in a deck: the components it names. */
const deckTags = (mdx: string) => new Set([...mdx.matchAll(/<([A-Z][\w]*)/g)].map((m) => m[1]))

/**
 * The vault component folders the deck uses (by tag, a part counting for its folder), each with
 * its bundle, or with why it has none: the vault's code may not run, or it did not compile. The
 * viewer loads and registers them as the app does, so one that fails there falls back to the
 * built-in of its name, or shows a placeholder. The server's own load of a bundle does not
 * decide: code that needs a browser (`window` at the top) fails in Bun and works in the viewer.
 */
async function exportedComponents(vault: string, mdx: string): Promise<ExportedComponents | undefined> {
  const source = getContentSource(vault)
  if (!source) return undefined
  const folders = componentFolders(source)
  if (!folders.length) return undefined
  await ensureServerComponents(vault)
  const tags = deckTags(mdx)
  const folderOf = new Map<string, string>(folders.map((f) => [f, f]))
  for (const c of getAllComponents(vault)) if (sourceOfEntry(c.registry) === vault) folderOf.set(c.registry.name, c.registry.parent ?? c.registry.name)
  const used = [...new Set([...tags].flatMap((t) => (folderOf.has(t) ? [folderOf.get(t)!] : [])))].sort()
  if (!used.length) return undefined
  const trusted = getComponentTrust(source) === 'trusted'
  const out: ExportedFolder[] = []
  for (const name of used) {
    if (!trusted) {
      out.push({ name, error: NOT_TRUSTED_IN_EXPORT })
      continue
    }
    const bundle = await bundleComponent(source, name)
    out.push(bundle.error !== undefined ? { name, error: bundle.error } : { name, code: toBase64(bundle.code) })
  }
  return { vault, folders: out }
}

/**
 * Tags the export has nothing for: not a built-in, and not a component of the vault that the
 * server knows (a part of a folder that may not run, say). The viewer gives each a placeholder;
 * a deck naming a component nobody defines would otherwise not render at all.
 */
function missingComponents(vault: string, mdx: string, components: ExportedComponents | undefined): string[] {
  const known = new Set([...getAllComponents(vault).map((c) => c.registry.name), ...getSourceProblems(vault).map((p) => p.name), ...(components?.folders.map((f) => f.name) ?? [])])
  return [...deckTags(mdx)].filter((t) => !known.has(t)).sort()
}

export async function exportDeck(ref: DeckRef, options: ExportOptions = {}): Promise<{ html: string; name: string }> {
  const name = deckName(ref)
  const resolved = resolveDeckRefInSources(ref)
  const mdx = resolved ? await readDeckSource(resolved) : null
  if (!resolved || mdx === null) throw new ExportError(`Presentation "${name}" not found`, 404)

  // 1. Compile, with imported assets as placeholders (the remark plugin is synchronous).
  const imported: string[] = []
  let code: string
  try {
    const compiled = await compile(stripMdxFrontmatter(mdx), {
      outputFormat: 'function-body',
      development: false,
      remarkPlugins: [
        [
          rewriteDeckImports,
          {
            deckName: name,
            resolveAsset: (_deck: string, asset: string) => {
              const file = resolveDeckFile(resolved, resolveDeckRelative(asset))
              if (!file || !existsSync(file)) throw new DeckImportError(`The presentation imports "${asset}" but the file does not exist`)
              imported.push(file)
              return PLACEHOLDER(imported.length - 1)
            },
          },
        ],
      ],
    })
    code = String(compiled)
  } catch (error) {
    throw new ExportError(`Could not compile "${name}": ${(error as Error).message}`)
  }
  imported.forEach((file, i) => {
    code = code.split(PLACEHOLDER(i)).join(dataUrl(file))
  })

  // 2. String props that name files in the deck folder.
  const assets: Record<string, string> = {}
  for (const match of code.matchAll(STRING_ASSET_RE)) {
    const key = assetKey(match[2], name)
    if (assets[key] || key.startsWith('data:')) continue
    let file: string | null = null
    try {
      file = resolveDeckFile(resolved, resolveDeckRelative(key))
    } catch {
      continue
    }
    if (file && existsSync(file) && statSync(file).isFile() && ASSET_IMPORT_RE.test(file)) assets[key] = dataUrl(file)
  }

  // 3. Payload and viewer in one HTML file. The payload is JSON with "<" escaped; the viewer is
  // base64, so no deck text or library code can end the script element early.
  const components = await exportedComponents(ref.source, mdx)
  const missing = missingComponents(ref.source, mdx, components)
  const payload: ExportPayload = { name, deck: ref, code: toBase64(code), assets, themes: exportedThemes(resolved, mdx), ...(components ? { components } : {}), ...(missing.length ? { missing } : {}) }
  const json = JSON.stringify(payload).replace(/</g, '\\u003c')
  const viewer = options.viewer ?? loadViewer()
  // Vault bundles import the shared packages by name: the map sends them to the viewer's own.
  const importMap = components?.folders.some((f) => f.code !== undefined) ? `<script type="importmap">${JSON.stringify(await inlineVaultImportMap())}</script>\n` : ''
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(name)}</title>
<style>${viewer.css.replace(/<\/style/gi, '<\\/style')}</style>
${importMap}</head>
<body>
<div id="root"></div>
<script type="application/json" id="${PAYLOAD_ELEMENT_ID}">${json}</script>
<script>(function(){var b=atob('${toBase64(viewer.js)}');var u=new Uint8Array(b.length);for(var i=0;i<b.length;i++)u[i]=b.charCodeAt(i);var s=document.createElement('script');s.textContent=new TextDecoder().decode(u);document.body.appendChild(s)})()</script>
</body>
</html>
`
  return { html, name }
}
