import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PAYLOAD_ELEMENT_ID, type ExportPayload } from '../shared/exportPayload.ts'
import { findChrome } from '../server/lib/chrome.ts'
import { initContentSources } from '../server/lib/contentSources.ts'
import { exportDeck } from '../server/lib/exportDeck.ts'
import { countPdfPages } from '../server/lib/exportPdf.ts'
import { router } from '../server/index.ts'

const root = mkdtempSync(join(tmpdir(), 'slidecraft-export-'))
const content = join(root, 'content')
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64')
const viewer = { js: 'console.log("viewer </script> safe")', css: 'body{color:red}</style>' }

beforeAll(() => {
  mkdirSync(join(content, 'talk', 'images'), { recursive: true })
  writeFileSync(join(content, 'talk', 'images', 'logo.png'), PNG)
  writeFileSync(join(content, 'talk', 'images', 'photo.png'), PNG)
  writeFileSync(
    join(content, 'talk', 'index.mdx'),
    `---\ntitle: Talk\n---\nimport { Presentation, Slide, Title, ContentImage } from '@components'\nimport logo from './images/logo.png'\n\n<Presentation theme="acme">\n\n<Slide>\n  <Title>{'Hello </script>'}</Title>\n  <ContentImage src={logo} />\n  <ContentImage src="images/photo.png" />\n</Slide>\n\n</Presentation>\n`,
  )
  mkdirSync(join(content, 'broken'), { recursive: true })
  writeFileSync(join(content, 'broken', 'index.mdx'), `import logo from './images/missing.png'\n\n<Presentation>\n<Slide><Title>x</Title></Slide>\n</Presentation>\n`)
  for (const [id, raw] of [
    ['acme', { name: 'Acme', extends: 'base-co', frames: { title: { svg: 'frames/t.svg' } } }],
    ['base-co', { name: 'Base' }],
    ['unused', { name: 'Unused' }],
  ] as const) {
    mkdirSync(join(content, 'themes', id, 'frames'), { recursive: true })
    writeFileSync(join(content, 'themes', id, 'theme.json'), JSON.stringify(raw))
    writeFileSync(join(content, 'themes', id, 'frames', 't.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>')
  }
  initContentSources({}, content, join(root, 'fallback'))
})
afterAll(() => rmSync(root, { recursive: true, force: true }))

const payloadOf = (html: string): ExportPayload => {
  const match = new RegExp(`<script type="application/json" id="${PAYLOAD_ELEMENT_ID}">([\\s\\S]*?)</script>`).exec(html)
  return JSON.parse(match![1]) as ExportPayload
}

describe('single-file HTML export', () => {
  test('embeds the compiled deck, its assets and the themes it uses', async () => {
    const { html, name } = await exportDeck({ source: 'default', path: 'talk' }, { viewer })
    expect(name).toBe('talk')
    const payload = payloadOf(html)
    const code = Buffer.from(payload.code, 'base64').toString('utf8')
    expect(code).toContain('data:image/png;base64,') // the imported logo
    expect(code).not.toContain('__SLIDECRAFT_ASSET_')
    expect(Object.keys(payload.assets)).toEqual(['images/photo.png']) // the string prop
    expect(payload.themes.map((t) => t.id).sort()).toEqual(['acme', 'base-co']) // used theme plus what it extends
    expect(payload.themes.find((t) => t.id === 'acme')!.assets['frames/t.svg']).toStartWith('data:image/svg+xml;base64,')
  })

  test('nothing in the deck or the viewer can close a script or style element early', async () => {
    const { html } = await exportDeck({ source: 'default', path: 'talk' }, { viewer })
    expect(html.match(/<\/script>/g)).toHaveLength(2) // the payload and the loader, nothing else
    expect(html).not.toContain('</style></style>')
    expect(html).toContain('<\\/style>')
  })

  test('a missing deck is a 404; a missing imported file names the file', async () => {
    const missing = await router(new Request('http://localhost/api/export/nope', { method: 'POST' }))
    expect(missing.status).toBe(404)
    await expect(exportDeck({ source: 'default', path: 'broken' }, { viewer })).rejects.toThrow('missing.png')
    expect((await router(new Request('http://localhost/api/export/a%2F..%2Fb', { method: 'POST' }))).status).toBe(400)
  })
})

describe('PDF export helpers', () => {
  test('CHROME_PATH wins, then the first installed candidate, else null', () => {
    expect(findChrome({ CHROME_PATH: '/x/chrome' }, (p) => p === '/x/chrome')).toBe('/x/chrome')
    expect(findChrome({}, (p) => p.includes('Chromium'))).toContain('Chromium')
    expect(findChrome({}, () => false)).toBeNull()
  })

  test('page counting ignores the page tree node', () => {
    const fake = new TextEncoder().encode('<< /Type /Pages /Count 2 >> << /Type /Page >> << /Type/Page >>')
    expect(countPdfPages(fake)).toBe(2)
  })
})
