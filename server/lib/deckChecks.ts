/**
 * `validate_deck` (UX overhaul U4): what an agent should fix before calling a deck done. Errors
 * stop the deck from compiling or from following the component registry; warnings point at
 * slides worth a screenshot.
 */
import { parseDeck } from '../../shared/deckParser.ts'
import { registryLanguageService } from '../../src/language-service/index.ts'
import { validateMdx } from './mdxValidator.ts'

import type { DeckProblem } from '../../shared/agent.ts'

export type { DeckProblem }

export interface DeckCheck {
  ok: boolean
  slideCount: number
  problems: DeckProblem[]
}

/** About how many characters of an 88 px display title fit on one line of a document slide. */
export const DOCUMENT_TITLE_CHARS = 46

let service: ReturnType<typeof registryLanguageService> | null = null

export async function checkDeck(source: string): Promise<DeckCheck> {
  const problems: DeckProblem[] = []
  const compiled = await validateMdx(source)
  if (!compiled.valid) problems.push({ severity: 'error', line: compiled.line, message: `Does not compile: ${compiled.message ?? 'unknown error'}` })

  let slides: ReturnType<typeof parseDeck>['slides'] = []
  try {
    slides = parseDeck(source).slides
  } catch (error) {
    if (compiled.valid) problems.push({ severity: 'error', message: `Cannot be split into slides: ${(error as Error).message}` })
  }
  const slideAt = (line: number) => slides.findIndex((s) => line >= s.line && line <= s.endLine)

  // Registry checks: raw HTML, unknown components and invalid values break the rules; an unknown
  // prop is ignored by the component, so it is a warning.
  service ??= registryLanguageService()
  for (const d of service.diagnostics(source)) {
    const line = d.range.start.line + 1
    const slide = slideAt(line)
    problems.push({ severity: d.code === 'unknown-prop' ? 'warning' : 'error', line, slide: slide >= 0 ? slide : undefined, message: d.message })
  }

  for (const s of slides) {
    const document = s.attrs.layout === 'document' || (typeof s.attrs.frame === 'string' && s.attrs.frame === 'content')
    if (document && s.titleText && s.titleText.length > DOCUMENT_TITLE_CHARS) {
      problems.push({
        severity: 'warning',
        line: s.line,
        slide: s.index,
        message: `The title "${s.titleText}" has ${s.titleText.length} characters and probably wraps; a document title is one line (about ${DOCUMENT_TITLE_CHARS}). Shorten it, then check with screenshot_slide.`,
      })
    }
  }
  problems.sort((a, b) => (a.severity === b.severity ? (a.line ?? 0) - (b.line ?? 0) : a.severity === 'error' ? -1 : 1))
  return { ok: !problems.some((p) => p.severity === 'error'), slideCount: slides.length, problems }
}
