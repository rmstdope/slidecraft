/**
 * Vaults (UX overhaul U1): named content folders from the config file, kept apart in the app.
 * Internally a vault is a content source (Part 4 §3.3) with a name; deck refs carry its id as
 * `source`. Every vault stays mounted so links into any of them work; the app shows one at a time.
 *
 * The default vault (for legacy name-only URLs, the MCP server and tools without a deck) is:
 * `--vault`/`--content` → `SLIDECRAFT_VAULT`/`SLIDECRAFT_CONTENT_DIR` → `lastVault` → the first
 * vault → the fallback folder.
 */
import { existsSync, mkdirSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'
import { BUILT_IN_SOURCE_ID, BUILT_IN_VAULT_NAME, vaultIdFromName, type ContentSourceInfo } from '../../shared/decks.ts'
import type { ComponentTrust } from '../../shared/vaultComponents.ts'
import {
  CONFIG_FILE,
  expandHome,
  FALLBACK_CONTENT_DIR,
  IS_BUNDLED,
  PUBLIC_DIR,
  readConfig,
  requestedContent,
  writeConfig,
  type AppConfig,
  type SourceDescriptor,
  type VaultConfig,
} from './paths.ts'

export interface ContentSource extends ContentSourceInfo {}

export const LEGACY_INCLUDE = ['*/index.mdx']
export const DESCRIPTOR_INCLUDE = ['*/index.mdx', 'presentations/*/index.mdx']

function normalizeIncludes(id: string, include: string | string[] | undefined, fallback: string[]): string[] {
  const raw = include === undefined ? fallback : Array.isArray(include) ? include : [include]
  const cleaned = [
    ...new Set(
      raw
        .map((p) => String(p).replace(/\\/g, '/').trim())
        .filter((p) => p !== '' && !p.startsWith('/'))
        .map((p) => p.replace(/^(\.\/)+/, ''))
        .filter((p) => !p.split('/').includes('..')),
    ),
  ]
  if (cleaned.length === 0) throw new Error(`Content source "${id}" must define at least one safe include pattern`)
  return cleaned
}

const titleCase = (id: string) => id.replace(/[-_]+/g, ' ').replace(/^\w/, (c) => c.toUpperCase())

const trustOf = (value: unknown): ComponentTrust => (value === 'trusted' || value === 'blocked' ? value : 'ask')

export function normalizeContentSource(id: string, value: string | (SourceDescriptor & { name?: string; components?: unknown }), builtIn = false): ContentSource {
  const legacy = typeof value === 'string'
  const rawPath = legacy ? value : value?.path
  if (typeof rawPath !== 'string' || rawPath.trim() === '') throw new Error(`Content source "${id}" must define a path`)
  return {
    id,
    name: (!legacy && typeof value.name === 'string' && value.name.trim()) || titleCase(id),
    path: resolve(expandHome(rawPath.trim())),
    include: legacy ? [...LEGACY_INCLUDE] : normalizeIncludes(id, value.include, DESCRIPTOR_INCLUDE),
    readOnly: legacy ? false : value.readOnly === true,
    builtIn,
    temporary: false,
    // The repository's examples are the app's own, so their components always run.
    components: builtIn ? 'trusted' : legacy ? 'ask' : trustOf(value.components),
  }
}

const uniqueId = (wanted: string, taken: Set<string>) => {
  if (!taken.has(wanted)) return wanted
  let n = 2
  while (taken.has(`${wanted}-${n}`)) n++
  return `${wanted}-${n}`
}

/**
 * Turn the pre-vault `contents`/`default` keys into `vaults`/`lastVault`. A plain string entry
 * keeps its top-level-only include. Returns the config unchanged when there is nothing to do.
 */
export function migrateConfig(config: AppConfig): { config: AppConfig; changed: boolean } {
  if (!config.contents || config.vaults) return { config, changed: false }
  const { contents, default: lastVault, ...rest } = config
  const vaults: VaultConfig[] = Object.entries(contents).map(([id, value]) =>
    typeof value === 'string' ? { id, name: titleCase(id), path: value, include: [...LEGACY_INCLUDE] } : { id, name: titleCase(id), ...value },
  )
  return { config: { ...rest, vaults, ...(lastVault ? { lastVault } : {}) }, changed: true }
}

function matchRequested(sources: ContentSource[], requested: string): ContentSource | undefined {
  const lower = requested.toLowerCase()
  const path = resolve(expandHome(requested))
  return sources.find((s) => s.id === requested) ?? sources.find((s) => s.name.toLowerCase() === lower) ?? sources.find((s) => s.path === path)
}

export interface SourceState {
  sources: ContentSource[]
  defaultSourceId: string
}

/**
 * Build the vault list. The fallback folder is the repository's examples in a checkout (always
 * listed, as the Examples vault) and the working directory in the release binary (listed only
 * when there is no vault at all, as a temporary vault).
 */
export function normalizeContentSources(rawConfig: AppConfig, requested: string | undefined, fallbackPath: string, options: { bundled?: boolean } = {}): SourceState {
  const { config } = migrateConfig(rawConfig)
  const ids = new Set<string>()
  const sources: ContentSource[] = []
  for (const vault of config.vaults ?? []) {
    if (!vault || typeof vault.path !== 'string') continue
    const id = uniqueId(vault.id ? vaultIdFromName(vault.id) : vaultIdFromName(vault.name ?? basename(vault.path)), ids)
    ids.add(id)
    sources.push(normalizeContentSource(id, { include: DESCRIPTOR_INCLUDE, ...vault }))
  }

  let defaultSourceId: string | undefined
  if (requested) {
    const found = matchRequested(sources, requested)
    if (found) defaultSourceId = found.id
    else {
      const path = resolve(expandHome(requested))
      const name = basename(path) || 'Folder'
      const id = uniqueId(vaultIdFromName(name), new Set([...ids, BUILT_IN_SOURCE_ID]))
      ids.add(id)
      sources.unshift({ ...normalizeContentSource(id, { path, name }), temporary: true })
      defaultSourceId = id
    }
  } else if (config.lastVault && sources.some((s) => s.id === config.lastVault)) {
    defaultSourceId = config.lastVault
  }

  const fallback = resolve(fallbackPath)
  const bundled = options.bundled ?? IS_BUNDLED
  if (!bundled) {
    const mounted = sources.find((s) => s.path === fallback)
    if (mounted) Object.assign(mounted, { builtIn: true, components: 'trusted' })
    else {
      const id = uniqueId(BUILT_IN_SOURCE_ID, ids)
      sources.push(normalizeContentSource(id, { path: fallback, include: DESCRIPTOR_INCLUDE, name: BUILT_IN_VAULT_NAME }, true))
    }
  } else if (sources.length === 0) {
    sources.push({ ...normalizeContentSource(vaultIdFromName(basename(fallback) || 'folder'), { path: fallback, name: basename(fallback) || 'Folder' }), temporary: true })
  }
  defaultSourceId ??= sources.find((s) => !s.builtIn)?.id ?? sources[0].id
  return { sources, defaultSourceId }
}

// Process state: the mounted vaults and the current default. Read through the getters.
let configFile = CONFIG_FILE
let requested = requestedContent()
let fallbackDir = FALLBACK_CONTENT_DIR
let state = normalizeContentSources(readConfig(configFile), requested, fallbackDir)

export const getContentSources = (): ContentSource[] => state.sources
export const getContentSource = (id: string): ContentSource | undefined => state.sources.find((s) => s.id === id)
export const getDefaultContentSource = (): ContentSource => getContentSource(state.defaultSourceId)!
export const getContentDir = (): string => getDefaultContentSource().path
export const getBuiltInSource = (): ContentSource | undefined => state.sources.find((s) => s.builtIn)

/** Shared image library: in the content directory for the binary, in public/ in a checkout. */
export const getLibraryDir = (): string => (IS_BUNDLED ? join(getContentDir(), '.slidecraft', 'library') : join(PUBLIC_DIR, 'images', 'library'))

/** Switch the default vault for this process; the config file is not written. */
export function setContentByName(id: string): boolean {
  if (!getContentSource(id)) return false
  state = { ...state, defaultSourceId: id }
  return true
}

/** For tests and the content-dir script: replace the mounted vaults. */
export function initContentSources(config: AppConfig, requestedContent: string | undefined, fallbackPath: string, file?: string): void {
  if (file) {
    configFile = file
    writeConfig(config, file)
  }
  requested = requestedContent
  fallbackDir = fallbackPath
  state = normalizeContentSources(config, requestedContent, fallbackPath)
}

/** Write the migrated config once (server and MCP start-up), keeping a `.bak` of the original. */
export function persistMigratedConfig(): boolean {
  const { config, changed } = migrateConfig(readConfig(configFile))
  if (changed) writeConfig(config, configFile)
  return changed
}

// ---- Vault management (settings page) ---------------------------------------------------

export class VaultError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
  }
}

