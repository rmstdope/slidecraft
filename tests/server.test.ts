import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parseDeck } from '../shared/deckParser.ts'
import { buildFolderInstructions, GENERATED_PREFIX, syncFolderInstructions } from '../server/lib/agentContext.ts'
import { initContentSources } from '../server/lib/contentSources.ts'
import { executeTool } from '../server/lib/tools.ts'
import { router } from '../server/index.ts'

const root = mkdtempSync(join(tmpdir(), 'slidecraft-server-'))
const local = join(root, 'local')
const team = join(root, 'team')
const DECK = `import { Presentation, Slide, Title, Text } from '@components'

<Presentation>

<Slide>
  <Title>Alpha</Title>
</Slide>

<Slide>
  <Text>Second</Text>
</Slide>

</Presentation>
`

beforeAll(() => {
  mkdirSync(join(local, 'alpha', 'images'), { recursive: true })
  writeFileSync(join(local, 'alpha', 'index.mdx'), DECK)
  writeFileSync(join(local, 'alpha', 'images', 'pic.png'), 'png-bytes')
  mkdirSync(join(local, 'themes', 'acme'), { recursive: true })
  writeFileSync(join(local, 'themes', 'acme', 'theme.json'), JSON.stringify({ name: 'Acme', extends: 'folio', frames: { cover: { svg: 'cover.svg' } } }))
  mkdirSync(join(local, 'themes', 'broken'), { recursive: true })
  writeFileSync(join(local, 'themes', 'broken', 'theme.json'), '{ nope')
  mkdirSync(join(team, 'presentations', 'beta'), { recursive: true })
  writeFileSync(join(team, 'presentations', 'beta', 'index.mdx'), DECK)
  initContentSources({ contents: { team: { path: team, readOnly: true } } }, local, join(root, 'fallback'))
})
afterAll(() => rmSync(root, { recursive: true, force: true }))

const call = (path: string, init?: RequestInit) => router(new Request(`http://localhost:6110${path}`, init))
const body = async (res: Response) => (await res.json()) as Record<string, unknown>

describe('basics', () => {
  test('health identifies the app and the content directory', async () => {
    const res = await call('/api/health')
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:6100')
    expect(await body(res)).toMatchObject({ app: 'slidecraft', contentDir: local, pid: process.pid })
  })
  test('unknown API routes are JSON 404s; OPTIONS is a preflight; export and chat are not built yet', async () => {
    expect((await call('/api/nope')).status).toBe(404)
    expect((await call('/api/mdx/x', { method: 'OPTIONS' })).headers.get('Access-Control-Max-Age')).toBe('86400')
    expect((await call('/api/export/alpha', { method: 'POST' })).status).toBe(501)
  })
})

