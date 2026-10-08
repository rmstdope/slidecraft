#!/usr/bin/env node
/**
 * Favicons and app icons from one source image (Part 4 §10.7), written into public/:
 * 16–128 px favicons, a 180 px apple-touch-icon and 192/512 px Android icons.
 *
 *   node scripts/generate-favicons.mjs [source=public/favicon.svg]
 */
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import sharp from 'sharp'

const source = process.argv[2] ?? 'public/favicon.svg'
const out = 'public'
const outputs = [
  ...[16, 32, 48, 64, 128].map((size) => ({ size, file: `favicon-${size}.png` })),
  { size: 180, file: 'apple-touch-icon.png', background: '#111111' },
  { size: 192, file: 'android-chrome-192.png', background: '#111111' },
  { size: 512, file: 'android-chrome-512.png', background: '#111111' },
]

mkdirSync(out, { recursive: true })
for (const { size, file, background } of outputs) {
  let image = sharp(source, { density: Math.max(72, size * 4) }).resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  if (background) image = image.flatten({ background })
  await image.png().toFile(join(out, file))
  console.log(`${file} (${size}×${size})`)
}
