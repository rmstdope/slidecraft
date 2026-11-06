/**
 * Vault components in the app (vault components plan, V2): fetch a vault's listing, import each
 * trusted bundle through the import map, and register the vault as a registry source. A
 * `components-changed` event reloads the vault; only folders whose hash changed are imported
 * again. The static site has no server: there the Examples vault's components are bundled by Vite.
 */
import { useSyncExternalStore } from 'react'
import { BUILT_IN_SOURCE_ID } from '@shared/decks.ts'
import type { ComponentTrust, VaultComponentInfo } from '@shared/vaultComponents.ts'
import { fetchVaultComponents, setVaultComponentTrust } from '../api'
import { appPath, IS_STATIC } from '../basePath'
import { bundledComponentModules } from '../bundledDecks'
import { setActiveVault } from '../components/slides/defineComponent'
import { subscribeServerEvents } from '../hooks/useSSE'
import { BLOCKED_MESSAGE, loadFolder, registerFolders, reusable, UNDECIDED_MESSAGE, type LoadedFolder } from './loadComponents'

export interface VaultComponentsState {
  trust: ComponentTrust
  components: VaultComponentInfo[]
  /** The listing could not be fetched. */
  error?: string
}

interface Entry {
  state: VaultComponentsState
  folders: Map<string, LoadedFolder>
  /** The first load; decks wait for it before they compile. */
  ready: Promise<void>
  running?: Promise<void>
  again?: boolean
}

const entries = new Map<string, Entry>()
const listeners = new Set<() => void>()
let imports = 0
let subscribed = false

const notify = () => listeners.forEach((l) => l())

async function importFolder(info: VaultComponentInfo): Promise<LoadedFolder> {
  if (info.error !== undefined || !info.url) return { name: info.name, hash: info.hash, components: [], error: info.error ?? 'No bundle' }
  // A new query each time, so a version seen before (an edit undone) runs again inside the capture.
  const url = `${appPath(info.url)}&n=${++imports}`
  return loadFolder(info.name, info.hash, () => import(/* @vite-ignore */ url))
}

async function refresh(vault: string, entry: Entry): Promise<void> {
  const result = await fetchVaultComponents(vault)
  if (!result.data) {
    entry.state = { ...entry.state, error: result.error }
    // Forget the vault, so the next deck or page that needs it asks the server again.
    if (entries.get(vault) === entry && entry.folders.size === 0) entries.delete(vault)
    notify()
    return
  }
  const { trust, components } = result.data
  const folders = new Map<string, LoadedFolder>()
  for (const info of components) {
    const previous = entry.folders.get(info.name)
    const same = reusable(previous, info.hash) && trust === entry.state.trust
    folders.set(info.name, same ? previous! : trust === 'trusted' ? await importFolder(info) : { name: info.name, hash: info.hash, components: [] })
  }
  entry.folders = folders
  entry.state = { trust, components }
  if (trust === 'trusted') registerFolders(vault, [...folders.values()])
  else registerFolders(vault, [], components.map((c) => c.name), trust === 'blocked' ? BLOCKED_MESSAGE : UNDECIDED_MESSAGE)
  notify()
}

/** Loads (or reloads) a vault's components; overlapping calls run once more after the current one. */
function reload(vault: string, entry: Entry): Promise<void> {
  if (entry.running) {
    entry.again = true
    return entry.running
  }
  entry.running = refresh(vault, entry)
    .catch((error) => console.warn(`Loading the components of ${vault} failed`, error))
    .finally(() => {
      entry.running = undefined
      if (entry.again) {
        entry.again = false
        void reload(vault, entry)
      }
    })
  return entry.running
}

function staticExamples(entry: Entry): Promise<void> {
  return (async () => {
    const folders: LoadedFolder[] = []
    for (const [file, load] of Object.entries(bundledComponentModules)) {
      const name = /\/components\/([^/]+)\/index\.tsx$/.exec(file)?.[1]
      if (name) folders.push(await loadFolder(name, 'bundled', load))
    }
    entry.folders = new Map(folders.map((f) => [f.name, f]))
    entry.state = { trust: 'trusted', components: folders.map((f) => ({ name: f.name, hash: f.hash, ...(f.error ? { error: f.error } : {}) })) }
    registerFolders(BUILT_IN_SOURCE_ID, folders)
    notify()
  })()
}

function subscribe(): void {
  if (subscribed || IS_STATIC) return
  subscribed = true
  subscribeServerEvents((message) => {
    if (message.type !== 'components-changed' || typeof message.source !== 'string') return
    const entry = entries.get(message.source)
    if (entry) void reload(message.source, entry)
  })
}

/** Starts loading a vault's components once; resolves when they are registered. */
export function ensureVaultComponents(vault: string): Promise<void> {
  const existing = entries.get(vault)
  if (existing) return existing.ready
  const entry: Entry = { state: { trust: 'ask', components: [] }, folders: new Map(), ready: Promise.resolve() }
  entries.set(vault, entry)
  if (IS_STATIC) entry.ready = vault === BUILT_IN_SOURCE_ID ? staticExamples(entry) : Promise.resolve()
  else {
    subscribe()
    entry.ready = reload(vault, entry)
  }
  return entry.ready
}

/** The vault on screen: its components become the default view of the registry. */
export function activateVault(vault: string): Promise<void> {
  setActiveVault(vault)
  return ensureVaultComponents(vault)
}

/** Allow or block a vault's components, then load or drop them. */
export async function setComponentTrust(vault: string, trust: 'trusted' | 'blocked'): Promise<string | undefined> {
  const result = await setVaultComponentTrust(vault, trust)
  if (!result.data) return result.error
  const entry = entries.get(vault)
  if (entry) await reload(vault, entry)
  else await ensureVaultComponents(vault)
  return undefined
}

export const getVaultComponents = (vault: string): VaultComponentsState | undefined => entries.get(vault)?.state

const subscribeStore = (listener: () => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** A vault's listing and trust, re-rendering when they change. */
export function useVaultComponents(vault: string | undefined): VaultComponentsState | undefined {
  return useSyncExternalStore(
    subscribeStore,
    () => (vault ? getVaultComponents(vault) : undefined),
    () => undefined,
  )
}
