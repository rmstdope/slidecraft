import { describe, expect, test } from 'bun:test'
import { getAllComponents } from '../src/components/slides/defineComponent'
import '../src/components/slides'
import { compileSlidePreview } from '../src/editor/compileSlide'
import { applyProps, applySettings, DEFAULT_SETTINGS, controlInput, controlValue, propControls, readProps, setOnTags, unionOptions } from '../src/gallery/previewSettings'
import { countPreviewSteps } from '../src/gallery/previewSteps'

const registryOf = (name: string) => getAllComponents().find((c) => c.registry.name === name)!

describe('gallery settings rewrite the example', () => {
  const example = '<Slide scheme="dark" theme="paper">\n  <Stat value="42%" label="up" />\n</Slide>'

  test('previews start dark; light examples are switched too', () => {
    expect(applySettings('<Slide scheme="light">\n  <Text>x</Text>\n</Slide>', DEFAULT_SETTINGS)).toContain('<Slide scheme="dark">')
  })

  test('"example\'s own" everywhere leaves the example alone', () => {
    expect(applySettings(example, { theme: '', scheme: '', accent: '', frame: '' })).toBe(example)
  })

  test('scheme, accent and frame go on every Slide; a chosen theme removes the example theme', () => {
    const out = applySettings(`${example}\n\n<Slide>x</Slide>`, { theme: 'builtin:ion', scheme: 'light', accent: 'teal', frame: 'none' })
    expect(out).not.toContain('theme=')
    expect(out.match(/scheme="light"/g)).toHaveLength(2)
    expect(out.match(/accent="teal"/g)).toHaveLength(2)
    expect(out).toContain('<Slide scheme="light" accent="teal" frame="none">x</Slide>')
    expect(setOnTags('<Presentation theme="folio"><Slide/></Presentation>', 'Presentation', 'theme', null)).toBe('<Presentation><Slide/></Presentation>')
  })

  test('props change the first tag of the component only', () => {
    const src = '<Slide>\n  <Gauge value={87} label="A" />\n  <Gauge value={2} />\n</Slide>'
    const out = applyProps(src, 'Gauge', { value: { expression: '50' }, countUp: { expression: 'false' }, label: null })
    expect(out).toContain('<Gauge value={50} countUp={false} />')
    expect(out).toContain('<Gauge value={2} />')
    expect(readProps(src, 'Gauge')).toEqual({ value: { expression: '87' }, label: 'A' })
  })
})

describe('prop controls come from the registry', () => {
  test('toolbar editors first, then the other simple props; staging props are left out', () => {
    const { registry, toolbar } = registryOf('Gauge')
    const controls = propControls(registry, toolbar)
    const names = controls.map((c) => c.prop.name)
    expect(names.slice(0, 2)).toEqual(['accent', 'countUp'])
    expect(names).toContain('value')
    expect(names).toContain('label')
    expect(names).not.toContain('step')
    expect(names).not.toContain('morph')
  })

  test('union types become selects; arrays are left to the code', () => {
    expect(unionOptions('"curved" | "angled"')).toEqual(['curved', 'angled'])
    expect(unionOptions('string')).toBeNull()
    const { registry, toolbar } = registryOf('Timeline')
    expect(propControls(registry, toolbar).map((c) => c.prop.name)).not.toContain('events')
  })

  test('booleans write only what differs from the default', () => {
    const { registry, toolbar } = registryOf('SignalFlow')
    const pulse = propControls(registry, toolbar).find((c) => c.prop.name === 'pulse')!
    expect(controlInput(pulse, undefined)).toBe(true)
    expect(controlValue(pulse, false)).toEqual({ expression: 'false' })
    expect(controlValue(pulse, true)).toBeNull()
    const steps = propControls(registryOf('TraceTimeline').registry, registryOf('TraceTimeline').toolbar).find((c) => c.prop.name === 'steps')!
    expect(controlValue(steps, true)).toBe(true)
    expect(controlValue(steps, false)).toBeNull()
  })
})

describe('preview steps', () => {
  test('a compiled preview counts its build steps', async () => {
    const staged = await compileSlidePreview('<Slide>\n  <TracedPoints title="T">\n    <TracedPoint step={1} label="a" />\n    <TracedPoint step={2} label="b" />\n  </TracedPoints>\n</Slide>')
    expect(countPreviewSteps(staged)).toBe(2)
    const flat = await compileSlidePreview('<Slide>\n  <Stat value="42%" label="up" />\n</Slide>')
    expect(countPreviewSteps(flat)).toBe(0)
  })
})
