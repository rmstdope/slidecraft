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
  /**
   * Name of the component this one is a part of (ListItem → List, SignalNode → SignalFlow). Parts
   * stay in the MDX scope and completions, but listings show them inside their parent's entry.
   */
  parent?: string
}

export interface ComponentDefinition<P = Record<string, unknown>> {
  Component: FC<P>
  registry: RegistryConfig
  toolbar?: ToolbarPropEditor<P>[]
}

export type WithChildren<P = object> = P & { children?: ReactNode }

type AnyDefinition = ComponentDefinition<any>

/**
 * Registry layers (vault components plan, V1). The built-ins register at import; a vault's
 * components and templates register as their own source and, while that vault is active, hide a
 * built-in of the same name. The getters return the merged view for one vault: the active one,
 * unless a vault is passed (the server serves several vaults at once).
 */
export const BUILTIN_SOURCE = 'builtin'

interface SourceEntries {
  components: AnyDefinition[]
  templates: RegistryConfig[]
}

const builtins: SourceEntries = { components: [], templates: [] }
const sources = new Map<string, SourceEntries>()
/** While a source's modules load, definitions go here instead of to the built-ins. */
let capture: SourceEntries | null = null
let captureQueue: Promise<unknown> = Promise.resolve()
let activeVault: string | null = null
let version = 0
const listeners = new Set<() => void>()
const sourceOf = new WeakMap<object, string>()

function changed() {
  version++
  merged.clear()
  for (const listener of listeners) listener()
}

export function defineComponent<P>(config: ComponentDefinition<P>): FC<P> {
  if (config.registry.category !== 'component') {
    throw new Error(`defineComponent("${config.registry.name}") must use category 'component'`)
  }
  ;(capture ?? builtins).components.push(config as AnyDefinition)
  config.Component.displayName = config.registry.name // load-bearing: step counting, notes, header split
  if (!capture) sourceOf.set(config.registry, BUILTIN_SOURCE)
  return config.Component
}

/** Whole-slide snippets for the palette and "Add slide"; registered like components. */
export function defineTemplate(config: Omit<RegistryConfig, 'category' | 'props'>): RegistryConfig {
  const registry: RegistryConfig = { ...config, category: 'template', props: [] }
  ;(capture ?? builtins).templates.push(registry)
  if (!capture) sourceOf.set(registry, BUILTIN_SOURCE)
  return registry
}

/**
 * Runs `load` (importing a source's modules) and returns what it defined, without registering
 * it. Loads run one at a time, so two sources never mix their definitions.
 */
export function captureDefinitions(load: () => unknown): Promise<SourceEntries> {
  const run = captureQueue.then(async () => {
    const entries: SourceEntries = { components: [], templates: [] }
    capture = entries
    try {
      await load()
    } finally {
      capture = null
    }
    return entries
  })
  captureQueue = run.catch(() => undefined)
  return run
}

/** Sets (replacing) everything a source registered. */
export function registerSource(source: string, entries: Partial<SourceEntries>): void {
  if (source === BUILTIN_SOURCE) throw new Error('The built-in components cannot be replaced')
  const next = { components: [...(entries.components ?? [])], templates: [...(entries.templates ?? [])] }
  for (const c of next.components) sourceOf.set(c.registry, source)
  for (const t of next.templates) sourceOf.set(t, source)
  sources.set(source, next)
  changed()
}

export function clearSource(source: string): void {
  if (sources.delete(source)) changed()
}

/** The vault whose components the getters return when none is passed. */
export function setActiveVault(vault: string | null): void {
  if (vault === activeVault) return
  activeVault = vault
  changed()
}

export const getActiveVault = (): string | null => activeVault

/** Bumped on every registration change; views re-render on it. */
export const getRegistryVersion = (): number => version

export function subscribeRegistry(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Where an entry comes from: BUILTIN_SOURCE or a vault id. */
export const sourceOfEntry = (registry: RegistryConfig): string => sourceOf.get(registry) ?? BUILTIN_SOURCE

/** The built-in a vault entry hides, if any. */
export function getBuiltinComponent(name: string): AnyDefinition | undefined {
  return builtins.components.find((c) => c.registry.name === name)
}

const merged = new Map<string, SourceEntries>()

/** Built-ins with the vault's same-named entries in their place, then the vault's new ones. */
function mergedView(vault: string | null | undefined): SourceEntries {
  const key = vault ?? ''
  const cached = merged.get(key)
  if (cached) return cached
  const own = vault ? sources.get(vault) : undefined
  let view = builtins
  if (own) {
    const layer = <T>(base: T[], extra: T[], name: (t: T) => string): T[] => {
      const byName = new Map(extra.map((e) => [name(e), e]))
      const out = base.map((b) => byName.get(name(b)) ?? b)
      const used = new Set(base.map(name))
      return [...out, ...extra.filter((e) => !used.has(name(e)))]
    }
    view = {
      components: layer(builtins.components, own.components, (c) => c.registry.name),
      templates: layer(builtins.templates, own.templates, (t) => t.name),
    }
  }
  merged.set(key, view)
  return view
}

const viewOf = (vault?: string | null) => mergedView(vault === undefined ? activeVault : vault)

export const getAllComponents = (vault?: string | null): readonly AnyDefinition[] => viewOf(vault).components
export const getAllTemplates = (vault?: string | null): readonly RegistryConfig[] => viewOf(vault).templates

/** Components with their own entry in listings: everything that is not a part of another. */
export const getTopLevelComponents = (vault?: string | null): readonly AnyDefinition[] => getAllComponents(vault).filter((c) => !c.registry.parent)

/** The parts of a component, in registration order. */
export const getParts = (name: string, vault?: string | null): readonly AnyDefinition[] => getAllComponents(vault).filter((c) => c.registry.parent === name)

/** The top-level entry a component belongs to: its parent, or itself. */
export const ownerName = (registry: RegistryConfig): string => registry.parent ?? registry.name

export function getComponentById(id: string, vault?: string | null): AnyDefinition | undefined {
  return getAllComponents(vault).find((c) => c.registry.id === id)
}

export function getToolbarConfig(componentName: string, vault?: string | null): ToolbarPropEditor[] | undefined {
  return getAllComponents(vault).find((c) => c.registry.name === componentName)?.toolbar as ToolbarPropEditor[] | undefined
}
