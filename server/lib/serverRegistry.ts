/**
 * The vault's components in the server's own registry (vault components plan, V2), so
 * `validate_deck`, the per-turn deck checks, the MCP tools and the agent context know them. The
 * bundles are imported with a Bun plugin that supplies `slidecraft` and the shared packages as
 * the server's own modules. Only a trusted vault's code is ever imported.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import * as React from 'react'
import * as jsxRuntime from 'react/jsx-runtime'
import * as motion from 'motion/react'
import type { VaultModuleName } from '../../shared/vaultRuntime.ts'
import { clearSource } from '../../src/components/slides/defineComponent.ts'
import * as slidecraft from '../../src/vault-api/index.ts'
import { BLOCKED_MESSAGE, loadFolder, registerFolders, reusable, UNDECIDED_MESSAGE, type LoadedFolder } from '../../src/vault-api/loadComponents.ts'
import { getComponentTrust, getContentSource, type ContentSource } from './contentSources.ts'
import { bundleComponent, componentFolders, componentsDir, folderHash } from './vaultComponents.ts'

const modules: Record<VaultModuleName, Record<string, unknown>> = {
  slidecraft,
  react: React,
  'react/jsx-runtime': jsxRuntime,
  'motion/react': motion,
}

let pluginInstalled = false

function installPlugin(): void {
  if (pluginInstalled) return
  pluginInstalled = true
  Bun.plugin({
    name: 'slidecraft:vault-modules',
    setup(build) {
      for (const [name, mod] of Object.entries(modules)) {
        build.module(name, () => ({ exports: { ...mod, default: (mod as { default?: unknown }).default ?? mod }, loader: 'object' }))
      }
    },
  })
}

const CACHE_DIR = join(tmpdir(), `slidecraft-components-${process.pid}`)
let loads = 0

interface VaultState {
  trust: string
  folders: Map<string, LoadedFolder>
  /** The folder names last registered as blocked. */
  blocked?: string
}

const loaded = new Map<string, VaultState>()
const pending = new Map<string, Promise<void>>()

async function importBundle(source: ContentSource, name: string): Promise<LoadedFolder> {
  const bundle = await bundleComponent(source, name)
  if (bundle.error !== undefined) return { name, hash: bundle.hash, components: [], error: bundle.error }
  const dir = join(CACHE_DIR, source.id)
  mkdirSync(dir, { recursive: true })
  const file = join(dir, `${name}-${bundle.hash}.mjs`)
  writeFileSync(file, bundle.code)
  // A new query each time, so a module seen before (an edit undone) runs again inside the capture.
  const url = `${pathToFileURL(file).href}?n=${++loads}`
  return loadFolder(name, bundle.hash, () => import(url))
}

async function refresh(source: ContentSource): Promise<void> {
  const trust = getComponentTrust(source)
  const names = componentFolders(source)
  if (trust !== 'trusted') {
    const before = loaded.get(source.id)
    // Unchanged: registering again would bump the registry version and rebuild every check.
    if (before?.trust === trust && before.blocked === names.join('/')) return
    loaded.set(source.id, { trust, folders: new Map(), blocked: names.join('/') })
    if (names.length) registerFolders(source.id, [], names, trust === 'blocked' ? BLOCKED_MESSAGE : UNDECIDED_MESSAGE)
    else clearSource(source.id)
    return
  }
  const before = loaded.get(source.id)
  const folders = new Map<string, LoadedFolder>()
  let changed = before?.trust !== trust || before.folders.size !== names.length
  for (const name of names) {
    const hash = folderHash(join(componentsDir(source), name))
    const previous = before?.folders.get(name)
    if (reusable(previous, hash)) {
      folders.set(name, previous)
      continue
    }
    installPlugin()
    folders.set(name, await importBundle(source, name))
    changed = true
  }
  loaded.set(source.id, { trust, folders })
  if (!changed) return
  if (folders.size) registerFolders(source.id, [...folders.values()])
  else clearSource(source.id)
}

/**
 * Brings the server's registry up to date with a vault's `components/` (only what changed is
 * imported again). Call before reading the registry for that vault.
 */
export function ensureServerComponents(vault: string | undefined): Promise<void> {
  const source = vault ? getContentSource(vault) : undefined
  if (!source) return Promise.resolve()
  const running = pending.get(source.id)
  if (running) return running
  const run = refresh(source).finally(() => pending.delete(source.id))
  pending.set(source.id, run)
  return run
}
