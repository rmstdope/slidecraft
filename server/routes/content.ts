/** Presentations, vaults and themes (Part 4 §5; themes from plan Phase 4b). */
import type { ContentSourceInfo } from '../../shared/decks.ts'
import { addVault, configFilePath, getComponentTrust, getContentSource, getContentSources, getDefaultContentSource, removeVault, rememberVault, setComponentTrust, updateVault, VaultError, type ContentSource } from '../lib/contentSources.ts'
import { listVaultComponents } from '../lib/vaultComponents.ts'
import { broadcast } from '../lib/events.ts'
import { discoverPresentations } from '../lib/decks.ts'
import { executeTool } from '../lib/tools.ts'
import { restartFileWatcher } from '../lib/fileWatcher.ts'
import { errorJson, json, readJson } from '../lib/http.ts'
import { PORT } from '../lib/paths.ts'
import { discoverThemes } from '../lib/themes.ts'
import { syncAllFolderInstructions } from '../lib/agentContext.ts'
import { syncSkillsToVaults, syncVaultSkills } from '../lib/skillSync.ts'

export async function handlePresentations(url: URL): Promise<Response> {
  try {
    const source = url.searchParams.get('source') ?? undefined
    const path = url.searchParams.get('path') ?? undefined
    return json(await discoverPresentations({ source, path }))
  } catch (error) {
    return errorJson(500, 'Failed to list presentations', (error as Error).message)
  }
}

const info = (source: ContentSource): ContentSourceInfo => {
  const { id, name, path, include, readOnly, builtIn, temporary } = source
  return { id, name, path, include, readOnly, builtIn, temporary, components: getComponentTrust(source) }
}

function vaultsState() {
  return { vaults: getContentSources().map(info), defaultVault: getDefaultContentSource().id, configFile: configFilePath() }
}

async function afterVaultChange(): Promise<void> {
  await restartFileWatcher()
  await syncAllFolderInstructions(PORT)
  await syncSkillsToVaults()
}

/**
 * Vaults (UX overhaul U1):
 * GET /api/vaults · POST /api/vaults {name, path, readOnly?, create?} ·
 * PATCH /api/vaults/<id> {name?, readOnly?} · DELETE /api/vaults/<id> (files stay) ·
 * POST /api/vaults/<id>/open (remember it as the last vault) ·
 * GET /api/vaults/<id>/components (its component folders) ·
 * PUT /api/vaults/<id>/components {trust: "trusted" | "blocked"} (whether they may run).
 */
export async function handleVaults(request: Request, url: URL): Promise<Response> {
  const rest = url.pathname.slice('/api/vaults'.length).replace(/^\/+/, '')
  const [rawId, action] = rest.split('/')
  let id: string
  try {
    id = decodeURIComponent(rawId ?? '')
  } catch {
    return errorJson(400, 'Invalid vault id')
  }
  try {
    if (!id) {
      if (request.method === 'GET') return json(vaultsState())
      if (request.method === 'POST') {
        const body = await readJson<{ name?: unknown; path?: unknown; readOnly?: unknown; create?: unknown }>(request)
        if (!body || typeof body.name !== 'string' || typeof body.path !== 'string') return errorJson(400, 'Body must be JSON with "name" and "path" strings')
        const vault = addVault({ name: body.name, path: body.path, readOnly: body.readOnly === true, create: body.create === true })
        await afterVaultChange()
        return json({ ...vaultsState(), vault: info(vault) }, 201)
      }
      return errorJson(405, 'Method not allowed')
    }
    if (action === 'open' && request.method === 'POST') {
      rememberVault(id)
      return json(vaultsState())
    }
    if (action === 'components') {
      const source = getContentSource(id)
      if (!source) return errorJson(404, `No vault "${id}"`)
      if (request.method === 'GET') return json(await listVaultComponents(source))
      if (request.method === 'PUT') {
        const body = await readJson<{ trust?: unknown }>(request)
        if (body?.trust !== 'trusted' && body?.trust !== 'blocked') return errorJson(400, 'Body must be JSON with "trust": "trusted" or "blocked"')
        setComponentTrust(id, body.trust)
        broadcast({ type: 'components-changed', source: id, timestamp: Date.now() })
        void syncVaultSkills(getContentSource(id)!)
        return json(await listVaultComponents(getContentSource(id)!))
      }
      return errorJson(405, 'Method not allowed')
    }
    if (action) return errorJson(404, 'Not found')
    if (request.method === 'PATCH') {
      const body = await readJson<{ name?: unknown; readOnly?: unknown }>(request)
      if (!body) return errorJson(400, 'Body must be JSON')
      const vault = updateVault(id, { name: typeof body.name === 'string' ? body.name : undefined, readOnly: typeof body.readOnly === 'boolean' ? body.readOnly : undefined })
      await afterVaultChange()
      return json({ ...vaultsState(), vault: info(vault) })
    }
    if (request.method === 'DELETE') {
      removeVault(id)
      await afterVaultChange()
      return json(vaultsState())
    }
    return errorJson(405, 'Method not allowed')
  } catch (error) {
    if (error instanceof VaultError) return errorJson(error.status, error.message)
    return errorJson(500, 'Vault change failed', (error as Error).message)
  }
}

/** GET /api/themes[?source=]: theme folders found in content directories, with validation errors. */
export function handleThemes(url: URL): Response {
  const wanted = url.searchParams.get('source')
  const sources = getContentSources().filter((s) => !wanted || s.id === wanted)
  return json(sources.flatMap(discoverThemes))
}

/** POST /api/presentations {vault, name}: a new deck with a title slide, written by hand afterwards. */
export async function handleCreatePresentation(request: Request): Promise<Response> {
  const body = await readJson<{ vault?: unknown; name?: unknown }>(request)
  if (!body || typeof body.vault !== 'string' || typeof body.name !== 'string') return errorJson(400, 'Body must be JSON with "vault" and "name" strings')
  const title = body.name.replace(/-+/g, ' ').replace(/^\w/, (c) => c.toUpperCase())
  const result = await executeTool('create_presentation', { name: body.name, slides: [`<Slide>\n  <Title>${title}</Title>\n</Slide>`] }, { vault: body.vault })
  if (!result.success) return errorJson(400, result.error ?? 'Could not create the presentation')
  return json({ source: body.vault, path: body.name }, 201)
}
