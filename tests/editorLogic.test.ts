import { describe, expect, test } from 'bun:test'
import { getCursorContext } from '../src/editor/cursorContext'
import { deleteElementAt, elementRange, setPropAt, toolbarValue } from '../src/editor/sourceEdits'

const SLIDE = `<Slide scheme="dark"
  accent="teal">
  <Card title="One" compact>
    Body
  </Card>
  <Stat value="42%" label="up" />
  <Text>x</Text>
</Slide>`

const offsetOf = (needle: string, delta = 0) => SLIDE.indexOf(needle) + delta

describe('cursor context', () => {
  test('anywhere in a multi-line Slide tag is the slide', () => {
    expect(getCursorContext(SLIDE, offsetOf('accent'))).toEqual({ type: 'slide', props: { scheme: 'dark', accent: 'teal' }, tagStart: 0 })
  })
  test('on a component tag; bare attributes read as empty strings', () => {
    expect(getCursorContext(SLIDE, offsetOf('title="One"'))).toMatchObject({ type: 'component', name: 'Card', props: { title: 'One', compact: '' } })
    expect(getCursorContext(SLIDE, offsetOf('label'))).toMatchObject({ type: 'component', name: 'Stat' })
  })
  test('in a body: insert, with the parent component', () => {
    expect(getCursorContext(SLIDE, offsetOf('Body'))).toEqual({ type: 'insert', parentComponent: 'Card' })
    expect(getCursorContext(SLIDE, offsetOf('<Stat', -3))).toEqual({ type: 'insert', parentComponent: undefined })
    expect(getCursorContext('plain text', 3)).toEqual({ type: 'none' })
  })
})

describe('source edits', () => {
  test('toolbar values map to attributes', () => {
    expect(toolbarValue('true')).toBe(true)
    expect(toolbarValue('false')).toBeNull()
    expect(toolbarValue('12')).toEqual({ expression: '12' })
    expect(toolbarValue('teal')).toBe('teal')
  })
  test('set props on a multi-line tag without touching the rest', () => {
    const out = setPropAt(SLIDE, 0, 'accent', 'red')
    expect(out).toContain('accent="red"')
    expect(out.replace('accent="red"', 'accent="teal"')).toBe(SLIDE)
    const card = offsetOf('<Card')
    expect(setPropAt(SLIDE, card, 'compact', 'false')).toContain('<Card title="One">')
    expect(setPropAt(SLIDE, offsetOf('<Stat'), 'size', '120')).toContain('<Stat value="42%" label="up" size={120} />')
  })
  test('element ranges and deletion handle nesting and self-closing tags', () => {
    const card = offsetOf('<Card')
    expect(SLIDE.slice(elementRange(SLIDE, card)!.start, elementRange(SLIDE, card)!.end)).toBe('<Card title="One" compact>\n    Body\n  </Card>')
    const without = deleteElementAt(SLIDE, offsetOf('<Stat'))
    expect(without).not.toContain('Stat')
    expect(without).toContain('  </Card>\n  <Text>x</Text>')
    const nested = '<Stack>\n  <Stack>\n    a\n  </Stack>\n</Stack>'
    expect(elementRange(nested, 0)!.end).toBe(nested.length)
  })
})

describe('formatMdx', () => {
  test('re-indents by nesting and keeps code and blank lines', async () => {
    const { formatMdx } = await import('../src/editor/sourceEdits')
    const messy = '<Slide>\n<TwoColumn>\n      <Card title="a">\nBody\n</Card>\n<Stat value="1" label="x" />\n\n</TwoColumn>\n<Code>{`\n    keep\n  as is`}</Code>\n</Slide>'
    expect(formatMdx(messy)).toBe('<Slide>\n  <TwoColumn>\n    <Card title="a">\n      Body\n    </Card>\n    <Stat value="1" label="x" />\n\n  </TwoColumn>\n  <Code>{`\n    keep\n  as is`}</Code>\n</Slide>')
  })
  test('multi-line opening tags', async () => {
    const { formatMdx } = await import('../src/editor/sourceEdits')
    expect(formatMdx('<Slide\n  scheme="dark">\n<Title>T</Title>\n</Slide>')).toBe('<Slide\n  scheme="dark">\n  <Title>T</Title>\n</Slide>')
  })
})
