/**
 * The editor's view of a deck: the text around the slides plus one text per slide. Built once from
 * a parse; afterwards slides are edited as plain text, so a half-typed (invalid) slide never
 * breaks the model. Serializing joins everything back exactly.
 */
import { parseDeck } from './deckParser.ts'
import { openingTagEnd } from './openingTag.ts'
import { setTagAttr, tagAttrs, type TagAttrValue } from './tagAttrs.ts'

export interface ModelSlide {
  /** Stable for the editing session; new slides get new ids. */
  id: string
  text: string
}

export interface DeckModel {
  /** Everything before the first slide: frontmatter, imports, comments, the <Presentation> tag. */
  head: string
  slides: ModelSlide[]
  /** Text between slide i and slide i + 1 (`slides.length - 1` entries). */
  seps: string[]
  /** Everything after the last slide. */
  tail: string
}

let counter = 0
export const newSlideId = (): string => `slide-${++counter}`

export function modelFromSource(source: string): DeckModel {
  const deck = parseDeck(source)
  if (deck.slides.length === 0) {
    const open = openingTagEnd(source, deck.presentation.start)
    return { head: source.slice(0, open), slides: [], seps: [], tail: source.slice(open) }
  }
  const slides = deck.slides
  return {
    head: source.slice(0, slides[0].start),
    slides: slides.map((s) => ({ id: newSlideId(), text: s.text })),
    seps: slides.slice(1).map((s, i) => source.slice(slides[i].end, s.start)),
    tail: source.slice(slides[slides.length - 1].end),
  }
}

export function serializeModel(model: DeckModel): string {
  if (model.slides.length === 0) return model.head + model.tail
  let out = model.head
  model.slides.forEach((slide, i) => {
    out += slide.text
    if (i < model.seps.length) out += model.seps[i]
  })
  return out + model.tail
}

const SEP = '\n\n'

export function updateSlideText(model: DeckModel, id: string, text: string): DeckModel {
  return { ...model, slides: model.slides.map((s) => (s.id === id ? { ...s, text } : s)) }
}

/** Insert after the slide with `afterId` (or append); returns the model and the new slide's id. */
export function insertSlideText(model: DeckModel, text: string, afterId?: string): { model: DeckModel; id: string } {
  const id = newSlideId()
  const slide = { id, text: text.trim() }
  if (model.slides.length === 0) {
    return { id, model: { head: `${model.head}${SEP}`, slides: [slide], seps: [], tail: model.tail.startsWith('\n') ? model.tail : `${SEP}${model.tail}` } }
  }
  const after = afterId ? model.slides.findIndex((s) => s.id === afterId) : -1
  const at = after < 0 ? model.slides.length : after + 1
  const slides = [...model.slides.slice(0, at), slide, ...model.slides.slice(at)]
  const seps = [...model.seps]
  seps.splice(at === model.slides.length ? seps.length : at, 0, SEP)
  return { id, model: { ...model, slides, seps } }
}

export function removeSlide(model: DeckModel, id: string): DeckModel {
  const index = model.slides.findIndex((s) => s.id === id)
  if (index < 0) return model
  const slides = model.slides.filter((s) => s.id !== id)
  const seps = [...model.seps]
  // Take the separator after the slide, or the one before when it is the last slide.
  if (seps.length) seps.splice(index < seps.length ? index : index - 1, 1)
  return { ...model, slides, seps }
}

/** Reorder slides; separators stay where they are, so the file's spacing is kept. */
export function moveSlideInModel(model: DeckModel, from: number, to: number): DeckModel {
  if (from === to || from < 0 || to < 0 || from >= model.slides.length || to >= model.slides.length) return model
  const slides = [...model.slides]
  const [moved] = slides.splice(from, 1)
  slides.splice(to, 0, moved)
  return { ...model, slides }
}

export const slideAttrs = (text: string): Record<string, TagAttrValue> => tagAttrs(text)

export const isSlideTextHidden = (text: string): boolean => {
  const hidden = slideAttrs(text).hidden
  return hidden !== undefined && hidden !== 'false'
}

export const setSlideTextAttr = (text: string, name: string, value: TagAttrValue | null): string => setTagAttr(text, name, value)

/** The <Presentation> tag's attributes and edits (the deck theme lives there). */
export function presentationAttrs(model: DeckModel): Record<string, TagAttrValue> {
  const at = model.head.search(/<Presentation[\s>]/)
  return at < 0 ? {} : tagAttrs(model.head, at)
}

export function setPresentationTextAttr(model: DeckModel, name: string, value: TagAttrValue | null): DeckModel {
  const at = model.head.search(/<Presentation[\s>]/)
  return at < 0 ? model : { ...model, head: setTagAttr(model.head, name, value, at) }
}

/** The deck's import block (frontmatter excluded), for compiling single slides with their images. */
export function importBlock(model: DeckModel): string {
  const at = model.head.search(/<Presentation[\s>]/)
  const before = at < 0 ? model.head : model.head.slice(0, at)
  return before.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '')
}

/** Plain text of the first <Title> and <Subtitle> in a slide, for the rail. */
export function slideDescription(text: string): { title: string; subtitle?: string } {
  const plain = (s: string | undefined) => s?.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
  const title = plain(/<Title[^>]*>([\s\S]*?)<\/Title>/.exec(text)?.[1])
  const subtitle = plain(/<Subtitle[^>]*>([\s\S]*?)<\/Subtitle>/.exec(text)?.[1])
  return { title: title || 'Slide', subtitle: subtitle || undefined }
}

const COMPONENTS_IMPORT = /import\s*\{([^}]*)\}\s*from\s*(['"])@components\2/

/**
 * Adds the known components a deck uses but does not import to its `@components` import, so the
 * file stays self-describing after the editor inserted something new. Never removes names.
 */
export function syncComponentImports(model: DeckModel, known: readonly string[]): DeckModel {
  const knownSet = new Set(known)
  const match = COMPONENTS_IMPORT.exec(model.head)
  const imported = new Set(
    (match?.[1] ?? '')
      .split(',')
      .map((n) => n.trim().split(/\s+as\s+/).pop()!)
      .filter(Boolean),
  )
  const body = serializeModel(match ? { ...model, head: model.head.replace(match[0], '') } : model)
  const missing = [...new Set([...body.matchAll(/<([A-Z][A-Za-z0-9]*)/g)].map((m) => m[1]))]
    .filter((n) => knownSet.has(n) && !imported.has(n))
    .sort()
  if (missing.length === 0) return model
  if (!match) {
    const front = /^---\r?\n[\s\S]*?\r?\n---\r?\n?/.exec(model.head)?.[0] ?? ''
    return { ...model, head: `${front}import { ${missing.join(', ')} } from '@components'\n\n${model.head.slice(front.length)}` }
  }
  const inner = match[1]
  let next: string
  if (inner.includes('\n')) {
    const indent = /\n([ \t]+)\S/.exec(inner)?.[1] ?? '  '
    const kept = inner.replace(/\s*$/, '')
    next = `${kept}${kept.endsWith(',') ? '' : ','}\n${indent}${missing.join(', ')},\n`
  } else {
    const kept = inner.trim().replace(/,$/, '')
    next = ` ${kept ? `${kept}, ` : ''}${missing.join(', ')} `
  }
  return { ...model, head: model.head.replace(match[0], match[0].replace(`{${inner}}`, `{${next}}`)) }
}
