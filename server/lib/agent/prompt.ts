/**
 * What the in-app agent is told (UX overhaul U4): standing instructions that point at the
 * presentations skill and carry the vault's house style, and per-message context about the deck
 * on screen.
 */
import { getSlideSummary, parseDeck } from '../../../shared/deckParser.ts'
import { deckName, type DeckRef } from '../../../shared/decks.ts'
import { readContentInstructions } from '../agentContext.ts'

export interface DeckContext {
  ref: DeckRef
  /** The deck's MDX, or null when the file does not exist yet. */
  source: string | null
  currentSlideIndex?: number
  /** The content folder the deck lives in (for folder instructions). */
  contentDir: string
}

interface SlideView {
  summary: string[]
  slides: string[]
}

function viewOf(source: string | null): SlideView | null {
  if (!source) return null
  try {
    const deck = parseDeck(source)
    return { summary: getSlideSummary(deck), slides: deck.slides.map((s) => s.text) }
  } catch {
    return null
  }
}

const structure = (view: SlideView, current?: number) =>
  ['```', ...view.summary.map((s, i) => `${i}: ${s}${i === current ? '  <-- viewing' : ''}`), '```'].join('\n')

const folderInstructions = (dir: string, httpWording: boolean): string | null => {
  const text = readContentInstructions(dir)
  if (!text?.trim()) return null
  const precedence = httpWording
    ? 'These rules come from the folder that holds the presentations. On style, language and wording they take precedence over the sections above. Component names and props are still defined by the framework.'
    : 'These rules come from the folder that holds the presentations. On style and wording they take precedence.'
  return ['## Content folder instructions (AGENTS.md)', '', precedence, '', text.trim()].join('\n')
}

/**
 * Standing instructions for the in-app agent (UX overhaul U4): the rules live in the
 * slidecraft-presentations skill, synced into the vault, so this only points at it and adds the
 * vault's house style.
 */
export async function buildAgentInstructions(contentDir: string): Promise<string> {
  const parts = [
    [
      '# Slidecraft',
      '',
      'You work inside Slidecraft, an MDX presentation app, in one vault: the working directory. The person sees the deck in the app as you edit it, beside this conversation.',
      '',
      '- For any work on a presentation, use the `slidecraft-presentations` skill (`.claude/skills/slidecraft-presentations/SKILL.md`) and follow its workflow, including `validate_deck` and `screenshot_slide` from the `slidecraft` tools.',
      '- Each message starts with a <slidecraft-context> block: the deck, its slides and the one on screen. It describes the screen; the request follows it.',
      '- Keep replies short: what changed, and anything the person should decide.',
    ].join('\n'),
  ]
  const folder = folderInstructions(contentDir, false)
  if (folder) parts.push(folder)
  return parts.join('\n\n')
}

/** What the person is looking at: the deck, its structure and the slide on screen. */
export function buildDeckContext(deck: DeckContext | null): string {
  if (!deck) return '## No presentation is open\n\nTo create one, write `<name>/index.mdx` in the working directory (lower-case words joined by dashes). Do not print the file in your reply; write it.'
  const name = deckName(deck.ref)
  const file = `${deck.ref.path}/index.mdx`
  const view = viewOf(deck.source)
  const lines = [`## Current presentation: ${name}`, '', `File path: ${file} (relative to the working directory)`]
  if (!deck.source) lines.push('', '(The presentation file does not exist yet: create it.)')
  else if (view) {
    lines.push('', '### Slide structure', '', structure(view, deck.currentSlideIndex))
    const current = deck.currentSlideIndex
    if (current !== undefined && view.slides[current] !== undefined) lines.push('', `### Current slide (index ${current})`, '', '```jsx', view.slides[current], '```')
  }
  lines.push('', `IMPORTANT: Edit the MDX file directly with your file tools. The file is at: ${file}. Do not print the file contents in your reply; just edit the file.`)
  return lines.join('\n')
}
