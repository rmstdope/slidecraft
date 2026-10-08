/**
 * The deck tools (Part 5 §A.10, Part 4 §12), shared by the HTTP chat provider (Phase 10) and the
 * MCP server. Each tool takes plain JSON arguments and returns `{ success, data?, error? }`.
 */
import { existsSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { deleteSlide, getSlideSummary, insertSlide, newDeckSource, parseDeck, replaceSlide, setPresentationAttr } from '../../shared/deckParser.ts'
import { deckName, RESERVED_DECK_NAMES, type DeckRef } from '../../shared/decks.ts'
import { getAllComponents } from '../../src/components/slides/defineComponent.ts'
import '../../src/components/slides/index.ts'
import { listThemes, registerTheme, unregisterSource } from '../../src/themes/registry.ts'
import { getContentSource, getDefaultContentSource, getLibraryDir } from './contentSources.ts'
import { discoverPresentations, resolveDeckRefInSources, resolveWritableDeckRefInSources, type ResolvedDeck } from './decks.ts'
import { readDeckSource, saveValidatedDeck } from './deckStore.ts'
import { listImages } from './images.ts'
import { repairSlideContent } from './mdxRepair.ts'
import { discoverThemes } from './themes.ts'

export interface ToolContext {
  /** The deck the conversation is about; names resolve next to it. */
  deck?: DeckRef
}

export interface ToolResult {
  success: boolean
  data?: unknown
  error?: string
}

type JsonSchema = { type: string; description?: string; items?: JsonSchema; properties?: Record<string, JsonSchema>; required?: string[] }

export interface ToolDefinition {
  name: string
  description: string
  parameters: JsonSchema & { type: 'object' }
  /** Changes a deck on disk. */
  mutates: boolean
}

const str = (description: string): JsonSchema => ({ type: 'string', description })
const int = (description: string): JsonSchema => ({ type: 'integer', description })

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  { name: 'list_presentations', description: 'List the presentations in the content folder.', mutates: false, parameters: { type: 'object', properties: {} } },
  {
    name: 'read_presentation',
    description: 'Read a presentation: slide summary, every slide with its index, the import block and the theme. Always read before modifying.',
    mutates: false,
    parameters: { type: 'object', properties: { name: str('Presentation folder name') }, required: ['name'] },
  },
  {
    name: 'create_presentation',
    description: 'Create a new presentation. Pass every initial slide as a complete <Slide>…</Slide> string, or create it empty and add slides with insert_slide.',
    mutates: true,
    parameters: {
      type: 'object',
      properties: {
        name: str('Folder name: lower-case words joined by dashes'),
        slides: { type: 'array', items: { type: 'string' }, description: 'Complete <Slide> elements' },
        theme: str('Optional theme id, e.g. "folio"'),
      },
      required: ['name'],
    },
  },
  {
    name: 'insert_slide',
    description: 'Insert one complete <Slide> element before the given index; -1 appends.',
    mutates: true,
    parameters: { type: 'object', properties: { name: str('Presentation folder name'), index: int('0-based position; -1 appends'), content: str('A complete <Slide>…</Slide> element') }, required: ['name', 'index', 'content'] },
  },
  {
    name: 'update_slide',
    description: 'Replace the slide at an index with one complete <Slide> element.',
    mutates: true,
    parameters: { type: 'object', properties: { name: str('Presentation folder name'), index: int('0-based slide index'), content: str('A complete <Slide>…</Slide> element') }, required: ['name', 'index', 'content'] },
  },
  {
    name: 'delete_slide',
    description: 'Delete the slide at an index. The last remaining slide cannot be deleted.',
    mutates: true,
    parameters: { type: 'object', properties: { name: str('Presentation folder name'), index: int('0-based slide index') }, required: ['name', 'index'] },
  },
  {
    name: 'set_presentation_theme',
    description: 'Set the theme of a presentation (the theme attribute on <Presentation>); pass an empty string for the default theme.',
    mutates: true,
    parameters: { type: 'object', properties: { name: str('Presentation folder name'), theme: str('Theme id from list_themes') }, required: ['name', 'theme'] },
  },
  { name: 'list_themes', description: 'List the themes available to presentations in this content folder, with their frames (slide masters).', mutates: false, parameters: { type: 'object', properties: {} } },
  {
    name: 'list_images',
    description: "List images: a presentation's own images folder, or the shared library when no presentation is given.",
    mutates: false,
    parameters: { type: 'object', properties: { presentation: str('Optional presentation folder name') } },
  },
]