function updateConfig(change: (config: AppConfig) => AppConfig): void {
  const next = change(migrateConfig(readConfig(configFile)).config)
  writeConfig(next, configFile)
  const keepDefault = state.defaultSourceId
  state = normalizeContentSources(next, requested, fallbackDir)
  if (getContentSource(keepDefault)) state = { ...state, defaultSourceId: keepDefault }
}

const configured = (config: AppConfig) => config.vaults ?? []

export function addVault(input: { name: string; path: string; readOnly?: boolean; create?: boolean }): ContentSource {
  const name = input.name.trim()
  if (!name) throw new VaultError(400, 'A vault needs a name')
  if (!input.path.trim()) throw new VaultError(400, 'A vault needs a folder')
  const path = resolve(expandHome(input.path.trim()))
  // A vault made here holds only what Slidecraft and its agent write, so its components may run.
  let created = false
  if (!existsSync(path)) {
    if (!input.create) throw new VaultError(404, `The folder ${path} does not exist`)
    mkdirSync(path, { recursive: true })
    created = true
  }
  const existing = state.sources.find((s) => s.path === path && !s.temporary && !s.builtIn)
  if (existing) throw new VaultError(409, `The folder is already the vault "${existing.name}"`)
  if (state.sources.some((s) => !s.temporary && s.name.toLowerCase() === name.toLowerCase())) throw new VaultError(409, `There is already a vault named "${name}"`)
  const id = uniqueId(vaultIdFromName(name), new Set(state.sources.filter((s) => !s.temporary).map((s) => s.id)))
  // A temporary vault for this folder becomes the saved one.
  if (requested && resolve(expandHome(requested)) === path) requested = id
  updateConfig((config) => ({ ...config, vaults: [...configured(config), { id, name, path: input.path.trim(), ...(input.readOnly ? { readOnly: true } : {}), ...(created ? { components: 'trusted' as const } : {}) }] }))
  return getContentSource(id)!
}

