/**
 * Vault components, Phase V6: an HTML export of a deck that uses a vault component and a vault
 * copy of a built-in plays offline as in the app. The page is opened from a file in headless
 * Chrome, with the real viewer; both are needed (`bun run build` and Chrome), else it is skipped.
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { copyBuiltin } from '../server/lib/builtinCopies.ts'
import { findChrome, launchChrome } from '../server/lib/chrome.ts'
import { getContentSource, initContentSources } from '../server/lib/contentSources.ts'
import { exportDeck } from '../server/lib/exportDeck.ts'
import { exportDeckPdf, printViewUrl } from '../server/lib/exportPdf.ts'
import { router } from '../server/index.ts'

const root = mkdtempSync(join(tmpdir(), 'slidecraft-vault-export-'))
const acme = join(root, 'acme')
const stranger = join(root, 'stranger')
afterAll(() => rmSync(root, { recursive: true, force: true }))

const funnel = `import { defineComponent, Text } from 'slidecraft'
import { shout } from './shout'

export const Funnel = defineComponent<{ label?: string }>({
  Component: ({ label = 'hi' }) => <Text>{shout(label)}</Text>,
  registry: { id: 'funnel', name: 'Funnel', category: 'component', description: 'A test component.', props: [{ name: 'label', type: 'string' }], snippet: '<Funnel />', previewCode: '<Slide><Funnel /></Slide>' },
})
`

const deck = `<Presentation>

<Slide>
  <Title>Exported</Title>
  <Funnel label="from the vault" />
  <Callout label="Note">plain words</Callout>
</Slide>

</Presentation>
`

function write(file: string, text: string) {
  mkdirSync(join(file, '..'), { recursive: true })
  writeFileSync(file, text)
}

beforeAll(async () => {
  for (const vault of [acme, stranger]) {
    write(join(vault, 'components', 'Funnel', 'index.tsx'), funnel)
    write(join(vault, 'components', 'Funnel', 'shout.ts'), 'export const shout = (s: string) => s.toUpperCase()\n')
    write(join(vault, 'pitch', 'index.mdx'), deck)
  }
  initContentSources(
    {
      vaults: [
        { id: 'acme', name: 'Acme', path: acme, components: 'trusted' },
        { id: 'stranger', name: 'Stranger', path: stranger },
      ],
    },
    undefined,
    join(root, 'fallback'),
    join(root, 'config.json'),
  )
  // The vault's copy of Callout says so: the export must use it, not the built-in.
  for (const vault of ['acme', 'stranger']) {
    await copyBuiltin(getContentSource(vault)!, 'component', 'Callout')
    const copy = join(getContentSource(vault)!.path, 'components', 'Callout', 'index.tsx')
    writeFileSync(copy, readFileSync(copy, 'utf8').replace('>{children}</span>', '>vault copy: {children}</span>'))
  }
})

const chrome = findChrome()
const viewerBuilt = existsSync(join(import.meta.dir, '..', 'dist', 'viewer', 'viewer.js'))

const appBuilt = existsSync(join(import.meta.dir, '..', 'dist', 'index.html'))

/** Opens a page in headless Chrome and returns the text on screen once the deck shows. */
async function textAt(url: string): Promise<{ text: string; errors: string[] }> {
  const browser = await launchChrome(chrome!)
  try {
    const page = await browser.newPage()
    await page.send('Page.navigate', { url })
    let text = ''
    for (let i = 0; i < 100 && !text.includes('Exported'); i++) {
      await new Promise((r) => setTimeout(r, 100))
      text = await page.evaluate<string>('document.body.innerText').catch(() => '')
    }
    // Let the slide's motion finish and any late errors land.
    await new Promise((r) => setTimeout(r, 800))
    text = await page.evaluate<string>('document.body.innerText')
    const errors = await page.evaluate<string[]>(`[...document.querySelectorAll('pre')].map((p) => p.textContent)`)
    return { text, errors }
  } finally {
    browser.close()
  }
}

/** Exports the vault's deck to a file and opens it from there, with no server. */
async function shown(vault: string): Promise<{ text: string; errors: string[] }> {
  const { html } = await exportDeck({ source: vault, path: 'pitch' })
  const file = join(root, `${vault}.html`)
  writeFileSync(file, html)
  return textAt(pathToFileURL(file).href)
}

describe.skipIf(!chrome || !viewerBuilt)('an exported deck with vault components, opened from a file', () => {
  test('plays the vault component and the vault copy of a built-in', async () => {
    const { text, errors } = await shown('acme')
    expect(errors).toEqual([])
    expect(text).toContain('FROM THE VAULT')
    expect(text).toContain('vault copy: plain words')
  }, 30000)

  test('an untrusted vault: a placeholder for its own component, the built-in for the override', async () => {
    // stranger's components may not run: neither its Funnel nor its copy of Callout.
    const { text, errors } = await shown('stranger')
    expect(errors).toEqual([])
    expect(text).not.toContain('FROM THE VAULT')
    expect(text).toContain('Funnel')
    expect(text).toContain('plain words')
    expect(text).not.toContain('vault copy')
  }, 30000)
})

describe.skipIf(!chrome || !appBuilt)('a PDF of a deck with vault components', () => {
  // PDF goes through the app's print view, which loads vault components as every deck page does.
  test('the print view shows the vault component and the copy, and prints one page', async () => {
    const server = Bun.serve({ port: 0, fetch: router })
    try {
      const origin = `http://localhost:${server.port}`
      const { text } = await textAt(printViewUrl({ source: 'acme', path: 'pitch' }, origin))
      expect(text).toContain('FROM THE VAULT')
      expect(text).toContain('vault copy: plain words')
      const { pages } = await exportDeckPdf({ source: 'acme', path: 'pitch' }, origin)
      expect(pages).toBe(1)
    } finally {
      server.stop(true)
    }
  }, 60000)
})
