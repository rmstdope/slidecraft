/**
 * Vault templates (vault components plan, V3): `templates/<id>/index.mdx` in a vault. The file is
 * frontmatter (`name`, `description`, `keywords`, `useCases`, optional `theme`) and one
 * `<Slide>…</Slide>`, used as both the snippet and the preview. Templates are text, so they load
 * whether or not the vault's components may run. The same parser runs in the app, on the server
 * and in the static site.
 */
import type { OriginInfo } from './builtinCopies.ts'
import { splitMdxFrontmatter } from './frontmatter.ts'

export const TEMPLATES_DIR = 'templates'
export const TEMPLATE_ENTRY = 'index.mdx'

/** A template folder's name: lower-case words joined by dashes. */
export const TEMPLATE_ID_RE = /^[a-z0-9][a-z0-9-]*$/

/** A template file as the server lists it. */
export interface VaultTemplateFile {
  id: string
  text: string
  /** It was copied from a built-in (V5). */
  origin?: OriginInfo
}

export interface ParsedTemplate {
  /** The registry id: `template-<folder>`, like the built-ins. */
  id: string
  name: string
  description: string
  keywords: string[]
  useCases: string[]
  snippet: string
  previewCode: string
}

export type TemplateParse = { template: ParsedTemplate; error?: undefined } | { template?: undefined; error: string; name: string }

const unquote = (value: string): string => {
  const v = value.trim()
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) return v.slice(1, -1)
  return v
}

/** Splits on `separator` outside quotes, or cuts at a ` #` comment outside quotes. */
function scan(text: string, at: (char: string, i: number) => boolean): number[] {
  const hits: number[] = []
  let quote: string | null = null
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quote) {
      if (c === quote) quote = null
    } else if (c === '"' || c === "'") quote = c
    else if (at(c, i)) hits.push(i)
  }
  return hits
}

const stripComment = (line: string): string => {
  const at = scan(line, (c, i) => c === '#' && (i === 0 || /\s/.test(line[i - 1])))[0]
  return at === undefined ? line : line.slice(0, at)
}

function splitFlow(inner: string): string[] {
  const out: string[] = []
  let from = 0
  for (const at of [...scan(inner, (c) => c === ','), inner.length]) {
    const part = unquote(inner.slice(from, at))
    if (part) out.push(part)
    from = at + 1
  }
  return out
}

export interface TemplateFrontmatter {
  values: Record<string, string | string[]>
  /** What the parser does not understand, said plainly instead of guessed at. */
  problems: string[]
}

/**
 * The small part of YAML a template's frontmatter uses: `key: value`, `key: [a, b]`, and lists of
 * `- item` lines under a key. Multi-line values are reported, not guessed at.
 */
export function parseTemplateFrontmatter(frontmatter: string): TemplateFrontmatter {
  const values: Record<string, string | string[]> = {}
  const problems: string[] = []
  let listKey: string | null = null
  for (const raw of frontmatter.split(/\r?\n/)) {
    const line = stripComment(raw).replace(/\s+$/, '')
    if (line.trim() === '---' || line.trim() === '') continue
    const item = /^\s*-\s+(.*)$/.exec(line)
    if (item && listKey) {
      ;(values[listKey] as string[]).push(unquote(item[1]))
      continue
    }
    const pair = /^([A-Za-z]\w*)\s*:\s*(.*)$/.exec(line)
    if (!pair) {
      problems.push(`The frontmatter line "${raw.trim()}" is not "key: value"; write each value on one line`)
      continue
    }
    const [, key, rawValue] = pair
    const value = rawValue.trim()
    listKey = null
    if (value === '') {
      values[key] = []
      listKey = key
    } else if (/^[>|][-+]?$/.test(value)) problems.push(`${key} uses a multi-line value; write it on one line`)
    else if (value.startsWith('[') && value.endsWith(']')) values[key] = splitFlow(value.slice(1, -1))
    else values[key] = unquote(value)
  }
  return { values, problems }
}

const list = (v: string | string[] | undefined): string[] => (Array.isArray(v) ? v : typeof v === 'string' && v ? [v] : [])

/** One template file into a registry entry, or the reason it cannot be one. */
export function parseVaultTemplate(file: VaultTemplateFile): TemplateParse {
  // A byte-order mark (Windows editors) and CRLF line ends are not part of the template.
  const text = file.text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n')
  const { frontmatter, body } = splitMdxFrontmatter(text)
  const { values: meta, problems } = parseTemplateFrontmatter(frontmatter)
  const name = typeof meta.name === 'string' && meta.name.trim() ? meta.name.trim() : file.id
  const fail = (error: string): TemplateParse => ({ error, name })
  if (!frontmatter) return fail('templates/' + file.id + '/index.mdx needs frontmatter with at least a name and a description')
  if (problems.length) return fail(problems.join('\n'))
  if (typeof meta.name !== 'string' || !meta.name.trim()) return fail('The frontmatter has no name')
  if (typeof meta.description !== 'string' || !meta.description.trim()) return fail('The frontmatter has no description')
  const slide = body.trim()
  const opens = slide.match(/<Slide[\s>/]/g)?.length ?? 0
  if (!slide.startsWith('<Slide') || !/<\/Slide>$/.test(slide) || opens !== 1) return fail('The body must be exactly one <Slide>…</Slide>')
  const theme = typeof meta.theme === 'string' && meta.theme.trim() ? meta.theme.trim() : undefined
  return {
    template: {
      id: `template-${file.id}`,
      name,
      description: meta.description.trim(),
      keywords: list(meta.keywords),
      useCases: list(meta.useCases),
      snippet: slide,
      // A template for a theme's frame previews inside a deck using that theme, as the built-ins do.
      previewCode: theme ? `<Presentation theme="${theme}">\n${slide}\n</Presentation>` : slide,
    },
  }
}
