/** Image uploads and listings (Part 4 §5 Images). sharp is optional: without it files are stored as-is. */
import { existsSync } from 'node:fs'
import { mkdir, readdir, stat, unlink, writeFile } from 'node:fs/promises'
import { extname, join } from 'node:path'

export const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp']
export const LISTED_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg']
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024

export interface ImageInfo {
  name: string
  path: string
  size: number
  modified: number
}

export function sanitizeFilename(name: string): string {
  const cleaned = name
    .toLowerCase()
    .replace(/[^a-z0-9 -]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  return cleaned || 'image'
}

type SharpModule = typeof import('sharp')
let sharpPromise: Promise<SharpModule | null> | undefined
let warned = false

function loadSharp(): Promise<SharpModule | null> {
  sharpPromise ??= import('sharp').then((m) => (m.default ?? m) as unknown as SharpModule).catch(() => null)
  return sharpPromise
}

/** Resize to at most 1920 px wide as WebP when sharp is available; otherwise keep the bytes. */
export async function storeImage(dir: string, originalName: string, data: Uint8Array): Promise<string> {
  await mkdir(dir, { recursive: true })
  const base = `${sanitizeFilename(originalName.replace(/\.[^.]+$/, ''))}-${Date.now()}`
  const sharp = await loadSharp()
  if (sharp) {
    try {
      const out = await (sharp as unknown as (input: Uint8Array) => { resize: (o: object) => { webp: (o: object) => { toBuffer: () => Promise<Buffer> } } })(data)
        .resize({ width: 1920, withoutEnlargement: true })
        .webp({ quality: 85 })
        .toBuffer()
      const file = `${base}.webp`
      await writeFile(join(dir, file), out)
      return file
    } catch (error) {
      console.warn(`Could not convert ${originalName} (${(error as Error).message}); storing it unchanged.`)
    }
  } else if (!warned) {
    console.warn('sharp is not available: uploaded images are stored without resizing.')
    warned = true
  }
  const file = `${base}${extname(originalName).toLowerCase() || '.png'}`
  await writeFile(join(dir, file), data)
  return file
}

export async function listImages(dir: string, urlPrefix: string): Promise<ImageInfo[]> {
  if (!existsSync(dir)) return []
  const out: ImageInfo[] = []
  for (const name of await readdir(dir)) {
    if (!LISTED_EXTENSIONS.includes(extname(name).toLowerCase())) continue
    const info = await stat(join(dir, name))
    if (info.isFile()) out.push({ name, path: `${urlPrefix}/${name}`, size: info.size, modified: info.mtimeMs })
  }
  return out.sort((a, b) => b.modified - a.modified)
}

export const removeImage = (file: string) => unlink(file)