const DECK_NAME_RE = /^[a-z0-9][a-z0-9-]*$/

/** A tool's `name` argument as a deck ref: the context deck, a sibling folder of it, or the default source. */
export function toolDeckRef(name: string, context: ToolContext): DeckRef {
  if (context.deck) {
    if (name === deckName(context.deck) || name === context.deck.path) return context.deck
    const parent = dirname(context.deck.path)
    return { source: context.deck.source, path: parent === '.' ? name : `${parent}/${name}` }
  }
  return { source: getDefaultContentSource().id, path: name }
}

const fail = (error: string): ToolResult => ({ success: false, error })

function nameArg(args: Record<string, unknown>): string | ToolResult {
  const name = args.name
  if (typeof name !== 'string' || name.trim() === '') return fail('A presentation name is required')
  if (name.includes('..')) return fail('Presentation names cannot contain ".."')
  return name.trim()
}

async function loadDeck(args: Record<string, unknown>, context: ToolContext, write: boolean): Promise<{ ref: DeckRef; resolved: ResolvedDeck; source: string } | ToolResult> {
  const name = nameArg(args)
  if (typeof name !== 'string') return name
  const ref = toolDeckRef(name, context)
  let resolved: ResolvedDeck | null
  if (write) {
    const writable = resolveWritableDeckRefInSources(ref)
    if ('error' in writable) return fail(writable.error === 'read-only' ? `Content source "${ref.source}" is read-only` : `Invalid presentation reference "${name}"`)
    resolved = writable.resolved
  } else resolved = resolveDeckRefInSources(ref)
  if (!resolved) return fail(`Invalid presentation reference "${name}"`)
  const source = await readDeckSource(resolved)
  if (source === null) return fail(`Presentation "${name}" not found`)
  return { ref, resolved, source }
}

const indexArg = (args: Record<string, unknown>): number | undefined => (typeof args.index === 'number' && Number.isInteger(args.index) ? args.index : undefined)

function repaired(content: unknown): string | ToolResult {
  if (typeof content !== 'string' || content.trim() === '') return fail('content must be a complete <Slide>…</Slide> element')
  return repairSlideContent(content).content
}

const componentNames = () => getAllComponents().map((c) => c.registry.name)

function themesFor(sourceId: string) {
  const source = getContentSource(sourceId)
  const content = source ? discoverThemes(source) : []
  for (const theme of content) registerTheme({ id: theme.id, source: theme.source, raw: theme.raw, baseUrl: theme.baseUrl })
  const list = listThemes(sourceId)
  const errors = Object.fromEntries(content.filter((t) => t.errors.length).map((t) => [t.id, t.errors]))
  unregisterSource(sourceId)
  return { themes: list, errors }
}

