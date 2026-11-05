/**
 * Slidecraft server (Part 4 §3–6): the deck API, content sources, themes, images, SSE, static
 * files for the built app, and the file watcher. One process, a hand-written router.
 */
import { syncAllFolderInstructions } from './lib/agentContext.ts'
import { syncSkillsToVaults } from './lib/skillSync.ts'
import { getBuiltInSource, getContentDir, getContentSource, getContentSources, getDefaultContentSource, getLibraryDir, persistMigratedConfig } from './lib/contentSources.ts'
import { eventsResponse } from './lib/events.ts'
import { startFileWatcher } from './lib/fileWatcher.ts'
import { errorJson, json, preflight } from './lib/http.ts'
import { APP_ID, DIST_DIR, hasFlag, IS_BUNDLED, PORT, VERSION } from './lib/paths.ts'
import { serveAppFile, serveFileFrom } from './lib/static.ts'
import { handleApplyFix } from './routes/applyFix.ts'
import { handleAgent } from './routes/agent.ts'
import { handleChat } from './routes/chat.ts'
import { handleExport } from './routes/export.ts'
import { handleCreatePresentation, handlePresentations, handleThemes, handleVaults } from './routes/content.ts'
import { handleDeleteImage, handleListImages, handleUpload } from './routes/images.ts'
import { handleMdx } from './routes/mdx.ts'
import { existsSync } from 'node:fs'

export { APP_ID, VERSION }


export async function router(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const { pathname } = url
  const method = request.method

  if (method === 'OPTIONS') return preflight()
  if (pathname.startsWith('/api/mdx/')) return handleMdx(request, url)
  if (method === 'POST' && pathname.startsWith('/api/export/')) return handleExport(url)
  if (method === 'GET' && pathname === '/api/events') return eventsResponse()
  if (method === 'GET' && pathname === '/api/health') {
    const source = getDefaultContentSource()
    return json({ app: APP_ID, version: VERSION, port: PORT, contentDir: source.path, contentName: source.builtIn ? null : source.id, vault: source.id, pid: process.pid })
  }
  if (method === 'GET' && pathname === '/api/presentations') return handlePresentations(url)
  if (method === 'POST' && pathname === '/api/presentations') return handleCreatePresentation(request)
  if (pathname === '/api/vaults' || pathname.startsWith('/api/vaults/')) return handleVaults(request, url)
  if (method === 'GET' && pathname === '/api/themes') return handleThemes(url)
  if (pathname.startsWith('/api/agent/')) return handleAgent(request, url)
  if (method === 'POST' && pathname === '/api/chat') return handleChat(request)
  if (method === 'POST' && pathname === '/api/apply-fix') return handleApplyFix(request)
  if (method === 'POST' && (pathname === '/api/images/upload' || pathname === '/api/images')) return handleUpload(request)
  if (method === 'DELETE' && pathname === '/api/images') return handleDeleteImage(request)
  if (method === 'GET' && pathname.startsWith('/api/images/')) return handleListImages(url)
  if (pathname.startsWith('/api/')) return errorJson(404, 'Not found')

  if (method === 'GET' && pathname.startsWith('/content-source/')) {
    const [sourceSegment, ...rest] = pathname.slice('/content-source/'.length).split('/')
    let sourceId: string
    try {
      sourceId = decodeURIComponent(sourceSegment)
    } catch {
      return errorJson(400, 'Invalid path')
    }
    const source = getContentSource(sourceId)
    if (!source) return errorJson(404, 'Unknown content source')
    return serveFileFrom(source.path, rest.join('/'))
  }
  // /content/ is the repository's examples in a checkout (as Vite bundles them), else the default vault.
  if (method === 'GET' && pathname.startsWith('/content/')) return serveFileFrom(getBuiltInSource()?.path ?? getContentDir(), pathname.slice('/content/'.length))
  if (method === 'GET' && pathname.startsWith('/images/library/')) return serveFileFrom(getLibraryDir(), pathname.slice('/images/library/'.length))
  if (method === 'GET') return (await serveAppFile(pathname)) ?? errorJson(404, 'Not found')
  return errorJson(404, 'Not found')
}

async function main() {
  // The release binary doubles as the MCP server (agents in the app start it this way).
  if (hasFlag('--mcp')) {
    const { runMcpServer } = await import('./mcp.ts')
    return runMcpServer()
  }
  if (hasFlag('--contents') || hasFlag('--vaults')) {
    for (const s of getContentSources()) console.log(`${s.id}\t${s.name}\t${s.path}${s.readOnly ? '\t(read-only)' : ''}${s.temporary ? '\t(this run only)' : ''}`)
    process.exit(0)
  }
  if (persistMigratedConfig()) console.log('Moved the content folders in the config file to vaults (the old file is kept as config.json.bak)')
  const key = process.env.AI_API_KEY
  console.log(key ? `AI_API_KEY: ${key.slice(0, 8)}…${key.slice(-4)}` : 'AI_API_KEY is not set: the HTTP chat provider is unavailable (CLI providers still work).')
  console.log(`Slidecraft ${VERSION}`)
  for (const s of getContentSources()) console.log(`Vault ${s.name} (${s.id}): ${s.path}${s.readOnly ? ', read-only' : ''}${s.temporary ? ', this run only' : ''}`)
  await startFileWatcher()
  for (const [s, sync] of await syncAllFolderInstructions(PORT)) {
    if (sync === 'written') console.log(`Wrote AGENTS.md in ${s.path}`)
  }
  for (const [s, sync] of syncSkillsToVaults()) {
    if (sync === 'written') console.log(`Wrote the slidecraft-presentations skill in ${s.path}`)
    if (sync === 'hand-edited') console.log(`Keeping the edited slidecraft-presentations skill in ${s.path}`)
  }
  console.log(IS_BUNDLED ? 'Serving the embedded app' : existsSync(DIST_DIR) ? 'Serving the built app from dist/' : 'No dist/: use `bun run dev` for the app, or `bun run build` first')
  Bun.serve({ port: PORT, fetch: router, idleTimeout: 255 })
  console.log(`Listening on http://localhost:${PORT}`)
}

if (import.meta.main) await main()
