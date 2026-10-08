/** Presentations, content sources and themes (Part 4 §5; themes from plan Phase 4b). */
import type { ContentSourceInfo } from '../../shared/decks.ts'
import { getContentSources, getDefaultContentSource, setContentByName } from '../lib/contentSources.ts'
import { discoverPresentations } from '../lib/decks.ts'
import { restartFileWatcher } from '../lib/fileWatcher.ts'
import { errorJson, json, readJson } from '../lib/http.ts'
import { CONFIG_FILE, PORT } from '../lib/paths.ts'
import { discoverThemes } from '../lib/themes.ts'
import { syncFolderInstructions } from '../lib/agentContext.ts'

export async function handlePresentations(url: URL): Promise<Response> {
  try {
    const source = url.searchParams.get('source') ?? undefined
    const path = url.searchParams.get('path') ?? undefined
    return json(await discoverPresentations({ source, path }))
  } catch (error) {
    return errorJson(500, 'Failed to list presentations', (error as Error).message)
  }
}

const info = ({ id, path, include, readOnly, builtIn }: ContentSourceInfo): ContentSourceInfo => ({ id, path, include, readOnly, builtIn })

function contentsState() {
  const current = getDefaultContentSource()
  const sources = getContentSources()
  return {
    current: { ...info(current), name: current.builtIn ? null : current.id, dir: current.path },
    sources: sources.map(info),
    options: sources.map((s) => ({ name: s.id, dir: s.path })),
    configFile: CONFIG_FILE,
  }
}

export async function handleContents(request: Request): Promise<Response> {
  if (request.method === 'GET') return json(contentsState())
  if (request.method === 'POST') {
    const body = await readJson<{ name?: unknown }>(request)
    if (!body || typeof body.name !== 'string') return errorJson(400, 'Body must be JSON with a "name" string')
    if (!setContentByName(body.name)) return errorJson(404, `No content directory named "${body.name}"`)
    await restartFileWatcher()
    await syncFolderInstructions(PORT)
    return json(contentsState())
  }
  return errorJson(405, 'Method not allowed')
}

/** GET /api/themes[?source=]: theme folders found in content directories, with validation errors. */
export function handleThemes(url: URL): Response {
  const wanted = url.searchParams.get('source')
  const sources = getContentSources().filter((s) => !wanted || s.id === wanted)
  return json(sources.flatMap(discoverThemes))
}
