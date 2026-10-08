#!/usr/bin/env node
/**
 * Shrink images for decks (Part 4 §10.7): one file or a whole folder, resized without enlarging,
 * re-encoded, with the savings printed.
 *
 *   node scripts/process-images.mjs <input> <output> [--width 1920] [--quality 85] [--format webp|png|jpg]
 */
import { mkdirSync, readdirSync, statSync } from 'node:fs'
import { basename, extname, join } from 'node:path'
import sharp from 'sharp'

const args = process.argv.slice(2)
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? args[i + 1] : fallback
}
const [input, output] = args.filter((a, i) => !a.startsWith('--') && !args[i - 1]?.startsWith('--'))
if (!input || !output) {
  console.error('Usage: node scripts/process-images.mjs <input> <output> [--width 1920] [--quality 85] [--format webp|png|jpg]')
  process.exit(1)
}
const width = Number(flag('width', 1920))
const quality = Number(flag('quality', 85))
const format = flag('format', 'webp')
const IMAGE = /\.(png|jpe?g|webp|avif|gif|tiff?)$/i

/** File names become lower-case words joined by dashes. */
const safeName = (file) =>
  basename(file, extname(file))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'image'

const kb = (bytes) => `${(bytes / 1024).toFixed(0)} KB`

async function convert(source, target) {
  const before = statSync(source).size
  const info = await sharp(source).resize({ width, withoutEnlargement: true }).toFormat(format === 'jpg' ? 'jpeg' : format, { quality }).toFile(target)
  console.log(`${basename(source)} → ${basename(target)}: ${kb(before)} → ${kb(info.size)}`)
  return { before, after: info.size }
}

const inputIsDir = statSync(input).isDirectory()
const sources = inputIsDir ? readdirSync(input).filter((f) => IMAGE.test(f)).map((f) => join(input, f)) : [input]
let before = 0
let after = 0
if (inputIsDir) mkdirSync(output, { recursive: true })
for (const source of sources) {
  const target = inputIsDir ? join(output, `${safeName(source)}.${format}`) : output
  const r = await convert(source, target)
  before += r.before
  after += r.after
}
if (sources.length > 1) console.log(`Total: ${kb(before)} → ${kb(after)} (${Math.round((1 - after / before) * 100)}% smaller)`)
