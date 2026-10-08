/**
 * Export a deck from the command line (Part 4 §8.2):
 *
 *   bun run export --name <deck> [--source <id>] [--path <p>] [--out <dir>] [--content <dir>]
 *   bun run export --name <deck> --pdf [--origin http://localhost:6110]   (needs the server running)
 *   bun run export --list
 */
import { discoverPresentations } from '../server/lib/decks.ts'
import { exportRef, writeHtmlExport, writePdfExport } from '../server/lib/exportFiles.ts'
import { argValue, hasFlag } from '../server/lib/paths.ts'

const kb = (bytes: number) => `${(bytes / 1024).toFixed(0)} KB`

if (hasFlag('--list')) {
  for (const deck of await discoverPresentations()) console.log(`${deck.source}\t${deck.path}`)
  process.exit(0)
}

const name = argValue('--name')
if (!name || hasFlag('--help')) {
  console.log('Usage: bun run export --name <deck> [--source <id>] [--path <p>] [--out <dir>] [--pdf [--origin <url>]] | --list')
  process.exit(name ? 0 : 1)
}

const ref = exportRef(name, argValue('--source'), argValue('--path'))
try {
  if (hasFlag('--pdf')) {
    const result = await writePdfExport(ref, argValue('--out'), argValue('--origin'))
    console.log(`Wrote ${result.filePath} (${result.pages} pages, ${kb(result.bytes)})`)
  } else {
    const result = await writeHtmlExport(ref, argValue('--out'))
    console.log(`Wrote ${result.filePath} (${kb(result.bytes)})`)
  }
} catch (error) {
  console.error(`Export failed: ${(error as Error).message}`)
  process.exit(1)
}