describe('decks', () => {
  test('lists presentations across sources', async () => {
    const list = (await (await call('/api/presentations')).json()) as { source: string; path: string; readOnly: boolean }[]
    expect(list.map((d) => `${d.source}:${d.path}`)).toEqual(['default:alpha', 'team:presentations/beta'])
    expect(list[1].readOnly).toBe(true)
  })

  test('reads a deck by legacy name and by source and path', async () => {
    expect(await body(await call('/api/mdx/alpha'))).toMatchObject({ content: DECK, readOnly: false })
    const qualified = await body(await call('/api/mdx/beta?source=team&path=presentations%2Fbeta'))
    expect(qualified).toMatchObject({ readOnly: true, deck: { source: 'team', path: 'presentations/beta' } })
    expect((await call('/api/mdx/missing')).status).toBe(404)
    expect((await call('/api/mdx/x?path=..%2F..%2Fetc')).status).toBe(400)
  })

  test('writes verbatim, refuses read-only sources', async () => {
    const changed = DECK.replace('Alpha', 'Alpha 2')
    const put = await call('/api/mdx/alpha', { method: 'PUT', body: JSON.stringify({ content: changed }) })
    expect(await body(put)).toEqual({ success: true })
    expect(readFileSync(join(local, 'alpha', 'index.mdx'), 'utf8')).toBe(changed)
    const ro = await call('/api/mdx/beta?source=team&path=presentations%2Fbeta', { method: 'PUT', body: JSON.stringify({ content: 'x' }) })
    expect(ro.status).toBe(403)
    expect((await call('/api/mdx/alpha', { method: 'PUT', body: '{}' })).status).toBe(400)
    writeFileSync(join(local, 'alpha', 'index.mdx'), DECK)
  })

  test('serves deck assets and blocks traversal', async () => {
    expect(await (await call('/content/alpha/images/pic.png')).text()).toBe('png-bytes')
    expect(await (await call('/content-source/default/alpha/images/pic.png')).text()).toBe('png-bytes')
    expect((await call('/content-source/nope/x.png')).status).toBe(404)
    expect((await call('/content/..%2F..%2Fetc%2Fpasswd')).status).toBe(404)
  })

  test('apply-fix validates the whole deck before writing', async () => {
    const bad = await body(await call('/api/apply-fix', { method: 'POST', body: JSON.stringify({ presentationName: 'alpha', slideIndex: 1, content: '<Slide>\n  <Text>broken</Txt>\n</Slide>' }) }))
    expect(bad).toMatchObject({ success: false, error: 'Validation failed' })
    expect(readFileSync(join(local, 'alpha', 'index.mdx'), 'utf8')).toBe(DECK)
    const good = await body(await call('/api/apply-fix', { method: 'POST', body: JSON.stringify({ presentationName: 'alpha', slideIndex: 1, content: '<Slide>\n  <Text>Fixed</Text>\n</Slide>' }) }))
    expect(good).toEqual({ success: true })
    expect(readFileSync(join(local, 'alpha', 'index.mdx'), 'utf8')).toContain('Fixed')
    writeFileSync(join(local, 'alpha', 'index.mdx'), DECK)
  })
})

describe('sources and themes', () => {
  test('contents reports the mounted sources and can switch the default', async () => {
    const state = await body(await call('/api/contents'))
    expect((state.sources as { id: string }[]).map((s) => s.id)).toEqual(['default', 'team', 'built-in'])
    expect((await call('/api/contents', { method: 'POST', body: JSON.stringify({ name: 'nope' }) })).status).toBe(404)
  })

  test('themes come from content folders with validation errors and a base URL', async () => {
    const themes = (await (await call('/api/themes?source=default')).json()) as { id: string; errors: string[]; baseUrl: string }[]
    expect(themes.map((t) => t.id)).toEqual(['acme', 'broken'])
    expect(themes[0]).toMatchObject({ errors: [], baseUrl: '/content-source/default/themes/acme/' })
    expect(themes[1].errors[0]).toContain('not valid JSON')
  })
})

describe('images', () => {
  test('upload to a deck, list, and delete', async () => {
    const form = new FormData()
    // A real 1×1 PNG, so the optional resize path is exercised too.
    const png = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='), (c) => c.charCodeAt(0))
    form.set('file', new File([png], 'My Photo!.png', { type: 'image/png' }))
    form.set('storage', 'presentation')
    form.set('presentation', 'alpha')
    const res = await call('/api/images/upload', { method: 'POST', body: form })
    const { path } = (await res.json()) as { path: string }
    expect(path).toMatch(/^\.\/images\/my-photo-\d+\.(png|webp)$/)
    const listed = (await (await call('/api/images/alpha')).json()) as { images: { path: string }[] }
    expect(listed.images.map((i) => i.path)).toContain(path)
    const del = await call('/api/images', { method: 'DELETE', body: JSON.stringify({ path, source: 'default', deckPath: 'alpha' }) })
    expect(await body(del)).toEqual({ success: true })
  })
  test('rejects wrong content types', async () => {
    const form = new FormData()
    form.set('file', new File(['x'], 'a.txt', { type: 'text/plain' }))
    expect((await call('/api/images/upload', { method: 'POST', body: form })).status).toBe(400)
  })
})

describe('server-sent events', () => {
  test('the stream opens with a connected frame', async () => {
    const res = await call('/api/events')
    expect(res.headers.get('Content-Type')).toBe('text/event-stream')
    const reader = res.body!.getReader()
    const { value } = await reader.read()
    expect(new TextDecoder().decode(value)).toStartWith('data: {"type":"connected"')
    await reader.cancel()
  })
})

