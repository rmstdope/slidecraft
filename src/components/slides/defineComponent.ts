import type { FC, ReactNode } from 'react'

/**
 * The component definition system (Part 2 §1.1). Every slide component is created with
 * defineComponent(), which records its registry metadata and sets displayName. The command
 * palette, contextual toolbar, help panel, language service, gallery, generated docs, chat
 * prompt and generated AGENTS.md all read this registry.
 */

export interface ToolbarPropEditor<P = Record<string, unknown>> {
  prop: Extract<keyof P, string>
  type: 'boolean' | 'select' | 'number' | 'image'
  /** Required for 'select'. */
  options?: string[]
  min?: number
  max?: number
  step?: number
}

export interface RegistryProp {
  name: string
  type: string
  default?: string
  description?: string
}

export interface RegistryConfig {
  /** Unique kebab-case id, e.g. 'two-column'. */
  id: string
  /** PascalCase JSX name; must equal the export name. */
  name: string
  category: 'component' | 'template'
  /** One sentence, ending with a period. */
  description: string
  props: RegistryProp[]
  /** MDX inserted at the cursor from the command palette. */
  snippet: string
  /** MDX wrapped in <Slide>, rendered live in previews. */
  previewCode: string
  keywords?: string[]
  useCases?: string[]
}

export interface ComponentDefinition<P = Record<string, unknown>> {
  Component: FC<P>
  registry: RegistryConfig
  toolbar?: ToolbarPropEditor<P>[]
}

export type WithChildren<P = object> = P & { children?: ReactNode }

type AnyDefinition = ComponentDefinition<any>

const allComponents: AnyDefinition[] = []
const allTemplates: RegistryConfig[] = []

export function defineComponent<P>(config: ComponentDefinition<P>): FC<P> {
  if (config.registry.category !== 'component') {
    throw new Error(`defineComponent("${config.registry.name}") must use category 'component'`)
  }
  allComponents.push(config as AnyDefinition)
  config.Component.displayName = config.registry.name // load-bearing: step counting, notes, header split
  return config.Component
}

/** Whole-slide snippets for the palette and "Add slide"; registered like components. */
export function defineTemplate(config: Omit<RegistryConfig, 'category' | 'props'>): RegistryConfig {
  const registry: RegistryConfig = { ...config, category: 'template', props: [] }
  allTemplates.push(registry)
  return registry
}

export const getAllComponents = (): readonly AnyDefinition[] => allComponents
export const getAllTemplates = (): readonly RegistryConfig[] => allTemplates

export function getComponentById(id: string): AnyDefinition | undefined {
  return allComponents.find((c) => c.registry.id === id)
}

export function getToolbarConfig(componentName: string): ToolbarPropEditor[] | undefined {
  return allComponents.find((c) => c.registry.name === componentName)?.toolbar as ToolbarPropEditor[] | undefined
}
