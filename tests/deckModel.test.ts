import { describe, expect, test } from 'bun:test'
import {
  importBlock,
  insertSlideText,
  isSlideTextHidden,
  modelFromSource,
  moveSlideInModel,
  presentationAttrs,
  removeSlide,
  serializeModel,
  setPresentationTextAttr,
  setSlideTextAttr,
  slideDescription,
  updateSlideText,
  syncComponentImports,
} from '../shared/deckModel.ts'
import { parseDeck } from '../shared/deckParser.ts'
import { scanTag, setTagAttr, tagAttrs } from '../shared/tagAttrs.ts'

const DECK = `---
title: x
---
import { Slide, Title } from '@components'
import pic from './images/pic.png'

<Presentation theme="paper">

<Slide accent="teal">
  <Title>One</Title>
</Slide>

{/* between */}

<Slide>
  <Title>Two</Title>
</Slide>

</Presentation>
`

describe('tag scanner', () => {
  test('reads string, bare and expression attributes, even with > inside values', () => {
    const tag = scanTag(`<Slide a="x > y" hidden camera={{ x: 1 > 0 ? 2 : 3 }} b='q'>rest`)!
    expect(tag.name).toBe('Slide')
    expect(tag.attrs.map((a) => [a.name, a.value])).toEqual([
      ['a', 'x > y'],
      ['hidden', true],
      ['camera', { expression: '{ x: 1 > 0 ? 2 : 3 }' }],
      ['b', 'q'],
    ])
  })
  test('sets, replaces and removes attributes; works on self-closing and half-typed text', () => {
    expect(setTagAttr('<Slide accent="teal">', 'accent', 'red')).toBe('<Slide accent="red">')
    expect(setTagAttr('<Slide>', 'scheme', 'light')).toBe('<Slide scheme="light">')
    expect(setTagAttr('<Stat value="1" />', 'accent', 'red')).toBe('<Stat value="1" accent="red" />')
    expect(setTagAttr('<Slide hidden accent="x">', 'hidden', null)).toBe('<Slide accent="x">')
    expect(setTagAttr('<Slide>\n  <Title>broken</Tittle>', 'hidden', true)).toBe('<Slide hidden>\n  <Title>broken</Tittle>')
    expect(tagAttrs('<Card title="a" compact>')).toEqual({ title: 'a', compact: true })
  })
})

describe('deck model', () => {
  const model = modelFromSource(DECK)

  test('round-trips the source exactly', () => {
    expect(model.slides).toHaveLength(2)
    expect(serializeModel(model)).toBe(DECK)
  })

  test('slide edits survive invalid text and keep everything else', () => {
    const edited = updateSlideText(model, model.slides[1].id, '<Slide>\n  <Title>Half typed</Tit')
    const out = serializeModel(edited)
    expect(out).toContain('{/* between */}')
    expect(out).toContain('<Title>Half typed</Tit')
    expect(out.startsWith('---\ntitle: x\n---\n')).toBe(true)
  })

  test('insert, remove and move keep the spacing valid', () => {
    const { model: inserted, id } = insertSlideText(model, '<Slide><Title>New</Title></Slide>', model.slides[0].id)
    expect(inserted.slides.map((s) => slideDescription(s.text).title)).toEqual(['One', 'New', 'Two'])
    expect(parseDeck(serializeModel(inserted)).slides).toHaveLength(3)
    const removed = removeSlide(inserted, id)
    expect(serializeModel(removed)).toBe(DECK)
    const removedLast = removeSlide(model, model.slides[1].id)
    expect(parseDeck(serializeModel(removedLast)).slides).toHaveLength(1)
    const moved = moveSlideInModel(model, 0, 1)
    expect(moved.slides.map((s) => slideDescription(s.text).title)).toEqual(['Two', 'One'])
    expect(serializeModel(moved)).toContain('{/* between */}')
  })

  test('inserting into an empty deck', () => {
    const empty = modelFromSource('<Presentation>\n</Presentation>\n')
    const { model: one } = insertSlideText(empty, '<Slide><Title>First</Title></Slide>')
    expect(parseDeck(serializeModel(one)).slides[0].titleText).toBe('First')
  })

  test('hidden flag, presentation theme and the import block', () => {
    const hidden = setSlideTextAttr(model.slides[0].text, 'hidden', true)
    expect(isSlideTextHidden(hidden)).toBe(true)
    expect(isSlideTextHidden(setSlideTextAttr(hidden, 'hidden', null))).toBe(false)
    expect(presentationAttrs(model)).toEqual({ theme: 'paper' })
    expect(presentationAttrs(setPresentationTextAttr(model, 'theme', 'folio'))).toEqual({ theme: 'folio' })
    expect(importBlock(model).trim()).toBe("import { Slide, Title } from '@components'\nimport pic from './images/pic.png'")
  })
})

describe('syncComponentImports', () => {
  const known = ['Presentation', 'Slide', 'Title', 'List', 'ListItem', 'Stat']
  const deck = (imports: string, body: string) => `---\ntitle: T\n---\n${imports}\n\n<Presentation>\n\n${body}\n\n</Presentation>\n`

  test('adds missing names to a one-line import', () => {
    const m = modelFromSource(deck("import { Presentation, Slide, Title } from '@components'", '<Slide>\n  <List><ListItem>a</ListItem></List>\n</Slide>'))
    expect(serializeModel(syncComponentImports(m, known))).toContain("import { Presentation, Slide, Title, List, ListItem } from '@components'")
  })

  test('appends a line to a multi-line import', () => {
    const m = modelFromSource(deck("import {\n  Presentation, Slide,\n} from '@components'", '<Slide>\n  <Stat value="1" label="x" />\n</Slide>'))
    expect(serializeModel(syncComponentImports(m, known))).toContain('import {\n  Presentation, Slide,\n  Stat,\n} from')
  })

  test('adds an import after frontmatter when there is none, and leaves complete imports alone', () => {
    const bare = modelFromSource(deck('', '<Slide>\n  <Title>x</Title>\n</Slide>'))
    expect(serializeModel(syncComponentImports(bare, known))).toStartWith("---\ntitle: T\n---\nimport { Presentation, Slide, Title } from '@components'\n\n")
    const full = modelFromSource(deck("import { Presentation, Slide as S, Title } from '@components'", '<S>\n  <Title>x</Title>\n</S>'))
    expect(syncComponentImports(full, known)).toBe(full)
  })
})
