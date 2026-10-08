import { describe, expect, test } from 'bun:test'
import { cursorTarget, openStack } from '../src/language-service/context'
import { registryLanguageService } from '../src/language-service'
import { parseTypeString, snippetHasChildren } from '../src/language-service/registry'
import { maskNonMarkup } from '../src/language-service/text'
import type { Position } from '../src/language-service/types'

const ls = registryLanguageService((component, prop) => {
  if (prop === 'theme' && (component === 'Presentation' || component === 'Slide')) return ['slidecraft', 'corporate', 'paper']
  if (component === 'Slide' && prop === 'frame') return ['none', 'title', 'section', 'content']
  return undefined
})

/** Position of the `|` marker; the marker is removed from the text. */
function at(marked: string): { text: string; pos: Position } {
  const offset = marked.indexOf('|')
  const text = marked.slice(0, offset) + marked.slice(offset + 1)
  const before = text.slice(0, offset).split('\n')
  return { text, pos: { line: before.length - 1, character: before[before.length - 1].length } }
}

describe('type strings and registry data', () => {
  test('parse prop types', () => {
    expect(parseTypeString('"a" | "b"')).toEqual({ kind: 'union', values: ['a', 'b'] })
    expect(parseTypeString('string[]')).toEqual({ kind: 'array', elementType: 'string' })
    expect(parseTypeString('{ x?: number }').kind).toBe('object')
    expect(parseTypeString('boolean | number').kind).toBe('unknown')
  })
  test('children are inferred from the snippet', () => {
    expect(snippetHasChildren('<Title>Your heading</Title>')).toBe(true)
    expect(snippetHasChildren('<Stat value="1" label="x" />')).toBe(false)
    expect(ls.component('Title')?.hasChildren).toBe(true)
  })
})

describe('cursor targets', () => {
  test('component names, props across lines, values and closing tags', () => {
    const name = at('<Slide>\n  <Ti|')
    expect(cursorTarget(name.text, name.text.length)).toMatchObject({ kind: 'component-name', partial: 'Ti' })
    const multiline = at('<Card\n  title="x"\n  comp|')
    expect(cursorTarget(multiline.text, multiline.text.length)).toMatchObject({ kind: 'prop-name', component: 'Card', partial: 'comp', present: ['title'] })
    const value = at('<Slide accent="te|')
    expect(cursorTarget(value.text, value.text.length)).toMatchObject({ kind: 'prop-value', component: 'Slide', prop: 'accent', partial: 'te' })
    const nested = at('<Slide camera={{ x: |')
    expect(cursorTarget(nested.text, nested.text.length).kind).toBe('none')
    const closing = at('<Slide>\n  <Card title="a">\n    text\n  </|')
    expect(cursorTarget(closing.text, closing.text.length)).toMatchObject({ kind: 'closing-tag', open: 'Card' })
  })
  test('the open stack ignores self-closing and closed tags', () => {
    expect(openStack('<Slide>\n<Stat value="1" />\n<Card>\n</Card>\n<List>', 999)).toEqual(['Slide', 'List'])
  })
})

describe('completion', () => {
  test('components insert with or without children', () => {
    const { text, pos } = at('<Slide>\n  <Sta|')
    const items = ls.completions(text, pos)
    expect(items.map((i) => i.label)).toEqual(expect.arrayContaining(['Stat', 'Stack', 'StackDiagram']))
    expect(items.find((i) => i.label === 'Stat')?.insertText).toBe('Stat $0/>')
    expect(items.find((i) => i.label === 'Stack')?.insertText).toBe('Stack>\n  $0\n</Stack>')
  })
  test('props exclude the ones already present', () => {
    const { text, pos } = at('<Slide scheme="dark" a|')
    const labels = ls.completions(text, pos).map((i) => i.label)
    expect(labels).toContain('accent')
    expect(labels).not.toContain('scheme')
  })
  test('values come from toolbar options, unions and dynamic providers', () => {
    const accent = at('<Slide accent="|')
    expect(ls.completions(accent.text, accent.pos).map((i) => i.label)).toEqual(['yellow', 'red', 'teal', 'navy'])
    const frame = at('<Slide frame="s|')
    expect(ls.completions(frame.text, frame.pos).map((i) => i.label)).toEqual(['section'])
    const theme = at('<Presentation theme="|')
    expect(ls.completions(theme.text, theme.pos).map((i) => i.label)).toEqual(['slidecraft', 'corporate', 'paper'])
  })
  test('closing tags complete the innermost open component', () => {
    const { text, pos } = at('<Slide>\n  <Card>\n  </|>')
    expect(ls.completions(text, pos)[0]).toMatchObject({ label: '/Card>', insertText: 'Card>' })
  })
})

describe('diagnostics and quick fixes', () => {
  const text = [
    '<Slide accent="pink" scheme="dark" bogus="1">',
    '  <div>raw</div>',
    '  <Tilte>Typo</Tilte>',
    '  <Code>{`<div>inside code is fine</div>`}</Code>',
    '  {/* <p>inside a comment is fine</p> */}',
    '  <svg><path d="M0 0" /></svg>',
    '</Slide>',
  ].join('\n')
  const found = ls.diagnostics(text)

  test('raw HTML, unknown components, invalid values and unknown props', () => {
    expect(found.map((d) => [d.code, d.range.start.line])).toEqual([
      ['invalid-prop-value', 0],
      ['unknown-prop', 0],
      ['raw-html-element', 1],
      ['unknown-component', 2],
    ])
    expect(found[3].message).toBe('Unknown component <Tilte>. Did you mean <Title>?')
  })

  test('quick fixes rename both tags or pick a valid value', () => {
    const actions = ls.codeActions(text, found)
    const html = actions.find((a) => a.title === 'Replace <div> with <Stack>')!
    expect(html.edits).toHaveLength(2)
    const typo = actions.find((a) => a.title === 'Change to <Title>')!
    expect(typo.edits.map((e) => [e.range.start.line, e.newText])).toEqual([
      [2, 'Title'],
      [2, 'Title'],
    ])
    expect(actions.filter((a) => a.title.startsWith('Use accent=')).map((a) => a.title)).toEqual([
      'Use accent="yellow"',
      'Use accent="red"',
      'Use accent="teal"',
      'Use accent="navy"',
    ])
  })

  test('masking keeps offsets but hides code and comments', () => {
    const masked = maskNonMarkup('a `<div>` {/* <p> */} b')
    expect(masked).toHaveLength('a `<div>` {/* <p> */} b'.length)
    expect(masked).not.toContain('<div>')
    expect(masked).not.toContain('<p>')
  })
})

describe('hover', () => {
  test('components and props', () => {
    const text = '<Stat value="42%" label="x" />'
    expect(ls.hover(text, { line: 0, character: 2 })?.contents).toContain('**Stat**')
    expect(ls.hover(text, { line: 0, character: 7 })?.contents).toContain('**Stat.value**')
    expect(ls.hover(text, { line: 0, character: 13 })).toBeNull()
  })
})
