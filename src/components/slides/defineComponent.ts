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

/**
 * A vault component that is not in use: it failed to compile or load, or the vault's components
 * are blocked. Slides that use it show a placeholder; the gallery shows the message.
 */
export interface ComponentProblem {
  name: string
  message: string
  blocked?: boolean
}

const builtins: SourceEntries = { components: [], templates: [] }
const sources = new Map<string, SourceEntries>()
const problems = new Map<string, readonly ComponentProblem[]>()
/** While a source's modules load, definitions go here instead of to the built-ins. */
let capture: SourceEntries | null = null
let captureQueue: Promise<unknown> = Promise.resolve()
/** Set once the built-ins have all registered (the end of the slides barrel). */
let sealed = false
let activeVault: string | null = null
let version = 0
const listeners = new Set<() => void>()
const sourceOf = new WeakMap<object, string>()

function changed() {
  version++
  merged.clear()
  for (const listener of listeners) listener()
}

const isDev = (): boolean => (import.meta as ImportMeta & { env?: { DEV?: boolean } }).env?.DEV === true

/**
 * Where a definition outside a capture goes. Before the seal it is a built-in. After it, only a
 * built-in module re-running in the dev server (hot reload) may replace its own entry; anything
 * else, such as vault code calling defineComponent after its module has loaded, is refused.
 */
function builtinSlot<T>(list: T[], name: string, nameOf: (t: T) => string, what: string): (entry: T) => void {
  if (!sealed) return (entry) => list.push(entry)
  const at = list.findIndex((e) => nameOf(e) === name)
  if (isDev() && at >= 0) {
    return (entry) => {
      list[at] = entry
      changed()
    }
  }
  throw new Error(`${what}("${name}") ran outside a vault component's loading; define components only at the top level of the module`)
}

export function defineComponent<P>(config: ComponentDefinition<P>): FC<P> {
  const { name } = config.registry
  if (config.registry.category !== 'component') {
    throw new Error(`defineComponent("${name}") must use category 'component'`)
  }
  // displayName is load-bearing (step counting, notes, header split): never rename a component
  // that already has another name, such as a built-in a vault component passes on.
  const current = config.Component.displayName
  if (current && current !== name) throw new Error(`defineComponent("${name}") was given the component ${current}; wrap it in a new component instead`)
  const add = capture ? (entry: AnyDefinition) => capture!.components.push(entry) : builtinSlot(builtins.components, name, (c) => c.registry.name, 'defineComponent')
  add(config as AnyDefinition)
  config.Component.displayName = name
  if (!capture) sourceOf.set(config.registry, BUILTIN_SOURCE)
  return config.Component
}

/** Whole-slide snippets for the palette and "Add slide"; registered like components. */
export function defineTemplate(config: Omit<RegistryConfig, 'category' | 'props'>): RegistryConfig {
  const registry: RegistryConfig = { ...config, category: 'template', props: [] }
  const add = capture ? (entry: RegistryConfig) => capture!.templates.push(entry) : builtinSlot(builtins.templates, registry.name, (t) => t.name, 'defineTemplate')
  add(registry)
  if (!capture) sourceOf.set(registry, BUILTIN_SOURCE)
  return registry
}

/** Called once every built-in has registered; from then on definitions need a capture. */
export function sealBuiltins(): void {
  sealed = true
}

/**
 * Runs `load` (importing a source's modules) and returns what it defined, without registering
 * it. Loads run one at a time, so two sources never mix their definitions. A capture cannot
 * start another from inside its `load` (it would wait for itself).
 */
export function captureDefinitions(load: () => unknown): Promise<SourceEntries> {
  if (capture) return Promise.reject(new Error('captureDefinitions cannot run inside another capture'))
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

/**
 * Sets everything a source registered, replacing what it had: pass the whole vault, not only
 * the components that changed.
 */
export function registerSource(source: string, entries: Partial<SourceEntries>, sourceProblems: readonly ComponentProblem[] = []): void {
  if (source === BUILTIN_SOURCE) throw new Error('The built-in components cannot be replaced')
  const next = { components: [...(entries.components ?? [])], templates: [...(entries.templates ?? [])] }
  for (const c of next.components) sourceOf.set(c.registry, source)
  for (const t of next.templates) sourceOf.set(t, source)
  sources.set(source, next)
  problems.set(source, [...sourceProblems])
  changed()
}

export function clearSource(source: string): void {
  const had = sources.delete(source)
  if (problems.delete(source) || had) changed()
}

/** The vault's components that are not in use, and why. */
export const getSourceProblems = (vault?: string | null): readonly ComponentProblem[] => {
  const resolved = vault === undefined ? activeVault : vault
  return (resolved && problems.get(resolved)) || []
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

/** By id; a built-in's id also finds a vault component that replaces it under another id. */
export function getComponentById(id: string, vault?: string | null): AnyDefinition | undefined {
  const all = getAllComponents(vault)
  const found = all.find((c) => c.registry.id === id)
  if (found) return found
  const builtin = builtins.components.find((c) => c.registry.id === id)
  return builtin && all.find((c) => c.registry.name === builtin.registry.name)
}

export function getToolbarConfig(componentName: string, vault?: string | null): ToolbarPropEditor[] | undefined {
  return getAllComponents(vault).find((c) => c.registry.name === componentName)?.toolbar as ToolbarPropEditor[] | undefined
}