export async function executeTool(name: string, args: Record<string, unknown>, context: ToolContext = {}): Promise<ToolResult> {
  try {
    switch (name) {
      case 'list_presentations': {
        const source = context.deck?.source
        const decks = await discoverPresentations(source ? { source } : {})
        return { success: true, data: decks.map((d) => ({ name: d.name, path: d.path, source: d.source, readOnly: d.readOnly, updatedAt: d.updatedAt })) }
      }
      case 'read_presentation': {
        const loaded = await loadDeck(args, context, false)
        if ('success' in loaded) return loaded
        try {
          const deck = parseDeck(loaded.source)
          return {
            success: true,
            data: {
              totalSlides: deck.slides.length,
              theme: typeof deck.presentation.attrs.theme === 'string' ? deck.presentation.attrs.theme : 'slidecraft',
              slideSummary: getSlideSummary(deck),
              slides: deck.slides.map((s) => ({ index: s.index, content: s.text })),
              imports: loaded.source.slice(0, deck.presentation.start).trim(),
            },
          }
        } catch (error) {
          return { success: true, data: { raw: loaded.source, parseError: (error as Error).message } }
        }
      }
      case 'create_presentation': {
        const deckNameArg = nameArg(args)
        if (typeof deckNameArg !== 'string') return deckNameArg
        if (!DECK_NAME_RE.test(deckNameArg)) return fail('Use lower-case letters, digits and dashes for the presentation name')
        if (RESERVED_DECK_NAMES.has(deckNameArg)) return fail(`"${deckNameArg}" is reserved by the app; choose another name`)
        if (args.slides !== undefined && !Array.isArray(args.slides)) return fail('slides must be an array of <Slide> strings')
        const ref = toolDeckRef(deckNameArg, context)
        const writable = resolveWritableDeckRefInSources(ref)
        if ('error' in writable) return fail(writable.error === 'read-only' ? `Content source "${ref.source}" is read-only` : `Invalid presentation reference "${deckNameArg}"`)
        if (existsSync(writable.resolved.deckDir)) return fail(`A presentation named "${deckNameArg}" already exists`)
        const slides: string[] = []
        for (const slide of (args.slides as unknown[] | undefined) ?? []) {
          const fixed = repaired(slide)
          if (typeof fixed !== 'string') return fixed
          slides.push(fixed)
        }
        const theme = typeof args.theme === 'string' && args.theme.trim() ? `theme="${args.theme.trim()}"` : ''
        const source = newDeckSource(slides, componentNames(), theme)
        await mkdir(writable.resolved.deckDir, { recursive: true })
        const saved = await saveValidatedDeck(ref, writable.resolved, source, { created: true })
        if (!saved.ok) return fail(saved.error)
        return { success: true, data: { name: deckNameArg, slideCount: slides.length } }
      }
      case 'insert_slide':
      case 'update_slide':
      case 'delete_slide': {
        const index = indexArg(args)
        if (index === undefined || (name !== 'insert_slide' && index < 0)) return fail('index must be a slide index (insert_slide also accepts -1 to append)')
        const loaded = await loadDeck(args, context, true)
        if ('success' in loaded) return loaded
        const deck = parseDeck(loaded.source)
        const count = deck.slides.length
        if (name !== 'insert_slide' && index >= count) return fail(`Slide index ${index} out of range. Valid indices: 0-${count - 1}`)
        let next: string
        let changed: number | undefined
        if (name === 'delete_slide') {
          if (count <= 1) return fail('Cannot delete the last slide')
          next = deleteSlide(deck, index)
        } else {
          const content = repaired(args.content)
          if (typeof content !== 'string') return content
          next = name === 'insert_slide' ? insertSlide(deck, index, content) : replaceSlide(deck, index, content)
          changed = name === 'insert_slide' ? (index < 0 || index >= count ? count : index) : index
        }
        const saved = await saveValidatedDeck(loaded.ref, loaded.resolved, next, { changedSlide: changed })
        if (!saved.ok) return fail(saved.error)
        const total = parseDeck(next).slides.length
        const deckLabel = deckName(loaded.ref)
        if (name === 'insert_slide') return { success: true, data: { name: deckLabel, insertedAt: changed, totalSlides: total } }
        if (name === 'update_slide') return { success: true, data: { name: deckLabel, updatedIndex: index, totalSlides: total } }
        return { success: true, data: { name: deckLabel, deletedIndex: index, totalSlides: total } }
      }
      case 'set_presentation_theme': {
        const loaded = await loadDeck(args, context, true)
        if ('success' in loaded) return loaded
        const theme = typeof args.theme === 'string' ? args.theme.trim() : ''
        const next = setPresentationAttr(parseDeck(loaded.source), 'theme', theme ? theme : null)
        const saved = await saveValidatedDeck(loaded.ref, loaded.resolved, next)
        if (!saved.ok) return fail(saved.error)
        return { success: true, data: { name: deckName(loaded.ref), theme: theme || 'slidecraft' } }
      }
      case 'list_themes':
        return { success: true, data: themesFor(context.deck?.source ?? getDefaultContentSource().id) }
      case 'list_images': {
        if (typeof args.presentation === 'string' && args.presentation) {
          const resolved = resolveDeckRefInSources(toolDeckRef(args.presentation, context))
          if (!resolved) return fail(`Invalid presentation reference "${args.presentation}"`)
          return { success: true, data: await listImages(join(resolved.deckDir, 'images'), './images') }
        }
        return { success: true, data: await listImages(getLibraryDir(), '/images/library') }
      }
      default:
        return fail(`Unknown tool "${name}"`)
    }
  } catch (error) {
    return fail((error as Error).message)
  }
}
