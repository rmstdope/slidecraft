/** POST /api/apply-fix: replace one slide with user-supplied MDX, bypassing the AI (Part 5 §A.5). */
import { findSlideAtLineByScan, parseDeck, replaceSlide } from '../../shared/deckParser.ts'
import type { DeckRef } from '../../shared/decks.ts'
import { legacyDeckRef, resolveWritableDeckRefInSources } from '../lib/decks.ts'
import { readDeckSource, writeDeckSource } from '../lib/deckStore.ts'
import { errorJson, json, readJson, readOnlyError } from '../lib/http.ts'
import { formatValidationError, validateMdx } from '../lib/mdxValidator.ts'

export async function handleApplyFix(request: Request): Promise<Response> {
  const body = await readJson<{ presentationName?: unknown; deck?: DeckRef; slideIndex?: unknown; content?: unknown }>(request)
  const name = body?.presentationName
  if (typeof name !== 'string' || name === '' || name.includes('..')) return errorJson(400, 'Missing or invalid presentationName')
  if (typeof body?.slideIndex !== 'number' || body.slideIndex < 0) return errorJson(400, 'slideIndex must be a number >= 0')
  if (typeof body.content !== 'string' || body.content.trim() === '') return errorJson(400, 'content must not be empty')
  const ref = body.deck && typeof body.deck.source === 'string' && typeof body.deck.path === 'string' ? body.deck : legacyDeckRef(name)
  const writable = resolveWritableDeckRefInSources(ref)
  if ('error' in writable) return writable.error === 'read-only' ? readOnlyError(ref.source) : errorJson(400, 'Invalid presentation reference')
  const source = await readDeckSource(writable.resolved)
  if (source === null) return errorJson(404, 'Presentation not found')
  let deck
  try {
    deck = parseDeck(source)
  } catch (error) {
    return errorJson(400, 'The presentation could not be parsed', (error as Error).message)
  }
  if (body.slideIndex >= deck.slides.length) return errorJson(400, `slideIndex ${body.slideIndex} out of range (0-${deck.slides.length - 1})`)
  const next = replaceSlide(deck, body.slideIndex, body.content)
  const result = await validateMdx(next)
  if (!result.valid) {
    let message = formatValidationError(result)
    const at = result.line ? findSlideAtLineByScan(next, result.line) : -1
    if (at >= 0 && at !== body.slideIndex) message += `\nError appears to be in slide ${at}, not the slide you're editing.`
    return json({ success: false, error: 'Validation failed', validationError: { message, line: result.line, column: result.column } })
  }
  await writeDeckSource(ref, writable.resolved, next)
  return json({ success: true })
}
