import { describe, expect, test } from 'bun:test'
import { compile } from '@mdx-js/mdx'
import {
  contentAssetUrl,
  DeckImportError,
  resolveDeckRelative,
  rewriteDeckImports,
  sourceContentAssetUrl,
  type RewriteDeckImportsOptions,
} from '../shared/mdxImports.ts'

const options = (extra: Partial<RewriteDeckImportsOptions> = {}): RewriteDeckImportsOptions => ({
  deckName: 'demo',
  resolveAsset: (deck, src) => contentAssetUrl(deck, src),
  knownComponents: ['Presentation', 'Slide', 'Title'],
  ...extra,
})

const run = (source: string, extra?: Partial<RewriteDeckImportsOptions>) =>
  compile(source, { outputFormat: 'function-body', remarkPlugins: [[rewriteDeckImports, options(extra)]] }).then(String)

describe('rewriteDeckImports', () => {
  test('drops @components imports and turns asset imports into URL constants', async () => {
    const code = await run("import { Slide, Title } from '@components'\nimport pic from './images/pic.png'\n\n<Slide><Title>Hi</Title></Slide>\n")
    expect(code).not.toContain('@components')
    expect(code).toContain('const pic = "/content/demo/images/pic.png"')
  })

  test('unknown component names throw', async () => {
    await expect(run("import { Nope } from '@components'\n\n# x\n")).rejects.toThrow(/imports "Nope".*no such component/)
  })

  test('other imports throw by default and are kept on request', async () => {
    await expect(run("import x from './helper.tsx'\n\n# x\n")).rejects.toBeInstanceOf(DeckImportError)
    const kept = await run("import x from './helper.tsx'\n\n# x\n", { unsupported: 'keep' })
    expect(kept).toContain('helper.tsx')
  })
})

describe('asset URLs', () => {
  test('normalise relative paths and refuse to escape the deck', () => {
    expect(resolveDeckRelative('./images/../pic.png')).toBe('pic.png')
    expect(() => resolveDeckRelative('../secret.png')).toThrow(DeckImportError)
  })
  test('source URLs percent-encode the source id', () => {
    expect(sourceContentAssetUrl('id with space', 'presentations/quarterly', './images/chart.svg')).toBe(
      '/content-source/id%20with%20space/presentations/quarterly/images/chart.svg',
    )
  })
})
