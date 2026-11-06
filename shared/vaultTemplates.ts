/**
 * Vault templates (vault components plan, V3): `templates/<id>/index.mdx` in a vault. The file is
 * frontmatter (`name`, `description`, `keywords`, `useCases`, optional `theme`) and one
 * `<Slide>…</Slide>`, used as both the snippet and the preview. Templates are text, so they load
 * whether or not the vault's components may run. The same parser runs in the app, on the server
 * and in the static site.
 */
import { splitMdxFrontmatter } from './frontmatter.ts'

export const TEMPLATES_DIR = 'templates'
export const TEMPLATE_ENTRY = 'index.mdx'

/** A template folder's name: lower-case words joined by dashes. */
export const TEMPLATE_ID_RE = /^[a-z0-9][a-z0-9-]*$/

/** A template file as the server lists it. */
export interface VaultTemplateFile {
  id: string
  text: string
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

/**
 * The small part of YAML a template's frontmatter uses: `key: value`, `key: [a, b]`, and lists of
 * `- item` lines under a key. Anything else is ignored.
 */
export function parseTemplateFrontmatter(frontmatter: string): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {}
  let listKey: string | null = null
  for (const raw of frontmatter.split(/\r?\n/)) {
    const line = raw.replace(/\s+#.*$/, '')
    if (line.trim() === '---' || line.trim() === '') continue
    const item = /^\s+-\s+(.*)$/.exec(line) ?? /^-\s+(.*)$/.exec(line)
    if (item && listKey) {
      ;(out[listKey] as string[]).push(unquote(item[1]))
      continue
    }
    const pair = /^([A-Za-z][\w]*)\s*:\s*(.*)$/.exec(line)
    if (!pair) continue
    const [, key, value] = pair
    listKey = null
    if (value.trim() === '') {
      out[key] = []
      listKey = key
    } else if (value.trim().startsWith('[') && value.trim().endsWith(']')) {
      const inner = value.trim().slice(1, -1).trim()
      out[key] = inner ? inner.split(',').map(unquote).filter(Boolean) : []
    } else out[key] = unquote(value)
  }
  return out
}

const list = (v: string | string[] | undefined): string[] => (Array.isArray(v) ? v : typeof v === 'string' && v ? [v] : [])

/** One template file into a registry entry, or the reason it cannot be one. */
export function parseVaultTemplate(file: VaultTemplateFile): TemplateParse {
  const { frontmatter, body } = splitMdxFrontmatter(file.text)
  const meta = parseTemplateFrontmatter(frontmatter)
  const name = typeof meta.name === 'string' && meta.name.trim() ? meta.name.trim() : file.id
  const fail = (error: string): TemplateParse => ({ error, name })
  if (!frontmatter) return fail('templates/' + file.id + '/index.mdx needs frontmatter with at least a name and a description')
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
