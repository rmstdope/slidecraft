/**
 * The deck parser (plan §2.3), shared by the editor, the server routes, the chat tools and the
 * MCP server. It parses with the MDX syntax tree, keeps exact source ranges, and every edit is a
 * splice of the original text: frontmatter, imports, comments, <Presentation> props and anything
 * between slides survive byte for byte.
 */
import type { Root } from 'mdast'
import type { MdxJsxFlowElement, MdxJsxTextElement } from 'mdast-util-mdx-jsx'
import remarkMdx from 'remark-mdx'
import remarkParse from 'remark-parse'
import { unified } from 'unified'
import { splitMdxFrontmatter } from './frontmatter.ts'
import { openingTagEnd } from './openingTag.ts'
import { setTagAttr } from './tagAttrs.ts'

export { openingTagEnd }

export type AttrValue = string | true | { expression: string }

export interface SlideBlock {
  index: number
  /** Offsets into the full source (frontmatter included). */
  start: number
  end: number
  /** Exact source of <Slide …>…</Slide>. */
  text: string
  /** 1-based line of the opening tag in the full source. */
  line: number
  endLine: number
  attrs: Record<string, AttrValue>
  hidden: boolean
  /** Source text inside a direct <Notes> child. */
  notes?: string
  /** Plain text of the first <Title>. */
  titleText?: string
}

export interface ParsedDeck {
  source: string
  frontmatter: string
  presentation: { start: number; end: number; attrs: Record<string, AttrValue> }
  slides: SlideBlock[]
}

export class DeckParseError extends Error {
  constructor(
    message: string,
    readonly line?: number,
    readonly column?: number,
  ) {
    super(message)
    this.name = 'DeckParseError'
  }
}

const processor = unified().use(remarkParse).use(remarkMdx)

type JsxNode = (MdxJsxFlowElement | MdxJsxTextElement) & { position: NonNullable<MdxJsxFlowElement['position']> }

const isJsx = (node: unknown, name?: string): node is JsxNode =>
  typeof node === 'object' &&
  node !== null &&
  ['mdxJsxFlowElement', 'mdxJsxTextElement'].includes((node as { type?: string }).type ?? '') &&
  (name === undefined || (node as { name?: string }).name === name)

const isBlank = (node: unknown) => (node as { type?: string }).type === 'text' && String((node as { value?: unknown }).value).trim() === ''

/**
 * Children as the MDX compiler sees them: a paragraph that holds only JSX (an element written on
 * one line, like `<Notes>…</Notes>`) is unwrapped, as @mdx-js/mdx does when it compiles.
 */
function flowChildren(node: { children?: unknown[] }): unknown[] {
  const out: unknown[] = []
  for (const child of node.children ?? []) {
    const c = child as { type?: string; children?: unknown[] }
    if (c.type === 'paragraph' && (c.children ?? []).every((k) => isJsx(k) || isBlank(k))) out.push(...(c.children ?? []).filter((k) => isJsx(k)))
    else out.push(child)
  }
  return out
}

function attrsOf(node: MdxJsxFlowElement | MdxJsxTextElement): Record<string, AttrValue> {
  const out: Record<string, AttrValue> = {}
  for (const attr of node.attributes) {
    if (attr.type !== 'mdxJsxAttribute') continue
    const value = attr.value
    out[attr.name] = value === null || value === undefined ? true : typeof value === 'string' ? value : { expression: value.value }
  }
  return out
}

function textOf(node: unknown): string {
  if (!node || typeof node !== 'object') return ''
  const n = node as { type: string; value?: unknown; children?: unknown[] }
  if (n.type === 'text' || n.type === 'inlineCode') return String(n.value ?? '')
  return (n.children ?? []).map(textOf).join('')
}

function findFirst(node: unknown, name: string): JsxNode | undefined {
  if (!node || typeof node !== 'object') return undefined
  const children = (node as { children?: unknown[] }).children ?? []
  for (const child of children) {
    const t = (child as { type?: string }).type
    if ((t === 'mdxJsxFlowElement' || t === 'mdxJsxTextElement') && (child as { name?: string }).name === name) return child as JsxNode
    const found = findFirst(child, name)
    if (found) return found
  }
  return undefined
}

export function parseDeck(source: string): ParsedDeck {
  const { frontmatter, body } = splitMdxFrontmatter(source)
  const offset = frontmatter.length
  const lineOffset = frontmatter ? frontmatter.split('\n').length - 1 : 0
  let tree: Root
  try {
    tree = processor.parse(body) as Root
  } catch (error) {
    const e = error as { reason?: string; message: string; line?: number; column?: number; place?: { line?: number; column?: number; start?: { line: number; column: number } } }
    const line = e.line ?? e.place?.start?.line ?? e.place?.line
    const column = e.column ?? e.place?.start?.column ?? e.place?.column
    throw new DeckParseError(e.reason ?? e.message, line != null ? line + lineOffset : undefined, column)
  }

  const presentation = flowChildren(tree).find((n) => isJsx(n, 'Presentation')) as JsxNode | undefined
  if (!presentation) throw new DeckParseError('Could not find a <Presentation> element')

  const lineOf = (pos: number) => source.slice(0, pos).split('\n').length
  const slides: SlideBlock[] = []
  for (const child of flowChildren(presentation)) {
    if (!isJsx(child, 'Slide')) continue
    const start = child.position.start.offset! + offset
    const end = child.position.end.offset! + offset
    const attrs = attrsOf(child)
    const notesNode = flowChildren(child).find((c) => isJsx(c, 'Notes')) as JsxNode | undefined
    let notes: string | undefined
    if (notesNode) {
      const notesText = source.slice(notesNode.position.start.offset! + offset, notesNode.position.end.offset! + offset)
      const open = openingTagEnd(notesText)
      const close = notesText.lastIndexOf('</Notes>')
      notes = open > 0 && close >= open ? notesText.slice(open, close).trim() : ''
    }
    const title = findFirst(child, 'Title')
    slides.push({
      index: slides.length,
      start,
      end,
      text: source.slice(start, end),
      line: lineOf(start),
      endLine: lineOf(end),
      attrs,
      hidden: attrs.hidden !== undefined && attrs.hidden !== 'false',
      notes,
      titleText: title ? textOf(title).trim() || undefined : undefined,
    })
  }

  return {
    source,
    frontmatter,
    presentation: { start: presentation.position.start.offset! + offset, end: presentation.position.end.offset! + offset, attrs: attrsOf(presentation) },
    slides,
  }
}

