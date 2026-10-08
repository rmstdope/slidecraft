/**
 * Completion, diagnostics, hover and quick fixes over plain text (Part 3 §5.4–5.7), driven by the
 * component registry. Positions are 0-based; the Monaco adapter converts them.
 */
import { scanTag } from '@shared/tagAttrs.ts'
import { cursorTarget } from './context'
import { formatPropType, propValues } from './registry'
import { closest, lineStarts, maskNonMarkup, offsetAt, positionAt, rangeOf } from './text'
import type { CodeAction, CompletionItem, ComponentInfo, Diagnostic, Hover, LanguageServiceData, Position, PropInfo } from './types'

/** Raw HTML elements and the components to use instead (Part 3 §5.5). */
export const HTML_SUGGESTIONS: Record<string, { suggestion: string; replace?: string }> = {
  div: { suggestion: 'Stack or TwoColumn', replace: 'Stack' },
  section: { suggestion: 'Slide', replace: 'Slide' },
  article: { suggestion: 'Card', replace: 'Card' },
  aside: { suggestion: 'Card', replace: 'Card' },
  p: { suggestion: 'Text', replace: 'Text' },
  span: { suggestion: 'Text or Accent', replace: 'Text' },
  h1: { suggestion: 'Title', replace: 'Title' },
  h2: { suggestion: 'Title or Subtitle', replace: 'Subtitle' },
  h3: { suggestion: 'Subtitle', replace: 'Subtitle' },
  h4: { suggestion: 'Subtitle', replace: 'Subtitle' },
  h5: { suggestion: 'Subtitle', replace: 'Subtitle' },
  h6: { suggestion: 'Subtitle', replace: 'Subtitle' },
  blockquote: { suggestion: 'Quote', replace: 'Quote' },
  ul: { suggestion: 'List', replace: 'List' },
  ol: { suggestion: 'List ordered', replace: 'List' },
  li: { suggestion: 'ListItem', replace: 'ListItem' },
  img: { suggestion: 'ContentImage', replace: 'ContentImage' },
  figure: { suggestion: 'ContentImage', replace: 'ContentImage' },
  figcaption: { suggestion: 'Caption', replace: 'Caption' },
  br: { suggestion: 'separate Text elements or a Stack' },
  strong: { suggestion: 'Accent or Highlight', replace: 'Highlight' },
  b: { suggestion: 'Accent or Highlight', replace: 'Highlight' },
  em: { suggestion: 'Accent', replace: 'Accent' },
  i: { suggestion: 'Accent', replace: 'Accent' },
  code: { suggestion: 'Code', replace: 'Code' },
  pre: { suggestion: 'Code', replace: 'Code' },
  table: { suggestion: 'ComparisonTable' },
  tr: { suggestion: 'ComparisonTable rows' },
  td: { suggestion: 'ComparisonTable rows' },
  th: { suggestion: 'ComparisonTable headers' },
}

const SVG_TAGS = new Set(['svg', 'path', 'circle', 'rect', 'line', 'polygon', 'polyline', 'g', 'defs', 'clippath', 'mask', 'use', 'symbol', 'text', 'tspan', 'ellipse', 'lineargradient', 'stop'])

/** Props every component accepts without declaring them. */
const IMPLICIT_PROPS = new Set(['key', 'className', 'style', 'children', 'id'])

export interface LanguageService {
  components: ComponentInfo[]
  component(name: string): ComponentInfo | undefined
  completions(text: string, position: Position): CompletionItem[]
  diagnostics(text: string): Diagnostic[]
  hover(text: string, position: Position): Hover | null
  codeActions(text: string, diagnostics: Diagnostic[]): CodeAction[]
}

function propDocs(c: ComponentInfo): string {
  const props = c.props.map((p) => `- \`${p.name}\`: \`${formatPropType(p.type, p.rawType)}\`${p.defaultValue ? ` = ${p.defaultValue}` : ''}${p.description ? ` — ${p.description}` : ''}`)
  return [c.description, props.length ? `\n**Props:**\n${props.join('\n')}` : '', c.useCases.length ? `\n**Use cases:** ${c.useCases.slice(0, 3).join('; ')}` : ''].join('\n')
}

function propSnippet(p: PropInfo): string {
  switch (p.type.kind) {
    case 'boolean':
      return p.name
    case 'union':
      return `${p.name}="\${1:${p.type.values[0]}}"$0`
    case 'string':
      return `${p.name}="$1"$0`
    case 'number':
      return `${p.name}={\${1:${p.defaultValue ?? 0}}}$0`
    default:
      return `${p.name}={$1}$0`
  }
}

