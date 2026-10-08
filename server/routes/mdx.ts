/** GET/PUT /api/mdx/:name[?source&path] (Part 4 §5). */
import { decodeName } from './util.ts'
import { deckRefFromUrl, resolveDeckRefInSources, resolveWritableDeckRefInSources } from '../lib/decks.ts'
import { readDeckSource, writeDeckSource } from '../lib/deckStore.ts'
import { errorJson, json, readJson, readOnlyError } from '../lib/http.ts'

export async function handleMdx(request: Request, url: URL): Promise<Response> {
  const name = decodeName(url.pathname.slice('/api/mdx/'.length))
  if (name === null) return errorJson(400, 'Invalid presentation reference')
  const ref = deckRefFromUrl(url, name)

  if (request.method === 'GET') {
    const resolved = resolveDeckRefInSources(ref)
    if (!resolved) return errorJson(400, 'Invalid presentation reference')
    const content = await readDeckSource(resolved)
    if (content === null) return errorJson(404, 'Presentation not found')
    return json({ content, deck: ref, readOnly: resolved.source.readOnly })
  }

  if (request.method === 'PUT') {
    const writable = resolveWritableDeckRefInSources(ref)
    if ('error' in writable) return writable.error === 'read-only' ? readOnlyError(ref.source) : errorJson(400, 'Invalid presentation reference')
    const body = await readJson<{ content?: unknown }>(request)
    if (typeof body?.content !== 'string') return errorJson(400, 'Content must be a string')
    try {
      await writeDeckSource(ref, writable.resolved, body.content)
      return json({ success: true })
    } catch (error) {
      return errorJson(500, 'Failed to save file', (error as Error).message)
    }
  }
  return errorJson(405, 'Method not allowed')
}
