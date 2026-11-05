import { afterAll, describe, expect, test } from 'bun:test'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildCatalogue, CATALOGUE_FILE } from '../scripts/generateSkills.ts'
import { getTopLevelComponents } from '../src/components/slides/defineComponent.ts'
import { readAuthorGuide } from '../server/lib/appFiles.ts'
import { normalizeContentSource } from '../server/lib/contentSources.ts'
import { checkDeck, DOCUMENT_TITLE_CHARS } from '../server/lib/deckChecks.ts'
import { printViewUrl } from '../server/lib/exportPdf.ts'
import { MARKER_FILE, skillFiles, syncSkill, vaultSkillDir } from '../server/lib/skillSync.ts'

const ROOT = join(import.meta.dir, '..')
const root = mkdtempSync(join(tmpdir(), 'slidecraft-skills-'))
afterAll(() => rmSync(root, { recursive: true, force: true }))

describe('the component catalogue', () => {
  test('is up to date with the registry (run `bun run skills` when this fails)', () => {
    expect(readFileSync(CATALOGUE_FILE, 'utf8')).toBe(buildCatalogue())
  })
  test('lists every top-level component', () => {
    const catalogue = buildCatalogue()
    for (const c of getTopLevelComponents()) expect(catalogue).toContain(`### ${c.registry.name}\n`)
  })
})

describe('the presentations skill', () => {
  const skill = join(ROOT, 'skills', 'slidecraft-presentations')
  test('every reference the SKILL.md points at exists', () => {
    const text = readFileSync(join(skill, 'SKILL.md'), 'utf8')
    const links = [...text.matchAll(/\]\((references\/[^)]+)\)/g)].map((m) => m[1])
    expect(links.length).toBeGreaterThanOrEqual(5)
    for (const link of links) expect(existsSync(join(skill, link))).toBe(true)
  })
  test('the complete example deck passes validate_deck without a problem', async () => {
    const examples = readFileSync(join(skill, 'references', 'examples.md'), 'utf8')
    const deck = /```mdx\n(import[\s\S]*?)```/.exec(examples)![1]
    expect(await checkDeck(deck)).toEqual({ ok: true, slideCount: 4, problems: [] })
  })
  test('the author guide for the chat prompt is assembled from it', () => {
    const guide = readAuthorGuide()!
    expect(guide.startsWith('# Slidecraft presentations')).toBe(true)
    expect(guide).toContain('# Themes, frames and colour')
    expect(guide).not.toContain('name: slidecraft-presentations')
  })
})

describe('validate_deck', () => {
  const deck = (slides: string) => `import { Presentation, Slide, Title, Subtitle, Text } from '@components'\n\n<Presentation>\n\n${slides}\n\n</Presentation>\n`
  test('a clean deck has no problems', async () => {
    expect(await checkDeck(deck('<Slide layout="document">\n  <Subtitle>Today</Subtitle>\n  <Title>Every branch starts cold</Title>\n</Slide>'))).toMatchObject({ ok: true, slideCount: 1, problems: [] })
  })
  test('raw HTML, unknown components and compile errors are errors, with their slide', async () => {
    const result = await checkDeck(deck('<Slide>\n  <Title>One</Title>\n</Slide>\n\n<Slide>\n  <div>raw</div>\n  <Sparkle />\n</Slide>'))
    expect(result.ok).toBe(false)
    expect(result.problems.map((p) => [p.severity, p.slide, p.line])).toEqual([
      ['error', 1, 10],
      ['error', 1, 11],
    ])
    const broken = await checkDeck(deck('<Slide>\n  <Title>Unclosed\n</Slide>'))
    expect(broken.ok).toBe(false)
    expect(broken.problems[0].message).toStartWith('Does not compile')
  })
  test('a document title that probably wraps is a warning; a centered one is not', async () => {
    const long = 'x'.repeat(DOCUMENT_TITLE_CHARS + 5)
    const result = await checkDeck(deck(`<Slide layout="document">\n  <Title>${long}</Title>\n</Slide>\n\n<Slide>\n  <Title>${long}</Title>\n</Slide>`))
    expect(result.ok).toBe(true)
    expect(result.problems).toEqual([expect.objectContaining({ severity: 'warning', slide: 0 })])
  })
})

describe('skill sync into vaults', () => {
  const vault = normalizeContentSource('work', join(root, 'work'))
  mkdirSync(vault.path, { recursive: true })
  const dir = vaultSkillDir(vault.path)

  test('writes the skill with a marker, then leaves an unchanged copy alone', () => {
    expect(syncSkill(vault)).toBe('written')
    expect(readFileSync(join(dir, 'SKILL.md'), 'utf8')).toBe(readFileSync(join(ROOT, 'skills/slidecraft-presentations/SKILL.md'), 'utf8'))
    expect(existsSync(join(dir, 'references', 'components.md'))).toBe(true)
    expect(JSON.parse(readFileSync(join(dir, MARKER_FILE), 'utf8')).generator).toBe('slidecraft')
    expect(syncSkill(vault)).toBe('unchanged')
  })
  test('updates a copy nobody edited when Slidecraft ships a new version', () => {
    const files = skillFiles()
    files.set('SKILL.md', Buffer.from('---\nname: slidecraft-presentations\ndescription: newer\n---\n'))
    files.delete('references/motion.md')
    expect(syncSkill(vault, files)).toBe('written')
    expect(readFileSync(join(dir, 'SKILL.md'), 'utf8')).toContain('newer')
    expect(existsSync(join(dir, 'references', 'motion.md'))).toBe(false)
  })
  test('never overwrites a copy a person edited, or one Slidecraft did not write', () => {
    writeFileSync(join(dir, 'SKILL.md'), '# my own rules\n')
    expect(syncSkill(vault)).toBe('hand-edited')
    expect(readFileSync(join(dir, 'SKILL.md'), 'utf8')).toBe('# my own rules\n')

    const other = normalizeContentSource('other', join(root, 'other'))
    mkdirSync(join(vaultSkillDir(other.path)), { recursive: true })
    writeFileSync(join(vaultSkillDir(other.path), 'SKILL.md'), '# hand-made\n')
    expect(syncSkill(other)).toBe('hand-edited')
  })
  test('skips read-only vaults and the repository\'s examples', () => {
    expect(syncSkill({ ...vault, readOnly: true })).toBe('read-only')
    expect(syncSkill({ ...vault, builtIn: true })).toBe('read-only')
  })
})

test('the print view uses the vault URL scheme', () => {
  expect(printViewUrl({ source: 'work', path: 'talks/q 3' }, 'http://localhost:6100/', 2)).toBe('http://localhost:6100/v/work/talks/q%203?pdf=1&slide=2')
})
