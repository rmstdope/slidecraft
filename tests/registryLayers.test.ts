import { afterEach, describe, expect, test } from 'bun:test'
import type { FC } from 'react'
import '../src/components/slides'
import { builtinMdxScope, getMdxScope } from '../src/components/mdxScope'
import {
  BUILTIN_SOURCE,
  captureDefinitions,
  clearSource,
  defineComponent,
  defineTemplate,
  getActiveVault,
  getAllComponents,
  getAllTemplates,
  getBuiltinComponent,
  getComponentById,
  getParts,
  getRegistryVersion,
  getTopLevelComponents,
  registerSource,
  setActiveVault,
  sourceOfEntry,
  subscribeRegistry,
  type RegistryConfig,
} from '../src/components/slides/defineComponent'

const entry = (name: string, extra: Partial<RegistryConfig> = {}): RegistryConfig => ({
  id: name.toLowerCase(),
  name,
  category: 'component',
  description: `${name} from a vault.`,
  props: [],
  snippet: `<${name} />`,
  previewCode: `<Slide><${name} /></Slide>`,
  ...extra,
})

const component = (_name: string): FC => {
  const C: FC = () => null
  return C
}

/** Defines components the way a vault module does: inside a capture, so the built-ins stay as they are. */
async function vaultDefinitions() {
  return captureDefinitions(() => {
    defineComponent({ Component: component('Stat'), registry: entry('Stat', { id: 'acme-stat' }) })
    defineComponent({ Component: component('FunnelBars'), registry: entry('FunnelBars') })
    defineComponent({ Component: component('FunnelStage'), registry: entry('FunnelStage', { parent: 'FunnelBars' }) })
    defineTemplate({ id: 'template-acme-title', name: 'Acme Title Slide', description: 'Title.', snippet: '<Slide />', previewCode: '<Slide />' })
    defineTemplate({ id: 'template-title', name: 'Title Slide', description: 'Acme title.', snippet: '<Slide />', previewCode: '<Slide />' })
  })
}

afterEach(() => {
  clearSource('acme')
  clearSource('other')
  setActiveVault(null)
})