function configuredVault(id: string): void {
  const source = getContentSource(id)
  if (!source) throw new VaultError(404, `No vault "${id}"`)
  if (source.builtIn || source.temporary) throw new VaultError(400, `The vault "${source.name}" is not in the config file`)
}

export function updateVault(id: string, change: { name?: string; readOnly?: boolean }): ContentSource {
  configuredVault(id)
  const name = change.name?.trim()
  if (change.name !== undefined && !name) throw new VaultError(400, 'A vault needs a name')
  if (name && state.sources.some((s) => s.id !== id && !s.temporary && s.name.toLowerCase() === name.toLowerCase())) throw new VaultError(409, `There is already a vault named "${name}"`)
  updateConfig((config) => ({
    ...config,
    vaults: configured(config).map((v) =>
      vaultIdFromName(v.id ?? v.name) !== id ? v : { ...v, id, ...(name ? { name } : {}), ...(change.readOnly !== undefined ? { readOnly: change.readOnly } : {}) },
    ),
  }))
  return getContentSource(id)!
}

/** Forget a vault. Its folder and files are left alone. */
export function removeVault(id: string): void {
  configuredVault(id)
  updateConfig((config) => {
    const { lastVault, ...rest } = config
    return { ...rest, vaults: configured(config).filter((v) => vaultIdFromName(v.id ?? v.name) !== id), ...(lastVault && lastVault !== id ? { lastVault } : {}) }
  })
  if (state.defaultSourceId === id) state = { ...state, defaultSourceId: state.sources.find((s) => !s.builtIn)?.id ?? state.sources[0].id }
}

// ---- Component trust (vault components plan, V2) -----------------------------------------

/** A temporary vault's choice lasts for this run only. */
const temporaryTrust = new Map<string, ComponentTrust>()

/** Whether a vault's own components may run. */
export function getComponentTrust(source: ContentSource): ComponentTrust {
  if (source.builtIn) return 'trusted'
  if (source.temporary) return temporaryTrust.get(source.path) ?? 'ask'
  // From the file each time: another process (the MCP server an agent started) may hold an older
  // copy of the config, and a vault blocked on the settings page must stop loading there too.
  const entry = configured(migrateConfig(readConfig(configFile)).config).find((v) => vaultIdFromName(v.id ?? v.name) === source.id)
  return entry ? trustOf(entry.components) : source.components
}

export function setComponentTrust(id: string, trust: 'trusted' | 'blocked'): ContentSource {
  const source = getContentSource(id)
  if (!source) throw new VaultError(404, `No vault "${id}"`)
  if (source.builtIn) throw new VaultError(400, `The components of "${source.name}" always run`)
  if (source.temporary) {
    temporaryTrust.set(source.path, trust)
    return source
  }
  updateConfig((config) => ({ ...config, vaults: configured(config).map((v) => (vaultIdFromName(v.id ?? v.name) !== id ? v : { ...v, id, components: trust })) }))
  return getContentSource(id)!
}

/** Remember the vault the user opened, for `/` next time. */
export function rememberVault(id: string): void {
  const source = getContentSource(id)
  if (!source) throw new VaultError(404, `No vault "${id}"`)
  state = { ...state, defaultSourceId: id }
  if (source.temporary || readConfig(configFile).lastVault === id) return
  updateConfig((config) => ({ ...config, lastVault: id }))
}

export const configFilePath = (): string => configFile

// ---- Agent settings (UX overhaul U3) -------------------------------------------------------

export interface AgentSettings {
  backend?: string
  model?: string
}

export const getAgentSettings = (): AgentSettings => readConfig(configFile).agent ?? {}

/** Save the agent settings; an empty model means the CLI's own default. */
export function setAgentSettings(change: AgentSettings): AgentSettings {
  const config = migrateConfig(readConfig(configFile)).config
  const next: AgentSettings = { ...config.agent }
  if (change.backend !== undefined) next.backend = change.backend
  if (change.model !== undefined) next.model = change.model.trim()
  if (!next.model) delete next.model
  writeConfig({ ...config, agent: next }, configFile)
  return next
}