export const serializeDeck = (deck: ParsedDeck): string => deck.source

function slideAt(deck: ParsedDeck, index: number): SlideBlock {
  const slide = deck.slides[index]
  if (!slide) throw new RangeError(`Slide index ${index} out of range (0-${deck.slides.length - 1})`)
  return slide
}

const splice = (source: string, start: number, end: number, text: string) => source.slice(0, start) + text + source.slice(end)

export function replaceSlide(deck: ParsedDeck, index: number, text: string): string {
  const slide = slideAt(deck, index)
  return splice(deck.source, slide.start, slide.end, text.trim())
}

/** Insert before slide `index`; an index of -1 or past the end appends. */
export function insertSlide(deck: ParsedDeck, index: number, text: string): string {
  const content = text.trim()
  if (deck.slides.length === 0) {
    const open = openingTagEnd(deck.source, deck.presentation.start)
    if (open < 0) throw new DeckParseError('Malformed <Presentation> tag')
    return splice(deck.source, open, open, `\n\n${content}\n`)
  }
  if (index < 0 || index >= deck.slides.length) {
    const last = deck.slides[deck.slides.length - 1]
    return splice(deck.source, last.end, last.end, `\n\n${content}`)
  }
  const at = deck.slides[index].start
  return splice(deck.source, at, at, `${content}\n\n`)
}

export function deleteSlide(deck: ParsedDeck, index: number): string {
  const slide = slideAt(deck, index)
  const last = index === deck.slides.length - 1
  let start = slide.start
  let end = slide.end
  // Take the separating whitespace with the slide: after it, or before it when it is the last one.
  if (!last) while (end < deck.source.length && /\s/.test(deck.source[end])) end++
  else if (deck.slides.length > 1) while (start > 0 && /\s/.test(deck.source[start - 1])) start--
  return splice(deck.source, start, end, '')
}

export function moveSlide(deck: ParsedDeck, from: number, to: number): string {
  const slide = slideAt(deck, from)
  if (from === to) return deck.source
  const without = parseDeck(deleteSlide(deck, from))
  return insertSlide(without, to >= without.slides.length ? -1 : to, slide.text)
}

/** Set, replace or (with null) remove one attribute on a slide's opening tag. */
export function setSlideAttr(deck: ParsedDeck, index: number, name: string, value: AttrValue | null): string {
  const slide = slideAt(deck, index)
  return splice(deck.source, slide.start, slide.end, setTagAttr(slide.text, name, value))
}

/** Set, replace or (with null) remove one attribute on the <Presentation> tag. */
export function setPresentationAttr(deck: ParsedDeck, name: string, value: AttrValue | null): string {
  return setTagAttr(deck.source, name, value, deck.presentation.start)
}

export const setSlideHidden = (deck: ParsedDeck, index: number, hidden: boolean): string =>
  setSlideAttr(deck, index, 'hidden', hidden ? true : null)

const attrString = (value: AttrValue | undefined): string | undefined => (typeof value === 'string' ? value : undefined)

/** One line per slide: `"<title>" [scheme/accent]`, plus the frame and hidden state when set. */
export function getSlideSummary(deck: ParsedDeck): string[] {
  return deck.slides.map((slide) => {
    const scheme = attrString(slide.attrs.scheme) ?? 'dark'
    const accent = attrString(slide.attrs.accent) ?? 'yellow'
    const extras = [attrString(slide.attrs.frame) && `frame ${slide.attrs.frame}`, slide.hidden && 'hidden'].filter(Boolean)
    return `"${slide.titleText ?? '(no title)'}" [${scheme}/${accent}${extras.length ? `, ${extras.join(', ')}` : ''}]`
  })
}

/** Which slide a 1-based line of the full source falls in; -1 when it is outside every slide. */
export function findSlideAtLine(deck: ParsedDeck, line: number): { slideIndex: number; lineInSlide: number } {
  const slide = deck.slides.find((s) => line >= s.line && line <= s.endLine)
  return slide ? { slideIndex: slide.index, lineInSlide: line - slide.line + 1 } : { slideIndex: -1, lineInSlide: -1 }
}

/**
 * Which slide a 1-based line falls in, for sources that do not parse: count `<Slide` openers on
 * the lines before it (the same heuristic the spec's validator uses).
 */
export function findSlideAtLineByScan(source: string, line: number): number {
  const before = source.split('\n').slice(0, line).join('\n')
  return (before.match(/<Slide[\s>]/g) ?? []).length - 1
}

/** A minimal new deck: frontmatter-free, importing exactly the components it needs. */
export function newDeckSource(slides: string[], components: string[], presentationAttrs = ''): string {
  const imports = `import { ${[...new Set(components)].sort().join(', ')} } from '@components'`
  const body = slides.map((s) => s.trim()).join('\n\n')
  return `${imports}\n\n<Presentation${presentationAttrs ? ` ${presentationAttrs}` : ''}>\n\n${body}${body ? '\n\n' : ''}</Presentation>\n`
}