describe('registry layers', () => {
  const builtinCount = getAllComponents().length
  const builtinTemplates = getAllTemplates().length

  test('a capture does not touch the built-ins', async () => {
    const defs = await vaultDefinitions()
    expect(defs.components.map((c) => c.registry.name)).toEqual(['Stat', 'FunnelBars', 'FunnelStage'])
    expect(defs.templates).toHaveLength(2)
    expect(getAllComponents()).toHaveLength(builtinCount)
    expect(getAllTemplates()).toHaveLength(builtinTemplates)
    expect(sourceOfEntry(getAllComponents().find((c) => c.registry.name === 'Stat')!.registry)).toBe(BUILTIN_SOURCE)
  })

  test('a vault overrides by name and adds its own, only while it is active', async () => {
    registerSource('acme', await vaultDefinitions())
    expect(getAllComponents().find((c) => c.registry.name === 'FunnelBars')).toBeUndefined()

    setActiveVault('acme')
    expect(getActiveVault()).toBe('acme')
    const all = getAllComponents()
    expect(all).toHaveLength(builtinCount + 2)
    const stat = all.filter((c) => c.registry.name === 'Stat')
    expect(stat).toHaveLength(1)
    expect(sourceOfEntry(stat[0].registry)).toBe('acme')
    expect(sourceOfEntry(getBuiltinComponent('Stat')!.registry)).toBe(BUILTIN_SOURCE)
    // The override keeps the built-in's place in the order; new entries come after the built-ins.
    expect(all.findIndex((c) => c.registry.name === 'Stat')).toBe(getAllComponents(null).findIndex((c) => c.registry.name === 'Stat'))
    expect(all.at(-1)!.registry.name).toBe('FunnelStage')

    expect(getParts('FunnelBars').map((p) => p.registry.name)).toEqual(['FunnelStage'])
    expect(getTopLevelComponents().some((c) => c.registry.name === 'FunnelStage')).toBe(false)

    const templates = getAllTemplates()
    expect(templates).toHaveLength(builtinTemplates + 1)
    expect(templates.find((t) => t.name === 'Title Slide')!.description).toBe('Acme title.')
  })

  test('an explicit vault gives that vault’s view whatever is active', async () => {
    registerSource('acme', await vaultDefinitions())
    setActiveVault('other')
    expect(getAllComponents('acme').some((c) => c.registry.name === 'FunnelBars')).toBe(true)
    expect(getAllComponents().some((c) => c.registry.name === 'FunnelBars')).toBe(false)
    expect(getAllComponents(null)).toHaveLength(builtinCount)
  })

  test('registering again replaces the source, and clearing restores the built-ins', async () => {
    registerSource('acme', await vaultDefinitions())
    setActiveVault('acme')
    registerSource('acme', { components: [] })
    expect(getAllComponents()).toHaveLength(builtinCount)
    registerSource('acme', await vaultDefinitions())
    clearSource('acme')
    expect(getAllComponents()).toHaveLength(builtinCount)
  })

  test('changes bump the version and notify subscribers', async () => {
    let calls = 0
    const stop = subscribeRegistry(() => calls++)
    const before = getRegistryVersion()
    registerSource('acme', await vaultDefinitions())
    setActiveVault('acme')
    setActiveVault('acme') // no change, no notification
    clearSource('acme')
    stop()
    registerSource('acme', { components: [] })
    expect(calls).toBe(3)
    expect(getRegistryVersion()).toBeGreaterThan(before)
  })

  test('captures run one at a time', async () => {
    let release!: () => void
    const first = captureDefinitions(async () => {
      await new Promise<void>((r) => (release = r))
      defineComponent({ Component: component('A'), registry: entry('A') })
    })
    const second = captureDefinitions(() => defineComponent({ Component: component('B'), registry: entry('B') }))
    await Bun.sleep(0)
    release()
    expect((await first).components.map((c) => c.registry.name)).toEqual(['A'])
    expect((await second).components.map((c) => c.registry.name)).toEqual(['B'])
  })

  test('a failed capture lets the next one run', async () => {
    await expect(captureDefinitions(() => Promise.reject(new Error('broken')))).rejects.toThrow('broken')
    expect((await captureDefinitions(() => defineComponent({ Component: component('C'), registry: entry('C') }))).components).toHaveLength(1)
  })

  test('a definition outside a capture is refused once the built-ins have registered', () => {
    expect(() => defineComponent({ Component: component('Late'), registry: entry('Late') })).toThrow('outside a vault component')
    expect(() => defineTemplate({ id: 'late', name: 'Late', description: 'Late.', snippet: '', previewCode: '' })).toThrow('outside a vault component')
    expect(getAllComponents(null).some((c) => c.registry.name === 'Late')).toBe(false)
  })

  test('a built-in is never renamed by a vault definition', async () => {
    const Text = getBuiltinComponent('Text')!.Component
    await expect(captureDefinitions(() => defineComponent({ Component: Text, registry: entry('Lead') }))).rejects.toThrow('was given the component Text')
    expect(Text.displayName).toBe('Text')
  })

  test('a capture cannot start inside another', async () => {
    let inner: Promise<unknown> | undefined
    await captureDefinitions(() => {
      inner = captureDefinitions(() => undefined)
    })
    await expect(inner!).rejects.toThrow('inside another capture')
  })

  test('captures started while another loads wait their turn instead of failing', async () => {
    let release!: () => void
    let started!: () => void
    const loading = new Promise<void>((r) => (started = r))
    const slow = captureDefinitions(() => {
      started()
      return new Promise<void>((r) => (release = r))
    })
    await loading // the first load is waiting on its import
    const second = captureDefinitions(() => undefined)
    release()
    await expect(slow).resolves.toEqual({ components: [], templates: [] })
    await expect(second).resolves.toEqual({ components: [], templates: [] })
  })

  test('a built-in id also finds the vault component that replaces it', async () => {
    const defs = await vaultDefinitions()
    const builtinId = getBuiltinComponent('Stat')!.registry.id
    registerSource('acme', defs)
    setActiveVault('acme')
    expect(getComponentById(builtinId)).toBe(defs.components[0])
    expect(getComponentById(builtinId, null)).toBe(getBuiltinComponent('Stat'))
  })

  test('the built-ins cannot be replaced', () => {
    expect(() => registerSource(BUILTIN_SOURCE, {})).toThrow()
  })
})

describe('MDX scope', () => {
  test('is the built-in scope until a vault adds components', () => {
    expect(getMdxScope()).toBe(builtinMdxScope)
  })

  test('adds and overrides the active vault’s components, read after registration', async () => {
    const defs = await vaultDefinitions()
    registerSource('acme', defs)
    setActiveVault('acme')
    const scope = getMdxScope() as Record<string, unknown>
    expect(scope.Stat).toBe(defs.components[0].Component)
    expect(scope.FunnelBars).toBe(defs.components[1].Component)
    expect(scope.Text).toBe(builtinMdxScope.Text)
    expect(getMdxScope() as unknown).toBe(scope) // cached while nothing changes
    expect((getMdxScope('other') as Record<string, unknown>).FunnelBars).toBeUndefined()
  })

  test('no vault (null) and the active vault (undefined) are different scopes', async () => {
    const defs = await vaultDefinitions()
    registerSource('acme', defs)
    setActiveVault('acme')
    expect((getMdxScope() as Record<string, unknown>).Stat).toBe(defs.components[0].Component)
    expect(getMdxScope(null)).toBe(builtinMdxScope)
  })
})
