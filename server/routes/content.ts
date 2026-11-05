/** Presentations, vaults and themes (Part 4 §5; themes from plan Phase 4b). */
import type { ContentSourceInfo } from '../../shared/decks.ts'
import { addVault, configFilePath, getContentSources, getDefaultContentSource, removeVault, rememberVault, updateVault, VaultError } from '../lib/contentSources.ts'
import { discoverPresentations } from '../lib/decks.ts'
import { executeTool } from '../lib/tools.ts'
import { restartFileWatcher } from '../lib/fileWatcher.ts'
import { errorJson, json, readJson } from '../lib/http.ts'
import { PORT } from '../lib/paths.ts'
import { discoverThemes } from '../lib/themes.ts'
import { syncAllFolderInstructions } from '../lib/agentContext.ts'
import { syncSkillsToVaults } from '../lib/skillSync.ts'

export async function handlePresentations(url: URL): Promise<Response> {
  try {
    const source = url.searchParams.get('source') ?? undefined
    const path = url.searchParams.get('path') ?? undefined
    return json(await discoverPresentations({ source, path }))
  } catch (error) {
    return errorJson(500, 'Failed to list presentations', (error as Error).message)
  }
}

const info = ({ id, name, path, include, readOnly, builtIn, temporary }: ContentSourceInfo): ContentSourceInfo => ({ id, name, path, include, readOnly, builtIn, temporary })

function vaultsState() {
  return { vaults: getContentSources().map(info), defaultVault: getDefaultContentSource().id, configFile: configFilePath() }
}

async function afterVaultChange(): Promise<void> {
  await restartFileWatcher()
  await syncAllFolderInstructions(PORT)
  syncSkillsToVaults()
}

/**
 * Vaults (UX overhaul U1):
 * GET /api/vaults · POST /api/vaults {name, path, readOnly?, create?} ·
 * PATCH /api/vaults/<id> {name?, readOnly?} · DELETE /api/vaults/<id> (files stay) ·
 * POST /api/vaults/<id>/open (remember it as the last vault).
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
