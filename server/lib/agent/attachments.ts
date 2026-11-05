/**
 * Files dropped into a conversation (UX overhaul U5). An image for a deck goes into the deck's
 * `images/` folder, ready for a slide; anything else is kept in the vault's
 * `.slidecraft/attachments/` for the agent to read. Paths come back relative to the vault.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { extname, join, relative, sep } from 'node:path'
import type { ContentSource } from '../contentSources.ts'
import { resolveWritableDeckRefInSources } from '../decks.ts'
import { IMAGE_TYPES, sanitizeFilename, storeImage } from '../images.ts'

export const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024

export class AttachmentError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
  }
}

const vaultRelative = (vault: ContentSource, full: string) => relative(vault.path, full).split(sep).join('/')

export async function storeAttachment(vault: ContentSource, deckPath: string | undefined, file: { filename: string; contentType: string; data: Uint8Array }): Promise<{ path: string; image: boolean }> {
  if (vault.readOnly) throw new AttachmentError(403, `The vault "${vault.name}" is read-only`)
  if (file.data.length > MAX_ATTACHMENT_BYTES) throw new AttachmentError(413, 'The file is larger than 20 MB')
  const image = IMAGE_TYPES.includes(file.contentType)
  if (image && deckPath) {
    const writable = resolveWritableDeckRefInSources({ source: vault.id, path: deckPath })
    if ('error' in writable) throw new AttachmentError(400, 'Invalid presentation reference')
    const dir = join(writable.resolved.deckDir, 'images')
    const name = await storeImage(dir, file.filename, file.data)
    return { path: vaultRelative(vault, join(dir, name)), image: true }
  }
  const day = new Date().toISOString().slice(0, 10)
  const dir = join(vault.path, '.slidecraft', 'attachments', day)
  mkdirSync(dir, { recursive: true })
  const ext = extname(file.filename).toLowerCase().replace(/[^.a-z0-9]/g, '')
  const name = `${sanitizeFilename(file.filename.replace(/\.[^.]+$/, '')).slice(0, 60)}-${Date.now()}${ext}`
  writeFileSync(join(dir, name), file.data)
  return { path: vaultRelative(vault, join(dir, name)), image }
}
