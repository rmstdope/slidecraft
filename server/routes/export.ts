/** POST /api/export/:name and /api/export/:name/pdf (Part 4 §5). */
import { decodeName } from './util.ts'
import { deckRefFromUrl } from '../lib/decks.ts'
import { exportDeck, ExportError } from '../lib/exportDeck.ts'
import { exportDeckPdf } from '../lib/exportPdf.ts'
import { errorJson, json } from '../lib/http.ts'

const failure = (label: string, error: unknown) => {
  const message = (error as Error).message
  const status = error instanceof ExportError ? error.status : /not found/i.test(message) ? 404 : 500
  return errorJson(status, label, message)
}

export async function handleExport(url: URL): Promise<Response> {
  const pdf = url.pathname.endsWith('/pdf')
  const segment = url.pathname.slice('/api/export/'.length).replace(/\/pdf$/, '')
  const name = decodeName(segment)
  if (name === null || name.includes('/')) return errorJson(400, 'Invalid presentation name')
  const ref = deckRefFromUrl(url, name)
  if (!pdf) {
    try {
      return json(await exportDeck(ref))
    } catch (error) {
      return failure('Export failed', error)
    }
  }
  try {
    const result = await exportDeckPdf(ref, url.origin)
    return new Response(new Blob([result.pdf as Uint8Array<ArrayBuffer>]), {
      headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${result.name}.pdf"`, 'Access-Control-Allow-Origin': '*' },
    })
  } catch (error) {
    return failure('PDF export failed', error)
  }
}
