/** Reading and validated writing of deck files, shared by routes, chat tools and MCP. */
import { existsSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { findSlideAtLine, findSlideAtLineByScan, parseDeck } from '../../shared/deckParser.ts'
import type { DeckRef } from '../../shared/decks.ts'
import type { ResolvedDeck } from './decks.ts'
import { notifyPresentation } from './events.ts'
import { noteOwnWrite } from './fileWatcher.ts'
import { formatValidationError, validateMdx } from './mdxValidator.ts'

export const readDeckSource = async (resolved: ResolvedDeck): Promise<string | null> =>
  existsSync(resolved.mdxPath) ? readFile(resolved.mdxPath, 'utf8') : null

export interface SaveOptions {
  /** The slide the change touched, so a failing slide elsewhere is reported as pre-existing. */
  changedSlide?: number
  created?: boolean
}

export type SaveResult = { ok: true } | { ok: false; error: string; line?: number; column?: number; slideIndex?: number }

/** Compile-check the whole file, then write it and broadcast. Nothing is written when invalid. */
export async function saveValidatedDeck(ref: DeckRef, resolved: ResolvedDeck, source: string, options: SaveOptions = {}): Promise<SaveResult> {
  const result = await validateMdx(source)
  if (!result.valid) {
    let error = `Validation failed - the change would create invalid MDX.\n${formatValidationError(result)}`
    let slideIndex: number | undefined
    let slideText: string | undefined
    if (result.line) {
      try {
        const deck = parseDeck(source)
        slideIndex = findSlideAtLine(deck, result.line).slideIndex
        slideText = deck.slides[slideIndex]?.text
      } catch {
        slideIndex = findSlideAtLineByScan(source, result.line) // the structure itself is broken
      }
      if (slideIndex !== undefined && slideIndex >= 0) {
        error += `\nError is in slide ${slideIndex} (0-indexed).`
        if (options.changedSlide !== undefined && slideIndex !== options.changedSlide) {
          error += `\nNOTE: this error is PRE-EXISTING in slide ${slideIndex}, not in the slide you changed. Fix that slide first.`
          if (slideText) error += `\n\`\`\`mdx\n${slideText}\n\`\`\``
        }
      } else slideIndex = undefined
    }
    return { ok: false, error, line: result.line, column: result.column, slideIndex }
  }
  await writeDeckSource(ref, resolved, source, options.created)
  return { ok: true }
}

/** Write without validation (editor saves keep whatever the author typed) and broadcast. */
export async function writeDeckSource(ref: DeckRef, resolved: ResolvedDeck, source: string, created = false): Promise<void> {
  await writeFile(resolved.mdxPath, source)
  noteOwnWrite(resolved.mdxPath, ref)
  notifyPresentation(created ? 'presentation-created' : 'presentation-updated', ref)
}
