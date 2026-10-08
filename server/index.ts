/**
 * Slidecraft server (Part 4 §3–6): the deck API, content sources, themes, images, SSE, static
 * files for the built app, and the file watcher. One process, a hand-written router.
 */
import { syncFolderInstructions } from './lib/agentContext.ts'
import { getContentDir, getContentSource, getContentSources, getDefaultContentSource, getLibraryDir } from './lib/contentSources.ts'
import { eventsResponse } from './lib/events.ts'
import { startFileWatcher } from './lib/fileWatcher.ts'
import { errorJson, json, preflight } from './lib/http.ts'
import { APP_ID, DIST_DIR, hasFlag, IS_BUNDLED, PORT, VERSION } from './lib/paths.ts'
import { serveAppFile, serveFileFrom } from './lib/static.ts'
import { handleApplyFix } from './routes/applyFix.ts'
import { handleContents, handlePresentations, handleThemes } from './routes/content.ts'
import { handleDeleteImage, handleListImages, handleUpload } from './routes/images.ts'
import { handleMdx } from './routes/mdx.ts'
import { existsSync } from 'node:fs'

export { APP_ID, VERSION }

const notYet = (phase: number) => errorJson(501, `Not implemented yet (plan Phase ${phase})`)

export async function router(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const { pathname } = url
  const method = request.method

  if (method === 'OPTIONS') return preflight()
  if (pathname.startsWith('/api/mdx/')) return handleMdx(request, url)
  if (method === 'POST' && /^\/api\/export\/[^/]+\/pdf$/.test(pathname)) return notYet(9)
  if (method === 'POST' && pathname.startsWith('/api/export/')) return notYet(9)
  if (method === 'GET' && pathname === '/api/events') return eventsResponse()
  if (method === 'GET' && pathname === '/api/health') {
    const source = getDefaultContentSource()
    return json({ app: APP_ID, version: VERSION, port: PORT, contentDir: source.path, contentName: source.builtIn ? null : source.id, pid: process.pid })
  }
  if (method === 'GET' && pathname === '/api/presentations') return handlePresentations(url)
  if (pathname === '/api/contents') return handleContents(request)
  if (method === 'GET' && pathname === '/api/themes') return handleThemes(url)
  if (method === 'POST' && pathname === '/api/chat') return notYet(10)
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
  if (method === 'GET' && pathname.startsWith('/content/')) return serveFileFrom(getContentDir(), pathname.slice('/content/'.length))
  if (method === 'GET' && pathname.startsWith('/images/library/')) return serveFileFrom(getLibraryDir(), pathname.slice('/images/library/'.length))
  if (method === 'GET') return (await serveAppFile(pathname)) ?? errorJson(404, 'Not found')
  return errorJson(404, 'Not found')
}

async function main() {
  if (hasFlag('--contents')) {
    const named = getContentSources().filter((s) => !s.builtIn)
    if (named.length === 0) console.log('No named content directories. Add them to the config file, e.g. { "contents": { "mine": "~/decks" } }')
    for (const s of named) console.log(`${s.id}\t${s.path}`)
    process.exit(0)
  }
  const key = process.env.AI_API_KEY
  console.log(key ? `AI_API_KEY: ${key.slice(0, 8)}…${key.slice(-4)}` : 'AI_API_KEY is not set: the HTTP chat provider is unavailable (CLI providers still work).')
  const source = getDefaultContentSource()
  console.log(`Slidecraft ${VERSION}`)
  console.log(`Content directory: ${source.path}${source.builtIn ? '' : ` (${source.id})`}`)
  await startFileWatcher()
  const sync = await syncFolderInstructions(PORT)
  if (sync === 'written') console.log(`Wrote AGENTS.md in ${source.path}`)
  if (sync === 'hand-written') console.log(`Keeping the hand-written AGENTS.md in ${source.path}`)
  console.log(IS_BUNDLED ? 'Serving the embedded app' : existsSync(DIST_DIR) ? 'Serving the built app from dist/' : 'No dist/: use `bun run dev` for the app, or `bun run build` first')
  Bun.serve({ port: PORT, fetch: router, idleTimeout: 255 })
  console.log(`Listening on http://localhost:${PORT}`)
}

if (import.meta.main) await main()
