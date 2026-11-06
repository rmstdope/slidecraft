import { describe, expect, test } from 'bun:test'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { compile } from '@mdx-js/mdx'
import { parseDeck } from '../shared/deckParser.ts'
import { stripMdxFrontmatter } from '../shared/frontmatter.ts'
import { resolveDeckRelative, rewriteDeckImports } from '../shared/mdxImports.ts'
import { getMdxScope } from '../src/components/mdxScope'
import { loadFolder, registerFolders } from '../src/vault-api/loadComponents'
import { getAllTemplates, getSourceProblems } from '../src/components/slides/defineComponent'
import { registryLanguageService } from '../src/language-service/index'

const contentDir = join(import.meta.dir, '..', 'content')
const decks = readdirSync(contentDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && existsSync(join(contentDir, entry.name, 'index.mdx')))
  .map((entry) => join(contentDir, entry.name, 'index.mdx'))

test('the repo ships at least one example deck', () => {
  expect(decks.length).toBeGreaterThan(0)
})

// The Examples vault's own components (content/components/), loaded as the app loads them.
const EXAMPLES = 'examples-content-test'
const componentsDir = join(contentDir, 'components')
const folders = await Promise.all(
  (existsSync(componentsDir) ? readdirSync(componentsDir) : []).map((name) => loadFolder(name, 'test', () => import(join(componentsDir, name, 'index.tsx')))),
)
const templatesDir = join(contentDir, 'templates')
const templates = (existsSync(templatesDir) ? readdirSync(templatesDir) : [])
  .filter((id) => existsSync(join(templatesDir, id, 'index.mdx')))
  .map((id) => ({ id, text: readFileSync(join(templatesDir, id, 'index.mdx'), 'utf8') }))
registerFolders(EXAMPLES, folders, { templates })

test("the Examples vault's components load", () => {
  expect(folders.length).toBeGreaterThan(0)
  expect(folders.filter((f) => f.error).map((f) => `${f.name}: ${f.error}`)).toEqual([])
})

test("the Examples vault's templates parse and compile in its scope", async () => {
  expect(templates.length).toBeGreaterThan(0)
  expect(getSourceProblems(EXAMPLES)).toEqual([])
  const own = getAllTemplates(EXAMPLES).filter((t) => templates.some((f) => t.id === `template-${f.id}`))
  expect(own.length).toBe(templates.length)
  const ls = registryLanguageService(undefined, EXAMPLES)
  for (const t of own) {
    expect(ls.diagnostics(t.snippet).filter((d) => d.severity === 'error')).toEqual([])
    await compile(t.previewCode, {
      jsx: true,
      remarkPlugins: [[rewriteDeckImports, { deckName: t.id, knownComponents: Object.keys(getMdxScope(EXAMPLES)), resolveAsset: (_d: string, s: string) => s }]],
    })
  }
})

describe('example decks', () => {
  for (const file of decks) {
    test(`${file.slice(contentDir.length + 1)} compiles and its assets exist`, async () => {
      const missingAssets: string[] = []
      const deckDir = dirname(file)
      await compile(stripMdxFrontmatter(readFileSync(file, 'utf8')), {
        jsx: true,
        remarkPlugins: [
          [
            rewriteDeckImports,
            {
              deckName: deckDir.split('/').pop()!,
              knownComponents: Object.keys(getMdxScope(EXAMPLES)),
              unsupported: 'keep',
              resolveAsset: (_deck: string, src: string) => {
                if (!existsSync(join(deckDir, resolveDeckRelative(src)))) missingAssets.push(src)
                return src
              },
            },
          ],
        ],
      })
      expect(missingAssets).toEqual([])
      // The shared parser sees every slide, and an untouched parse round-trips.
      const source = readFileSync(file, 'utf8')
      const deck = parseDeck(source)
      expect(deck.slides.length).toBe((source.match(/^<Slide[\s>]/gm) ?? []).length)
    })
  }
})
