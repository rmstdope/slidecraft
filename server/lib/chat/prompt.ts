/**
 * Prompts for the chat (Part 5 §A.6.4, §A.8): the system prompt of the HTTP provider and the
 * context prompt of the CLI agents. Both carry the components, templates, themes, the author
 * guide and hand-written folder instructions.
 */
import { getSlideSummary, parseDeck } from '../../../shared/deckParser.ts'
import { deckName, type DeckRef } from '../../../shared/decks.ts'
import { buildComponentSummary, buildTemplateExamples, buildThemeSummary, readContentInstructions } from '../agentContext.ts'
import { readAuthorGuide } from '../appFiles.ts'

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

const GUIDELINES = `## Guidelines

1. **Create and edit are different workflows.** To create a deck, do not call \`read_presentation\` first: call \`create_presentation\` with the new name (lower-case words joined by dashes) and, ideally, every initial slide in \`slides\`; or create it empty and add slides with \`insert_slide\`. To edit, call \`read_presentation\` first to see the indexed slides.
2. **Change slides one at a time.** Use \`insert_slide\` (index -1 appends), \`update_slide\` and \`delete_slide\`. Several calls in a row are fine; one slide per call keeps errors small.
3. **Use only the components listed above.** Never raw HTML (\`<div>\`, \`<p>\`, \`<ul>\`, \`<h1>\`, \`<br>\`, \`<img>\`).
4. **Write valid MDX.** Close every tag; string props use quotes (\`accent="yellow"\`), everything else braces (\`items={[...]}\`); each slide is one complete \`<Slide>…</Slide>\` block. When a write is refused, read the error, fix that slide and try again.
5. **Be helpful and iterative.** Ask when the request is ambiguous, suggest improvements, and say briefly what you changed.
6. **Slide structure.** For example: \`<Slide scheme="dark" accent="yellow" gradient="radial"><Title>…</Title><Text>…</Text></Slide>\`.
7. **Fixed dimensions.** Sizes are pixels on a 1920 × 1080 canvas. Never \`%\`, \`vw\`, \`vh\` or \`clamp()\`.`

/** The HTTP provider's system prompt (Part 5 §A.8). */
export async function buildSystemPrompt(deck: DeckContext | null, contentDir: string): Promise<string> {
  const sections = [
    '# AI Presentation Assistant\n\nYou help the user create and edit presentations made with Slidecraft, an MDX presentation framework. You change decks only through the tools.',
    readAuthorGuide() ?? '# Presentation author guide\n\nWrite slides with the registered components only.',
    buildComponentSummary(),
    buildTemplateExamples(),
    await buildThemeSummary(),
    GUIDELINES,
  ]
  const folder = folderInstructions(deck?.contentDir ?? contentDir, true)
  if (folder) sections.push(folder)

  if (deck) {
    const name = deckName(deck.ref)
    const view = viewOf(deck.source)
    const context = ['## Current context', '', `You are working on the presentation **${name}**.`]
    if (!deck.source) context.push('', 'Its file does not exist yet: create it with `create_presentation`.')
    else if (!view) context.push('', 'Use `read_presentation` to see its current content before making changes.')
    else {
      const current = deck.currentSlideIndex
      context.push('', '### Current slide structure', '', 'Use these indices when inserting, updating or deleting slides:', '', structure(view, current))
      if (current !== undefined && view.slides[current] !== undefined) {
        context.push('', '### Slides near the current view', '', 'Full content of the slides the user is looking at:')
        for (const [label, i] of [['Previous slide', current - 1], ['Current slide', current], ['Next slide', current + 1]] as const) {
          if (view.slides[i] === undefined) continue
          context.push('', `**${label} (index ${i})${i === current ? ' ← the user is viewing this' : ''}:**`, '', '```jsx', view.slides[i], '```')
        }
        context.push('', 'Use `read_presentation` to see other slides.')
      } else context.push('', 'Use `read_presentation` to see full slide content when needed.')
    }
    sections.push(context.join('\n'))
  }
  return sections.join('\n\n---\n\n')
}

/** Context for the CLI agents, which run in the content folder and edit files themselves (§A.6.4). */
export async function buildAgentContext(deck: DeckContext | null, contentDir: string): Promise<string> {
  const parts = [
    'You are editing presentations made with Slidecraft, an MDX presentation framework. Follow the presentation authoring guide below; it describes the components and the rules for using them.',
    buildComponentSummary(),
    buildTemplateExamples(),
    await buildThemeSummary(),
    `## Presentation authoring guide\n\n${readAuthorGuide() ?? 'Use the registered components only.'}`,
  ]
  const folder = folderInstructions(deck?.contentDir ?? contentDir, false)
  if (folder) parts.push(folder)
  if (deck) {
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
    parts.push(lines.join('\n'))
  } else {
    parts.push('## No presentation is open\n\nTo create one, write `<name>/index.mdx` in the working directory (lower-case words joined by dashes). Do not print the file in your reply; write it.')
  }
  return parts.join('\n\n')
}
