/** Writing exports to disk, shared by the CLI and the MCP tools. */
import { mkdirSync, writeFileSync } from 'node:fs'
import { isAbsolute, join, resolve } from 'node:path'
import { deckName, type DeckRef } from '../../shared/decks.ts'
import { getContentSource, getDefaultContentSource } from './contentSources.ts'
import { exportDeck } from './exportDeck.ts'
import { exportDeckPdf } from './exportPdf.ts'
import { PORT } from './paths.ts'

/** A deck ref from a name, optionally qualified by source id and path. */
export function exportRef(name: string, source?: string, path?: string): DeckRef {
  return { source: source || getDefaultContentSource().id, path: path || name }
}

/** Relative output folders are inside the deck's content folder, not wherever the process runs. */
function outputDir(ref: DeckRef, outDir = 'exports'): string {
  const root = getContentSource(ref.source)?.path ?? process.cwd()
  const dir = isAbsolute(outDir) ? outDir : resolve(root, outDir)
  mkdirSync(dir, { recursive: true })
  return dir
}

export async function writeHtmlExport(ref: DeckRef, outDir?: string): Promise<{ name: string; filePath: string; bytes: number }> {
  const { html, name } = await exportDeck(ref)
  const filePath = join(outputDir(ref, outDir), `${deckName(ref)}.html`)
  writeFileSync(filePath, html)
  return { name, filePath, bytes: Buffer.byteLength(html) }
}

/** PDF rendering needs the HTTP server running at `origin`. */
export async function writePdfExport(ref: DeckRef, outDir?: string, origin = `http://localhost:${PORT}`): Promise<{ name: string; filePath: string; bytes: number; pages: number }> {
  const { pdf, name, pages } = await exportDeckPdf(ref, origin)
  const filePath = join(outputDir(ref, outDir), `${deckName(ref)}.pdf`)
  writeFileSync(filePath, pdf)
  return { name, filePath, bytes: pdf.byteLength, pages }
}
