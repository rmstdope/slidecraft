/**
 * Copying a built-in into a vault (vault components plan, V5). A built-in component is copyable
 * when every import in its file is one of the shared packages or something the `slidecraft`
 * module offers; `bun run skills` works that out and writes `builtinCopies.json`. The copy is the
 * built-in's file with each app import pointed at `slidecraft`, and a `.slidecraft-origin.json`
 * beside it records what it was copied from, so the gallery can compare it and reset it.
 */
import type { RegistryConfig } from '../src/components/slides/defineComponent.ts'

/** What `bun run skills` records for each top-level built-in component. */
export type BuiltinCopyEntry = { file: string; parts: string[]; reason?: undefined } | { reason: string; file?: undefined; parts?: undefined }

export interface BuiltinCopiesManifest {
  components: Record<string, BuiltinCopyEntry>
}

/** Where a built-in's source lives in the checkout (and in the release binary's embedded files). */
export const BUILTIN_SOURCE_DIR = 'src/components/slides'

export const ORIGIN_FILE = '.slidecraft-origin.json'

/** `components/<Name>/.slidecraft-origin.json` or `templates/<id>/.slidecraft-origin.json`. */
export interface ComponentOrigin {
  kind: 'component' | 'template'
  /** The built-in's registry name. */
  builtin: string
  /** The app version that made the copy. */
  appVersion: string
  /** A hash of the built-in's source when it was copied; a different one now means the app changed it. */
  hash: string
  copiedAt: string
}

/** What the listing says about a vault entry that was copied from a built-in. */
export interface OriginInfo {
  builtin: string
  appVersion: string
  copiedAt: string
  /** The app's built-in is no longer what was copied. */
  changed: boolean
}

export type EntryKind = ComponentOrigin['kind']

/** What the copy dialog shows before anything is written. */
export interface CopyPlan {
  kind: EntryKind
  /** The built-in's registry name. */
  name: string
  /** `components/<Name>` or `templates/<id>`. */
  folder: string
  copyable: boolean
  reason?: string
  /** The parts copied with the component (`TimelineItem`). */
  parts: string[]
  /** The vault's decks that use it, which will use the copy. */
  decks: number
  /** The folder is there already. */
  exists: boolean
  /** Why the copy cannot be written in this vault now (the folder or the name is taken). */
  conflict?: string
}

/** The packages vault code may import as they are. */
export const SHARED_PACKAGES: readonly string[] = ['react', 'react/jsx-runtime', 'motion/react']

/** Built-ins every deck is made of: replacing them would change how decks are read. */
export const STRUCTURAL_BUILTINS: readonly string[] = ['Presentation', 'Slide', 'Notes', 'Step']

export interface ParsedImport {
  /** Where the declaration starts and ends in the source. */
  start: number
  end: number
  /** Where the module specifier's text (inside the quotes) starts and ends. */
  specStart: number
  specEnd: number
  spec: string
  typeOnly: boolean
  sideEffect: boolean
  defaultName?: string
  namespace?: string
  named: { name: string; type: boolean }[]
}

const IMPORT_RE = /^import\s+(?:(type)\s+)?([^'";]*?)\s*from\s*(['"])([^'"\n]+)\3;?|^import\s*(['"])([^'"\n]+)\5;?/gm

/** The top-level `import` declarations of a module, enough to tell where each name comes from. */
export function parseImports(source: string): ParsedImport[] {
  const out: ParsedImport[] = []
  for (const m of source.matchAll(IMPORT_RE)) {
    const start = m.index
    const end = start + m[0].length
    if (m[6] !== undefined) {
      const specStart = start + m[0].indexOf(m[6])
      out.push({ start, end, specStart, specEnd: specStart + m[6].length, spec: m[6], typeOnly: false, sideEffect: true, named: [] })
      continue
    }
    const typeOnly = m[1] === 'type'
    const clause = m[2].trim()
    const quoteAt = m[0].lastIndexOf(m[3] + m[4] + m[3])
    const specStart = start + quoteAt + 1
    const entry: ParsedImport = { start, end, specStart, specEnd: specStart + m[4].length, spec: m[4], typeOnly, sideEffect: false, named: [] }
    const braces = /\{([\s\S]*)\}/.exec(clause)
    const head = (braces ? clause.slice(0, braces.index) : clause).replace(/,\s*$/, '').trim()
    const ns = /^\*\s+as\s+(\w+)$/.exec(head)
    if (ns) entry.namespace = ns[1]
    else if (head) entry.defaultName = head
    if (braces) {
      for (const raw of braces[1].split(',')) {
        const part = raw.trim()
        if (!part) continue
        const typed = /^type\s+/.test(part)
        const name = part.replace(/^type\s+/, '').split(/\s+as\s+/)[0].trim()
        entry.named.push({ name, type: typeOnly || typed })
      }
    }
    out.push(entry)
  }
  return out
}

const isRelative = (spec: string) => spec.startsWith('./') || spec.startsWith('../')

/**
 * The vault copy of a copyable built-in's file: every app import (the relative ones; the
 * manifest says each resolves to the `slidecraft` module) now imports `slidecraft`.
 */
export function copySource(builtinSource: string, name: string, appVersion: string): string {
  let out = ''
  let at = 0
  for (const imp of parseImports(builtinSource)) {
    if (!isRelative(imp.spec)) continue
    out += builtinSource.slice(at, imp.specStart) + 'slidecraft'
    at = imp.specEnd
  }
  out += builtinSource.slice(at)
  return `// Copied from Slidecraft's built-in ${name} (app ${appVersion}). In this vault it replaces the built-in.\n${out}`
}

/** A short hash of a text, the same in the browser and on the server (FNV-1a, 64 bits). */
export function textHash(text: string): string {
  let h = 0xcbf29ce484222325n
  for (let i = 0; i < text.length; i++) {
    h ^= BigInt(text.charCodeAt(i))
    h = (h * 0x100000001b3n) & 0xffffffffffffffffn
  }
  return h.toString(16).padStart(16, '0')
}

/** A built-in template's folder name: its id without the `template-` prefix. */
export const templateFolderOf = (template: Pick<RegistryConfig, 'id'>): string => template.id.replace(/^template-/, '')

/** Plain when the frontmatter parser reads it back unchanged, else quoted (it has no escapes). */
const yamlValue = (s: string) => (/^[\w .,()'-]+$/.test(s) && !/^['"\-[{]/.test(s) && !s.includes(',') ? s : s.includes('"') ? `'${s}'` : `"${s}"`)

/** A built-in template as a vault template file (`templates/<id>/index.mdx`). */
export function templateCopyText(template: RegistryConfig): string {
  const theme = /^<Presentation theme="([^"]+)">/.exec(template.previewCode)?.[1]
  const lines = ['---', `name: ${yamlValue(template.name)}`, `description: ${yamlValue(template.description)}`]
  if (template.keywords?.length) lines.push(`keywords: [${template.keywords.map(yamlValue).join(', ')}]`)
  if (template.useCases?.length) lines.push('useCases:', ...template.useCases.map((u) => `  - ${yamlValue(u)}`))
  if (theme) lines.push(`theme: ${theme}`)
  lines.push('---')
  return `${lines.join('\n')}\n${template.snippet.trim()}\n`
}