describe('deck tools', () => {
  test('create, insert, update, read and delete', async () => {
    const created = await executeTool('create_presentation', { name: 'gamma', theme: 'paper', slides: ['<Slide>\n  <Title>One</Title>\n</Slide>'] })
    expect(created).toEqual({ success: true, data: { name: 'gamma', slideCount: 1 } })
    expect(await executeTool('insert_slide', { name: 'gamma', index: -1, content: '<Slide><Stat value="42%" label="up"></Slide>' })).toMatchObject({ success: true, data: { insertedAt: 1, totalSlides: 2 } })
    expect(await executeTool('update_slide', { name: 'gamma', index: 0, content: '<Slide>\n  <Title>Uno</Title>\n</Slide>' })).toMatchObject({ success: true })
    const read = (await executeTool('read_presentation', { name: 'gamma' })).data as { theme: string; slideSummary: string[]; slides: { content: string }[] }
    expect(read.theme).toBe('paper')
    expect(read.slideSummary[0]).toBe('"Uno" [dark/yellow]')
    expect(read.slides[1].content).toContain('label="up" />') // repaired void tag
    expect(await executeTool('delete_slide', { name: 'gamma', index: 1 })).toMatchObject({ success: true, data: { totalSlides: 1 } })
    expect(await executeTool('delete_slide', { name: 'gamma', index: 0 })).toEqual({ success: false, error: 'Cannot delete the last slide' })
  })

  test('invalid MDX is refused with the compiler message and nothing is written', async () => {
    const before = readFileSync(join(local, 'gamma', 'index.mdx'), 'utf8')
    const result = await executeTool('update_slide', { name: 'gamma', index: 0, content: '<Slide>\n  <Title>Bad</Tittle>\n</Slide>' })
    expect(result.success).toBe(false)
    expect(result.error).toContain('Validation failed - the change would create invalid MDX.')
    expect(result.error).toContain('Error is in slide 0')
    expect(readFileSync(join(local, 'gamma', 'index.mdx'), 'utf8')).toBe(before)
  })

  test('names are checked; existing decks are not overwritten; read-only sources refuse', async () => {
    expect((await executeTool('create_presentation', { name: 'Bad Name' })).error).toContain('lower-case')
    expect((await executeTool('create_presentation', { name: 'gallery' })).error).toContain('reserved')
    expect((await executeTool('create_presentation', { name: 'gamma' })).error).toContain('already exists')
    expect((await executeTool('update_slide', { name: 'beta', index: 0, content: '<Slide />' }, { deck: { source: 'team', path: 'presentations/beta' } })).error).toContain('read-only')
  })

  test('themes: list with frames, then set on a deck', async () => {
    const { themes, errors } = (await executeTool('list_themes', {})).data as { themes: { id: string; frames: string[] }[]; errors: Record<string, string[]> }
    expect(themes.find((t) => t.id === 'acme')?.frames).toEqual(expect.arrayContaining(['cover', 'title', 'content']))
    expect(errors.broken).toBeDefined()
    expect(await executeTool('set_presentation_theme', { name: 'gamma', theme: 'acme' })).toMatchObject({ success: true })
    expect(parseDeck(readFileSync(join(local, 'gamma', 'index.mdx'), 'utf8')).presentation.attrs.theme).toBe('acme')
  })
})

describe('AGENTS.md for the content folder', () => {
  test('is generated with components, templates, themes and the author guide', async () => {
    const text = await buildFolderInstructions(6110)
    expect(text.startsWith(GENERATED_PREFIX)).toBe(true)
    expect(text).toContain('| Data Visualization | Stat')
    expect(text).toContain('### Folio Title Slide')
    expect(text).toContain('| `acme` | this folder |')
    expect(text).toContain('# Presentation author guide')
  })
  test('is written once, refreshed when stale, and never replaces a hand-written file', async () => {
    expect(await syncFolderInstructions(6110)).toBe('written')
    expect(await syncFolderInstructions(6110)).toBe('unchanged')
    writeFileSync(join(local, 'AGENTS.md'), '# House style\n')
    expect(await syncFolderInstructions(6110)).toBe('hand-written')
    expect(existsSync(join(local, 'AGENTS.md'))).toBe(true)
  })
})
