import { describe, expect, test } from 'bun:test'
import {
  DeckParseError,
  deleteSlide,
  findSlideAtLine,
  getSlideSummary,
  insertSlide,
  moveSlide,
  newDeckSource,
  openingTagEnd,
  parseDeck,
  replaceSlide,
  setSlideAttr,
  setSlideHidden,
} from '../shared/deckParser.ts'

const DECK = `---
title: Demo
---
import { Presentation, Slide, Title, Text, Notes } from '@components'

{/* COLOUR LEGEND: teal = fine */}

<Presentation theme="folio">

<Slide scheme="dark" accent="teal">
  <Title>One</Title>
  <Notes>0:00-0:30. Say one.</Notes>
</Slide>

{/* a comment between slides */}

<Slide frame="title" hidden>
  <Title>Two <Accent>words</Accent></Title>
  <Text>x={'a > b'}</Text>
</Slide>

<Slide>
  <Text>Three</Text>
</Slide>

</Presentation>
`

describe('parseDeck', () => {
  const deck = parseDeck(DECK)

  test('finds slides with exact source ranges, lines and attributes', () => {
    expect(deck.slides).toHaveLength(3)
    expect(deck.slides[0].text.startsWith('<Slide scheme="dark"')).toBe(true)
    expect(deck.slides[0].text.endsWith('</Slide>')).toBe(true)
    expect(DECK.slice(deck.slides[1].start, deck.slides[1].end)).toBe(deck.slides[1].text)
    expect(deck.slides[0].line).toBe(10)
    expect(deck.slides[1].attrs).toEqual({ frame: 'title', hidden: true })
    expect(deck.presentation.attrs).toEqual({ theme: 'folio' })
    expect(deck.frontmatter).toBe('---\ntitle: Demo\n---\n')
  })

  test('extracts notes, hidden state and title text', () => {
    expect(deck.slides[0].notes).toBe('0:00-0:30. Say one.')
    expect(deck.slides[1].hidden).toBe(true)
    expect(deck.slides[1].titleText).toBe('Two words')
    expect(deck.slides[2].titleText).toBeUndefined()
  })

  test('summaries and line lookup', () => {
    expect(getSlideSummary(deck)).toEqual(['"One" [dark/teal]', '"Two words" [dark/yellow, frame title, hidden]', '"(no title)" [dark/yellow]'])
    expect(findSlideAtLine(deck, 11)).toEqual({ slideIndex: 0, lineInSlide: 2 })
    expect(findSlideAtLine(deck, 1)).toEqual({ slideIndex: -1, lineInSlide: -1 })
  })

  test('syntax errors carry a line in the full file', () => {
    const broken = DECK.replace('<Text>Three</Text>', '<Text>Three</Txt>')
    try {
      parseDeck(broken)
      throw new Error('expected a parse error')
    } catch (error) {
      expect(error).toBeInstanceOf(DeckParseError)
      expect((error as DeckParseError).line).toBe(23)
    }
    expect(() => parseDeck('# no deck')).toThrow('Could not find a <Presentation> element')
  })
})

describe('edits are lossless splices', () => {
  const deck = parseDeck(DECK)
  const keeps = (source: string) => {
    expect(source.startsWith('---\ntitle: Demo\n---\n')).toBe(true)
    expect(source).toContain('{/* COLOUR LEGEND: teal = fine */}')
    expect(source).toContain('<Presentation theme="folio">')
  }

  test('replace changes only that slide', () => {
    const next = replaceSlide(deck, 2, '<Slide>\n  <Text>Changed</Text>\n</Slide>')
    keeps(next)
    expect(next).toContain('{/* a comment between slides */}')
    expect(next.replace('Changed', 'Three')).toBe(DECK)
  })

  test('insert before, append, and into an empty deck', () => {
    const before = parseDeck(insertSlide(deck, 0, '<Slide><Text>Zero</Text></Slide>'))
    expect(before.slides.map((s) => s.titleText ?? s.text.match(/<Text>(\w+)/)?.[1])).toEqual(['Zero', 'One', 'Two words', 'Three'])
    const appended = parseDeck(insertSlide(deck, -1, '<Slide><Text>Four</Text></Slide>'))
    expect(appended.slides).toHaveLength(4)
    keeps(appended.source)
    const empty = parseDeck(insertSlide(parseDeck('<Presentation>\n</Presentation>\n'), -1, '<Slide><Title>First</Title></Slide>'))
    expect(empty.slides[0].titleText).toBe('First')
  })

  test('delete takes the separating whitespace with it', () => {
    const first = deleteSlide(deck, 0)
    keeps(first)
    expect(parseDeck(first).slides).toHaveLength(2)
    expect(first).toContain('<Presentation theme="folio">\n\n{/* a comment between slides */}')
    const last = deleteSlide(deck, 2)
    expect(last).toContain('</Slide>\n\n</Presentation>')
    expect(parseDeck(last).slides).toHaveLength(2)
  })

  test('move reorders slides', () => {
    const moved = parseDeck(moveSlide(deck, 0, 2))
    expect(moved.slides.map((s) => s.titleText ?? 'three')).toEqual(['Two words', 'three', 'One'])
    keeps(moved.source)
  })

  test('attributes are set, replaced and removed in the opening tag only', () => {
    const accent = setSlideAttr(deck, 0, 'accent', 'red')
    expect(parseDeck(accent).slides[0].attrs.accent).toBe('red')
    expect(accent.replace('accent="red"', 'accent="teal"')).toBe(DECK)
    const added = parseDeck(setSlideAttr(deck, 2, 'scheme', 'light'))
    expect(added.slides[2].text.startsWith('<Slide scheme="light">')).toBe(true)
    const expr = parseDeck(setSlideAttr(deck, 2, 'camera', { expression: '{ x: 10 }' }))
    expect(expr.slides[2].attrs.camera).toEqual({ expression: '{ x: 10 }' })
    expect(setSlideHidden(parseDeck(setSlideHidden(deck, 1, false)), 1, true).includes('frame="title" hidden>')).toBe(true)
    expect(parseDeck(setSlideHidden(deck, 1, false)).slides[1].hidden).toBe(false)
  })

  test('out-of-range edits throw', () => {
    expect(() => replaceSlide(deck, 9, '<Slide />')).toThrow('Slide index 9 out of range (0-2)')
  })
})

describe('helpers', () => {
  test('openingTagEnd skips quotes and expressions', () => {
    const text = `<Slide title="a > b" camera={{ x: a > b ? 1 : 2 }}>`
    expect(openingTagEnd(text)).toBe(text.length)
  })
  test('newDeckSource builds a parseable deck', () => {
    const source = newDeckSource(['<Slide><Title>Hi</Title></Slide>'], ['Title', 'Slide', 'Presentation'], 'theme="paper"')
    expect(source.startsWith("import { Presentation, Slide, Title } from '@components'")).toBe(true)
    const deck = parseDeck(source)
    expect(deck.slides).toHaveLength(1)
    expect(deck.presentation.attrs.theme).toBe('paper')
  })
})
