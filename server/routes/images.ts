/** Image upload, listing and deletion (Part 4 §5 Images). */
import { join } from 'node:path'
import type { DeckRef } from '../../shared/decks.ts'
import { getDefaultContentSource, getLibraryDir } from '../lib/contentSources.ts'
import { resolveDeckFile, resolveDeckRefInSources, resolveWritableDeckRefInSources } from '../lib/decks.ts'
import { errorJson, json, readJson, readOnlyError } from '../lib/http.ts'
import { IMAGE_TYPES, listImages, MAX_UPLOAD_BYTES, removeImage, storeImage } from '../lib/images.ts'
import { boundaryOf, parseMultipart } from '../lib/multipart.ts'
import { safeJoin } from '../lib/static.ts'
import { decodeName } from './util.ts'

export async function handleUpload(request: Request): Promise<Response> {
  const contentType = request.headers.get('content-type')
  if (!contentType?.includes('multipart/form-data')) return errorJson(400, 'Expected multipart/form-data')
  if (Number(request.headers.get('content-length') ?? 0) > MAX_UPLOAD_BYTES) return errorJson(413, 'Image is larger than 10 MB')
  const boundary = boundaryOf(contentType)
  if (!boundary) return errorJson(400, 'Missing multipart boundary')
  const body = new Uint8Array(await request.arrayBuffer())
  if (body.length > MAX_UPLOAD_BYTES) return errorJson(413, 'Image is larger than 10 MB')
  const { fields, files } = parseMultipart(body, boundary)
  const file = files.file
  if (!file) return errorJson(400, 'Missing file')
  if (!IMAGE_TYPES.includes(file.contentType)) return errorJson(400, `Unsupported image type ${file.contentType}`)
  const storage = fields.storage ?? 'library'
  try {
    if (storage === 'library') {
      const name = await storeImage(getLibraryDir(), file.filename, file.data)
      return json({ path: `/images/library/${name}` })
    }
    if (storage !== 'presentation') return errorJson(400, 'storage must be "library" or "presentation"')
    if (!fields.presentation && !fields.path) return errorJson(400, 'Missing presentation')
    const ref: DeckRef = { source: fields.source || getDefaultContentSource().id, path: fields.path || fields.presentation }
    const writable = resolveWritableDeckRefInSources(ref)
    if ('error' in writable) return writable.error === 'read-only' ? readOnlyError(ref.source) : errorJson(400, 'Invalid presentation reference')
    const name = await storeImage(join(writable.resolved.deckDir, 'images'), file.filename, file.data)
    return json({ path: `./images/${name}` })
  } catch (error) {
    return errorJson(500, 'Upload failed', (error as Error).message)
  }
}

export async function handleListImages(url: URL): Promise<Response> {
  const name = decodeName(url.pathname.slice('/api/images/'.length))
  if (name === 'library') return json({ images: await listImages(getLibraryDir(), '/images/library') })
  if (name === null) return errorJson(400, 'Invalid presentation reference')
  const resolved = resolveDeckRefInSources({ source: url.searchParams.get('source') || getDefaultContentSource().id, path: url.searchParams.get('path') || name })
  if (!resolved) return errorJson(400, 'Invalid presentation reference')
  return json({ images: await listImages(join(resolved.deckDir, 'images'), './images') })
}

export async function handleDeleteImage(request: Request): Promise<Response> {
  const body = await readJson<{ path?: unknown; source?: unknown; deckPath?: unknown }>(request)
  const path = body?.path
  if (typeof path !== 'string' || path === '' || path.includes('..')) return errorJson(400, 'Invalid path')
  try {
    if (path.startsWith('library/') || path.startsWith('/images/library/')) {
      const file = safeJoin(getLibraryDir(), path.replace(/^\/?(images\/)?library\//, ''))
      if (!file || file === 'bad-encoding') return errorJson(400, 'Invalid path')
      await removeImage(file)
      return json({ success: true })
    }
    let ref: DeckRef
    let relative: string
    if (typeof body?.source === 'string' && typeof body.deckPath === 'string') {
      ref = { source: body.source, path: body.deckPath }
      relative = path.replace(/^\.\//, '')
    } else {
      const [first, ...rest] = path.replace(/^\/+/, '').split('/')
      ref = { source: getDefaultContentSource().id, path: first }
      relative = rest.join('/')
    }
    const writable = resolveWritableDeckRefInSources(ref)
    if ('error' in writable) return writable.error === 'read-only' ? readOnlyError(ref.source) : errorJson(400, 'Invalid presentation reference')
    const file = resolveDeckFile(writable.resolved, relative)
    if (!file) return errorJson(400, 'Invalid path')
    await removeImage(file)
    return json({ success: true })
  } catch (error) {
    return errorJson(500, 'Delete failed', (error as Error).message)
  }
}
