/**
 * PDF export (Part 4 §9): the deck's `?pdf=1` view, rendered by headless Chrome from this server
 * and printed with one 16:9 page (20in × 11.25in = 1920 × 1080 CSS px) per visible slide.
 * All slides render in one page load, so there is nothing to merge.
 */
import { deckName, deckQuery, type DeckRef } from '../../shared/decks.ts'
import { findChrome, launchChrome } from './chrome.ts'
import { resolveDeckRefInSources } from './decks.ts'
import { readDeckSource } from './deckStore.ts'
import { ExportError } from './exportDeck.ts'

export const EXPORT_STYLE = `@page { size: 20in 11.25in; margin: 0 }
html, body, #root { width: 1920px !important; height: auto !important; overflow: visible !important; margin: 0 !important; background: #000 }
.deck-home-button { display: none !important }`

/** In the page: let effects settle, finish every running animation, wait for fonts and images. */
const SETTLE = `(async () => {
  const frame = () => new Promise((r) => requestAnimationFrame(() => r()))
  await new Promise((r) => setTimeout(r, 1200))
  for (let i = 0; i < 5; i++) { document.getAnimations().forEach((a) => { try { a.finish() } catch {} }); await frame() }
  await document.fonts.ready
  await Promise.all([...document.images].map((img) => img.complete ? null : new Promise((r) => { img.onload = img.onerror = r })))
  return true
})()`

export async function exportDeckPdf(ref: DeckRef, origin: string): Promise<{ pdf: Uint8Array; name: string; pages: number }> {
  const name = deckName(ref)
  const resolved = resolveDeckRefInSources(ref)
  if (!resolved || (await readDeckSource(resolved)) === null) throw new ExportError(`Presentation "${name}" not found`, 404)
  const chrome = findChrome()
  if (!chrome) throw new ExportError('No Chrome executable found. Set CHROME_PATH to enable PDF export.')

  const browser = await launchChrome(chrome)
  try {
    const page = await browser.newPage()
    await page.send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false })
    await page.send('Emulation.setEmulatedMedia', { media: 'screen', features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
    await page.send('Page.navigate', { url: `${origin}/${encodeURIComponent(name)}?${deckQuery(ref)}&pdf=1` })

    // Wait for the static PDF view (or an error screen) to appear.
    let count: number | null = null
    for (let i = 0; i < 300 && count === null; i++) {
      await new Promise((r) => setTimeout(r, 100))
      const state = await page
        .evaluate<{ count: number | null; error: string | null }>(
          `({ count: document.querySelector('[data-slidecraft-pdf-export]') ? Number(document.querySelector('[data-slidecraft-pdf-export]').dataset.slideCount) : null, error: document.querySelector('.error-panel__message')?.textContent ?? null })`,
        )
        .catch(() => ({ count: null, error: null }))
      if (state.error) throw new ExportError(`Could not render "${name}": ${state.error}`)
      count = state.count
    }
    if (count === null) throw new ExportError(`Timed out rendering "${name}"`)
    if (count === 0) throw new ExportError(`"${name}" has no slides to export`)

    await page.evaluate(`(() => { const s = document.createElement('style'); s.textContent = ${JSON.stringify(EXPORT_STYLE)}; document.head.appendChild(s); return true })()`)
    await page.evaluate(SETTLE)
    const { data } = await page.send<{ data: string }>('Page.printToPDF', {
      paperWidth: 20,
      paperHeight: 11.25,
      marginTop: 0,
      marginBottom: 0,
      marginLeft: 0,
      marginRight: 0,
      printBackground: true,
      preferCSSPageSize: true,
    })
    return { pdf: new Uint8Array(Buffer.from(data, 'base64')), name, pages: count }
  } finally {
    browser.close()
  }
}

/** Page count of a PDF, from its page objects (for checks; not a general parser). */
export const countPdfPages = (pdf: Uint8Array): number => (Buffer.from(pdf).toString('latin1').match(/\/Type\s*\/Page(?!s)/g) ?? []).length
