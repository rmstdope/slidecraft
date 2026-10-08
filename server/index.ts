/**
 * Slidecraft API server. Phase 0 bootstrap: health check, CORS and JSON 404s only.
 * Phase 5 adds content sources, the deck API, SSE, static serving and the file watcher.
 */
import { API_PORT, CLIENT_URL } from '../shared/ports.ts'

export const APP_ID = 'slidecraft'
export const VERSION = process.env.SLIDECRAFT_VERSION ?? 'dev'

function argValue(flag: string): string | undefined {
  const args = process.argv.slice(2)
  for (let i = 0; i < args.length; i++) {
    if (args[i] === flag) return args[i + 1]
    if (args[i].startsWith(`${flag}=`)) return args[i].slice(flag.length + 1)
  }
  return undefined
}

const PORT = Number(argValue('--port') ?? API_PORT)

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': CLIENT_URL,
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } })

export function router(request: Request): Response {
  const { pathname } = new URL(request.url)
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: { ...CORS_HEADERS, 'Access-Control-Max-Age': '86400' } })
  }
  if (pathname === '/api/health' && request.method === 'GET') {
    return json({ app: APP_ID, version: VERSION, port: PORT, pid: process.pid })
  }
  return json({ error: 'Not found' }, 404)
}

if (import.meta.main) {
  Bun.serve({ port: PORT, fetch: router, idleTimeout: 255 })
  console.log(`Slidecraft ${VERSION} API listening on http://localhost:${PORT}`)
}
