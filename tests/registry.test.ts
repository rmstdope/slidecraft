import { describe, expect, test } from 'bun:test'
import { compile } from '@mdx-js/mdx'
import { mdxComponentScope } from '../src/components/mdxScope'
import * as slides from '../src/components/slides'
import { getAllComponents, getAllTemplates } from '../src/components/slides/defineComponent'

const definitions = getAllComponents()
const registries = [...definitions.map((d) => d.registry), ...getAllTemplates()]

describe('every export of the slides barrel', () => {
  for (const [exportName, Component] of Object.entries(slides)) {
    test(`${exportName} is registered, named and in the MDX scope`, () => {
      const definition = definitions.find((d) => d.registry.name === exportName)
      expect(definition).toBeDefined()
      expect(typeof Component).toBe('function')
      expect((Component as { displayName?: string }).displayName).toBe(exportName)
      expect(Object.keys(mdxComponentScope)).toContain(exportName)
    })
  }
})

describe('registry metadata', () => {
  test('ids and names are unique', () => {
    const ids = registries.map((r) => r.id)
    const names = registries.map((r) => r.name)
    expect(new Set(ids).size).toBe(ids.length)
    expect(new Set(names).size).toBe(names.length)
  })

  for (const registry of registries) {
    describe(registry.name, () => {
      test('fields are well formed', () => {
        expect(registry.id).toMatch(/^[a-z0-9-]+$/)
        expect(registry.description.trim()).not.toBe('')
        expect(registry.description.trim().endsWith('.')).toBe(true)
        expect(['component', 'template']).toContain(registry.category)
        expect(registry.snippet.trim()).not.toBe('')
        expect(registry.previewCode.trim()).not.toBe('')
        for (const prop of registry.props) {
          expect(prop.name).toMatch(/^[A-Za-z_$][\w$]*$/)
          expect(prop.type.trim()).not.toBe('')
        }
      })

      test('snippet and previewCode compile as MDX', async () => {
        await compile(registry.snippet, { jsx: true })
        await compile(registry.previewCode, { jsx: true })
      })
    })
  }

  for (const { registry, toolbar = [] } of definitions) {
    test(`${registry.name} toolbar editors reference declared props`, () => {
      const declared = new Set(registry.props.map((p) => p.name))
      for (const editor of toolbar) {
        expect(declared.has(editor.prop)).toBe(true)
        if (editor.type === 'select') expect(editor.options?.length ?? 0).toBeGreaterThan(0)
      }
    })
  }
})
