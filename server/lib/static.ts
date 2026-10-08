/** Static files (Part 4 §4.2): safe joins, content assets, and the built app with SPA fallback. */
import { resolve, sep } from 'node:path'
import { appFile } from './appFiles.ts'
import { corsHeaders, errorJson } from './http.ts'

/** Join a URL path onto a root; null when it escapes the root or is malformed. */
export function safeJoin(root: string, urlPath: string): string | null | 'bad-encoding' {
  let decoded: string
  try {
    decoded = decodeURIComponent(urlPath)
  } catch {
    return 'bad-encoding'
  }
  if (decoded.includes('\0')) return null
  const full = resolve(root, `./${decoded}`)
  return full === root || full.startsWith(root + sep) ? full : null
}

export async function serveFileFrom(root: string, urlPath: string, cacheControl = 'no-cache'): Promise<Response> {
  const path = safeJoin(root, urlPath)
  if (path === 'bad-encoding') return errorJson(400, 'Invalid path')
  if (!path) return errorJson(404, 'Not found')
  const file = Bun.file(path)
  if (!(await file.exists())) return errorJson(404, 'Not found')
  return new Response(file, { headers: { 'Cache-Control': cacheControl, ...corsHeaders } })
}

/** The built frontend: dist/ (hashed assets cached forever), then public/, then index.html for routes. */
export async function serveAppFile(pathname: string): Promise<Response | null> {
  let decoded: string
  try {
    decoded = decodeURIComponent(pathname)
  } catch {
    return errorJson(400, 'Invalid path')
  }
  if (decoded.includes('..') || decoded.includes('\0')) return null
  if (decoded !== '/') {
    const fromDist = appFile(`dist${decoded}`)
    if (fromDist) return new Response(fromDist, { headers: { 'Cache-Control': decoded.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache' } })
    const fromPublic = appFile(`public${decoded}`)
    if (fromPublic) return new Response(fromPublic, { headers: { 'Cache-Control': 'no-cache' } })
  }
  if (!decoded.slice(1).includes('.')) {
    const index = appFile('dist/index.html')
    if (index) return new Response(index, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' } })
  }
  return null
}