export function createLanguageService(data: LanguageServiceData): LanguageService {
  const byName = new Map(data.components.map((c) => [c.name, c]))
  const names = data.components.map((c) => c.name)
  const valuesFor = (component: string, prop: string) => data.dynamicValues?.(component, prop) ?? propValues(byName.get(component), prop, data.toolbar(component))

  function completions(text: string, position: Position): CompletionItem[] {
    const starts = lineStarts(text)
    const offset = offsetAt(text, position, starts)
    const target = cursorTarget(text, offset)
    const range = (start: number) => rangeOf(start, offset, starts)

    if (target.kind === 'component-name') {
      return data.components
        .filter((c) => c.name.toLowerCase().startsWith(target.partial.toLowerCase()))
        .map((c) => ({
          label: c.name,
          kind: 'component',
          detail: c.description,
          documentation: propDocs(c),
          insertText: c.hasChildren ? `${c.name}>\n  $0\n</${c.name}>` : `${c.name} $0/>`,
          format: 'snippet',
          range: range(target.start),
        }))
    }
    if (target.kind === 'prop-name') {
      const c = byName.get(target.component)
      if (!c) return []
      return c.props
        .filter((p) => !target.present.includes(p.name) && p.name.toLowerCase().startsWith(target.partial.toLowerCase()))
        .map((p, i) => ({
          label: p.name,
          kind: 'property',
          detail: formatPropType(p.type, p.rawType),
          documentation: p.description,
          insertText: propSnippet(p),
          format: 'snippet',
          sortText: String(i).padStart(3, '0'),
          range: range(offset - target.partial.length),
        }))
    }
    if (target.kind === 'prop-value') {
      const values = valuesFor(target.component, target.prop) ?? []
      return values
        .filter((v) => v.toLowerCase().startsWith(target.partial.toLowerCase()))
        .map((v, i) => ({ label: v, kind: 'value', insertText: v, format: 'plain', sortText: String(i).padStart(3, '0'), range: range(target.start) }))
    }
    if (target.kind === 'closing-tag' && target.open && target.open.toLowerCase().startsWith(target.partial.toLowerCase())) {
      // An auto-closed `>` right after the cursor is replaced too.
      const end = text[offset] === '>' ? offset + 1 : offset
      return [{ label: `/${target.open}>`, kind: 'closing-tag', insertText: `${target.open}>`, format: 'plain', sortText: '0000', range: rangeOf(target.start, end, starts) }]
    }
    return []
  }

  function diagnostics(text: string): Diagnostic[] {
    const masked = maskNonMarkup(text)
    const starts = lineStarts(text)
    const out: Diagnostic[] = []
    const tagRe = /<([A-Za-z][\w.-]*)/g
    let m: RegExpExecArray | null
    while ((m = tagRe.exec(masked))) {
      const name = m[1]
      const nameStart = m.index + 1
      const nameRange = rangeOf(nameStart, nameStart + name.length, starts)
      if (/^[a-z]/.test(name)) {
        const lower = name.toLowerCase()
        const suggestion = HTML_SUGGESTIONS[lower]
        if (!suggestion || SVG_TAGS.has(lower)) continue
        out.push({
          range: nameRange,
          message: `Raw HTML element <${name}> detected. Use ${suggestion.suggestion} instead.`,
          severity: 'warning',
          code: 'raw-html-element',
          source: 'slidecraft',
          data: { htmlElement: lower, suggestedComponent: suggestion.replace },
        })
        continue
      }
      const component = byName.get(name)
      if (!component) {
        const guess = closest(name, names)
        out.push({
          range: nameRange,
          message: `Unknown component <${name}>.${guess ? ` Did you mean <${guess}>?` : ' See the component reference (Help) for what exists.'}`,
          severity: 'error',
          code: 'unknown-component',
          source: 'slidecraft',
          data: { name, suggestion: guess },
        })
        continue
      }
      const tag = scanTag(text, m.index)
      if (!tag) continue
      for (const attr of tag.attrs) {
        const attrRange = rangeOf(attr.start, attr.end, starts)
        const prop = component.props.find((p) => p.name === attr.name)
        if (!prop) {
          if (!IMPLICIT_PROPS.has(attr.name) && !attr.name.startsWith('_') && !attr.name.startsWith('data-') && !attr.name.startsWith('aria-')) {
            out.push({ range: attrRange, message: `<${name}> has no prop "${attr.name}".`, severity: 'info', code: 'unknown-prop', source: 'slidecraft', data: { component: name, prop: attr.name } })
          }
          continue
        }
        if (typeof attr.value !== 'string') continue
        const allowed = valuesFor(name, attr.name)
        if (allowed && !allowed.includes(attr.value) && !(prop.type.kind === 'boolean')) {
          out.push({
            range: attrRange,
            message: `${attr.name}="${attr.value}" is not valid for <${name}>. Use one of: ${allowed.join(', ')}.`,
            severity: 'warning',
            code: 'invalid-prop-value',
            source: 'slidecraft',
            data: { component: name, prop: attr.name, value: attr.value, allowed, valueStart: attr.start, valueEnd: attr.end },
          })
        }
      }
    }
    return out
  }

  function hover(text: string, position: Position): Hover | null {
    const starts = lineStarts(text)
    const offset = offsetAt(text, position, starts)
    const re = /<\/?([A-Z][\w.]*)/g
    let m: RegExpExecArray | null
    while ((m = re.exec(text))) {
      const nameStart = m.index + m[0].length - m[1].length
      const nameEnd = nameStart + m[1].length
      const c = byName.get(m[1])
      if (offset >= nameStart && offset <= nameEnd && c) return { contents: `**${c.name}**\n\n${propDocs(c)}`, range: rangeOf(nameStart, nameEnd, starts) }
      if (m[0][1] === '/' || !c || offset < nameEnd) continue
      const tag = scanTag(text, m.index)
      if (!tag || offset > tag.end) continue
      const attr = tag.attrs.find((a) => offset >= a.start && offset <= a.start + a.name.length)
      const prop = attr && c.props.find((p) => p.name === attr.name)
      if (attr && prop) {
        const options = prop.type.kind === 'union' ? `\n\n**Options:** ${prop.type.values.map((v) => `\`${v}\``).join(', ')}` : ''
        return {
          contents: `**${c.name}.${prop.name}**\n\nType: \`${formatPropType(prop.type, prop.rawType)}\`${prop.defaultValue ? `\n\nDefault: \`${prop.defaultValue}\`` : ''}${prop.required ? '\n\n*Required*' : ''}${prop.description ? `\n\n${prop.description}` : ''}${options}`,
          range: rangeOf(attr.start, attr.start + attr.name.length, starts),
        }
      }
    }
    return null
  }

  function codeActions(text: string, found: Diagnostic[]): CodeAction[] {
    const starts = lineStarts(text)
    const actions: CodeAction[] = []
    for (const d of found) {
      if (d.code === 'raw-html-element' && typeof d.data?.suggestedComponent === 'string') {
        const tag = d.data.htmlElement as string
        const replacement = d.data.suggestedComponent
        const nameStart = offsetAt(text, d.range.start, starts)
        const openStart = nameStart - 1
        const scanned = scanTag(text, openStart)
        const edits = [{ range: d.range, newText: replacement }]
        if (scanned && !scanned.selfClosing) {
          const close = text.indexOf(`</${tag}>`, scanned.end)
          if (close >= 0) edits.push({ range: rangeOf(close + 2, close + 2 + tag.length, starts), newText: replacement })
        }
        actions.push({ title: `Replace <${tag}> with <${replacement}>`, edits, isPreferred: true, diagnostic: d })
      }
      if (d.code === 'unknown-component' && typeof d.data?.suggestion === 'string') {
        const name = d.data.name as string
        const guess = d.data.suggestion
        const nameStart = offsetAt(text, d.range.start, starts)
        const edits = [{ range: d.range, newText: guess }]
        const close = text.indexOf(`</${name}>`, nameStart)
        if (close >= 0) edits.push({ range: rangeOf(close + 2, close + 2 + name.length, starts), newText: guess })
        actions.push({ title: `Change to <${guess}>`, edits, isPreferred: true, diagnostic: d })
      }
      if (d.code === 'invalid-prop-value' && Array.isArray(d.data?.allowed)) {
        const valueStart = d.data.valueStart as number
        const valueEnd = d.data.valueEnd as number
        for (const value of (d.data.allowed as string[]).slice(0, 5)) {
          actions.push({ title: `Use ${d.data.prop}="${value}"`, edits: [{ range: rangeOf(valueStart, valueEnd, starts), newText: `${d.data.prop}="${value}"` }], diagnostic: d })
        }
      }
    }
    return actions
  }

  return { components: data.components, component: (name) => byName.get(name), completions, diagnostics, hover, codeActions }
}

export { positionAt }
