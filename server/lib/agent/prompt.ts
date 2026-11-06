/**
 * What the in-app agent is told (UX overhaul U4): standing instructions that point at the
 * presentations skill and carry the vault's house style, and per-message context about the deck
 * on screen.
 */
import { getSlideSummary, parseDeck } from '../../../shared/deckParser.ts'
import { deckName, type DeckRef } from '../../../shared/decks.ts'
import { targetFolder, type ThreadTarget } from '../../../shared/agent.ts'
import { buildVaultComponentSummary, readContentInstructions } from '../agentContext.ts'

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
export async function buildAgentInstructions(contentDir: string, vault?: string): Promise<string> {
  const parts = [
    [
      '# Slidecraft',
      '',
      'You work inside Slidecraft, an MDX presentation app, in one vault: the working directory. The person sees the deck in the app as you edit it, beside this conversation.',
      '',
      '- For any work on a presentation, use the `slidecraft-presentations` skill (`.claude/skills/slidecraft-presentations/SKILL.md`) and follow its workflow, including `validate_deck` and `screenshot_slide` from the `slidecraft` tools.',
      '- Each message starts with a <slidecraft-context> block: the deck, its slides and the one on screen. It describes the screen; the request follows it.',
      "- For a component or template of this vault (`components/<Name>/`, `templates/<id>/`), use the `slidecraft-components` skill (`.claude/skills/slidecraft-components/SKILL.md`), its vault part, and check your work with `validate_component`.",
      '- Keep replies short: what changed, and anything the person should decide.',
    ].join('\n'),
  ]
  const own = vault ? await buildVaultComponentSummary(vault) : null
  if (own) parts.push(own)
  const folder = folderInstructions(contentDir, false)
  if (folder) parts.push(folder)
  return parts.join('\n\n')
}

/** A conversation about one vault component or template (V4): where to work and how to check it. */
export function buildTargetContext(target: ThreadTarget): string {
  const folder = targetFolder(target)
  const what = target.kind === 'component' ? `the vault component ${target.name}` : `the vault template ${target.name}`
  const entry = target.kind === 'component' ? `${folder}/index.tsx` : `${folder}/index.mdx`
  return [
    `## Working on ${what}`,
    '',
    `Folder: ${folder}/ (relative to the working directory); its entry is ${entry}. It may not exist yet: create it.`,
    '',
    `Follow the vault part of the \`slidecraft-components\` skill (\`.claude/skills/slidecraft-components/SKILL.md\`). Write only inside ${folder}/; the person sees it in the Component Gallery as you save, and "Undo this turn" covers only that folder.`,
    '',
    `When you are done, run \`validate_component\` with name "${target.name}" and fix every error. Slidecraft also checks the folder after your turn.`,
  ].join('\n')
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
