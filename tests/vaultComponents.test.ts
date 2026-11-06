/**
 * Vault components, Phase V2: bundling and the import rule, the trust setting and its routes,
 * the server's own registry (validate_deck sees a vault's components), placeholders for
 * components that are not loaded, and the folder rule.
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { compile } from '@mdx-js/mdx'
import { bundleRequestName, checkFolderDefinitions, componentBundleUrl } from '../shared/vaultComponents.ts'
import { dropComponentImports } from '../shared/mdxImports.ts'
import { getComponentTrust, getContentSource, initContentSources, setComponentTrust } from '../server/lib/contentSources.ts'
import { bundleComponent, componentFolders, componentsSignature, listVaultComponents } from '../server/lib/vaultComponents.ts'
import { checkDeck } from '../server/lib/deckChecks.ts'
import { ensureServerComponents } from '../server/lib/serverRegistry.ts'
import { executeTool } from '../server/lib/tools.ts'
import { router } from '../server/index.ts'
import { exportDeck } from '../server/lib/exportDeck.ts'
import { PAYLOAD_ELEMENT_ID, type ExportPayload } from '../shared/exportPayload.ts'
import { getAllComponents, getSourceProblems, registerSource, clearSource } from '../src/components/slides/defineComponent'
import { getMdxScope } from '../src/components/mdxScope'
import { registerFolders, templateEntries } from '../src/vault-api/loadComponents'
import { parseTemplateFrontmatter, parseVaultTemplate } from '../shared/vaultTemplates.ts'
import { getAllTemplates } from '../src/components/slides/defineComponent'

const root = mkdtempSync(join(tmpdir(), 'slidecraft-vault-components-'))
const acme = join(root, 'acme')
const stranger = join(root, 'stranger')

const component = (name: string, body = '', extra = '') => `import { defineComponent, Text } from 'slidecraft'
${extra}
export const ${name} = defineComponent<{ label?: string }>({
  Component: ({ label = 'hi' }) => <Text>{label}${body}</Text>,
  registry: { id: '${name.toLowerCase()}', name: '${name}', category: 'component', description: 'A test component.', props: [{ name: 'label', type: 'string' }], snippet: '<${name} />', previewCode: '<Slide><${name} /></Slide>' },
})
`

function write(file: string, text: string) {
  mkdirSync(join(file, '..'), { recursive: true })
  writeFileSync(file, text)
}

const template = (name: string, body = '<Slide>\n  <Title>Thanks</Title>\n</Slide>') => `---\nname: ${name}\ndescription: Ends a pitch.\nkeywords: [close, end]\n---\n${body}\n`

const deck = (body: string) => `import { Presentation, Slide, Title } from '@components'\n\n<Presentation>\n\n<Slide>\n  <Title>T</Title>\n  ${body}\n</Slide>\n\n</Presentation>\n`

beforeAll(() => {
  write(join(acme, 'components', 'Funnel', 'index.tsx'), component('Funnel', '', "import { shout } from './shout'").replace("{label}", '{shout(label)}'))
  write(join(acme, 'components', 'Funnel', 'shout.ts'), 'export const shout = (s: string) => s.toUpperCase()\n')
  write(join(acme, 'components', 'Broken', 'index.tsx'), component('Broken', '{String(_)}', "import _ from 'lodash'"))
  write(join(acme, 'components', 'lowercase', 'index.tsx'), component('Lower'))
  write(join(acme, 'pitch', 'index.mdx'), deck('<Funnel label="x" />'))
  write(join(stranger, 'components', 'Funnel', 'index.tsx'), component('Funnel'))
  write(join(stranger, 'talk', 'index.mdx'), deck('<Funnel />'))
  write(join(stranger, 'templates', 'pitch-close', 'index.mdx'), template('Pitch Close'))
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
})
afterAll(() => rmSync(root, { recursive: true, force: true }))

const call = (path: string, init?: RequestInit) => router(new Request(`http://localhost:6110${path}`, init))

describe('finding and bundling', () => {
  test('only PascalCase folders with an index.tsx are components', () => {
    expect(componentFolders(getContentSource('acme')!)).toEqual(['Broken', 'Funnel'])
  })

  test('a bundle keeps the shared packages external and includes its own files', async () => {
    const bundle = await bundleComponent(getContentSource('acme')!, 'Funnel')
    expect(bundle.error).toBeUndefined()
    expect(bundle.code).toContain('from "slidecraft"')
    expect(bundle.code).toContain('from "react/jsx-runtime"')
    expect(bundle.code).toContain('toUpperCase')
    expect(bundle.code).not.toContain('jsx-dev-runtime')
    expect(bundle.code).not.toContain(root) // no file paths in the served code
  })

  test('an import outside the allowed packages is a compile error', async () => {
    const bundle = await bundleComponent(getContentSource('acme')!, 'Broken')
    expect(bundle.error).toContain('"lodash" cannot be imported')
  })

  test('the hash and the watcher signature change when a file does', async () => {
    const source = getContentSource('acme')!
    const before = (await bundleComponent(source, 'Funnel')).hash
    const signature = componentsSignature(source)
    const file = join(acme, 'components', 'Funnel', 'shout.ts')
    const original = readFileSync(file, 'utf8')
    writeFileSync(file, `${original}// changed\n`)
    try {
      expect((await bundleComponent(source, 'Funnel')).hash).not.toBe(before)
      expect(componentsSignature(source)).not.toBe(signature)
    } finally {
      writeFileSync(file, original)
    }
  })

  test('bundle URLs and the route that serves them agree', () => {
    const url = componentBundleUrl('my vault', 'Funnel', 'abc')
    expect(url).toBe('/content-source/my%20vault/components/Funnel/index.js?h=abc')
    expect(bundleRequestName('components/Funnel/index.js')).toBe('Funnel')
    expect(bundleRequestName('components/funnel/index.js')).toBeUndefined()
    expect(bundleRequestName('components/Funnel/other.js')).toBeUndefined()
  })
})

describe('trust', () => {
  test('a vault decides in config.json; unset means ask', () => {
    expect(getComponentTrust(getContentSource('acme')!)).toBe('trusted')
    expect(getComponentTrust(getContentSource('stranger')!)).toBe('ask')
  })

  test('an untrusted vault lists its folders but serves no bundle', async () => {
    const listing = await listVaultComponents(getContentSource('stranger')!)
    expect(listing).toMatchObject({ trust: 'ask', components: [{ name: 'Funnel' }] })
    expect(listing.components[0].url).toBeUndefined()
    const res = await call('/content-source/stranger/components/Funnel/index.js?h=x')
    expect(res.status).toBe(403)
  })

  test('a trusted vault serves its bundles as JavaScript', async () => {
    const listing = (await (await call('/api/vaults/acme/components')).json()) as { components: { name: string; url?: string; error?: string }[] }
    const funnel = listing.components.find((c) => c.name === 'Funnel')!
    expect(listing.components.find((c) => c.name === 'Broken')?.error).toContain('lodash')
    const res = await call(funnel.url!)
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('javascript')
    expect(await res.text()).toContain('defineComponent')
  })

  test('PUT stores the choice in the config file', async () => {
    const bad = await call('/api/vaults/stranger/components', { method: 'PUT', body: JSON.stringify({ trust: 'maybe' }) })
    expect(bad.status).toBe(400)
    const res = await call('/api/vaults/stranger/components', { method: 'PUT', body: JSON.stringify({ trust: 'blocked' }) })
    expect(res.status).toBe(200)
    expect(JSON.parse(readFileSync(join(root, 'config.json'), 'utf8')).vaults[1].components).toBe('blocked')
    const vaults = (await (await call('/api/vaults')).json()) as { vaults: { id: string; components: string }[] }
    expect(vaults.vaults.find((v) => v.id === 'stranger')?.components).toBe('blocked')
  })
})

describe('the server registry', () => {
  test('a trusted vault registers its components; a broken one is a problem', async () => {
    await ensureServerComponents('acme')
    expect(getAllComponents('acme').some((c) => c.registry.name === 'Funnel')).toBe(true)
    expect(getAllComponents(null).some((c) => c.registry.name === 'Funnel')).toBe(false)
    expect(getSourceProblems('acme').map((p) => p.name)).toEqual(['Broken'])
  })

  test("validate_deck knows the deck's vault components, and only in that vault", async () => {
    expect((await checkDeck(deck('<Funnel label="x" />'), 'acme')).ok).toBe(true)
    expect((await checkDeck(deck('<Funnel label="x" />'))).ok).toBe(false)
    const result = await executeTool('validate_deck', { name: 'pitch' }, { vault: 'acme' })
    expect(result).toMatchObject({ success: true, data: { ok: true } })
  })

  test('a blocked vault loads nothing; its components are a warning, not unknown', async () => {
    setComponentTrust('stranger', 'blocked')
    await ensureServerComponents('stranger')
    expect(getAllComponents('stranger').some((c) => c.registry.name === 'Funnel')).toBe(false)
    const result = await checkDeck(deck('<Funnel />'), 'stranger')
    expect(result.ok).toBe(true)
    expect(result.problems[0]).toMatchObject({ severity: 'warning' })
    expect(result.problems[0].message).toContain('not loaded')
  })

  test('allowing the vault later loads it', async () => {
    setComponentTrust('stranger', 'trusted')
    await ensureServerComponents('stranger')
    expect(getAllComponents('stranger').some((c) => c.registry.name === 'Funnel')).toBe(true)
  })
})

describe('review fixes', () => {
  test('trust is read from the config file, so a change by another process counts', () => {
    const file = join(root, 'config.json')
    const config = JSON.parse(readFileSync(file, 'utf8'))
    const before = getComponentTrust(getContentSource('acme')!)
    config.vaults[0].components = 'blocked'
    writeFileSync(file, JSON.stringify(config))
    try {
      expect(before).toBe('trusted')
      expect(getComponentTrust(getContentSource('acme')!)).toBe('blocked')
    } finally {
      config.vaults[0].components = 'trusted'
      writeFileSync(file, JSON.stringify(config))
    }
  })

  test('an HTML export names the vault components it cannot carry yet', async () => {
    const { html } = await exportDeck({ source: 'acme', path: 'pitch' }, { viewer: { js: '', css: '' } })
    const json = new RegExp(`id="${PAYLOAD_ELEMENT_ID}">([^<]*)<`).exec(html)![1]
    const payload = JSON.parse(json) as ExportPayload
    expect(payload.unavailable).toContain('Funnel')
    expect(payload.unavailable).toContain('Broken')
  })
})

describe('templates', () => {
  test('frontmatter: values, inline lists and dash lists', () => {
    expect(parseTemplateFrontmatter('name: "A b"\nkeywords: [x, \'y\']\nuseCases:\n  - one\n  - two\ntheme: folio # frame').values).toEqual({
      name: 'A b',
      keywords: ['x', 'y'],
      useCases: ['one', 'two'],
      theme: 'folio',
    })
  })

  test('frontmatter: # and commas inside quotes are text; multi-line values are reported', () => {
    // As in YAML, an unquoted " #" starts a comment; quotes keep it.
    const { values, problems } = parseTemplateFrontmatter('name: "Issue #3"\ndescription: Step #2 of 3\nkeywords: ["a, b", c]')
    expect(values).toEqual({ name: 'Issue #3', description: 'Step', keywords: ['a, b', 'c'] })
    expect(problems).toEqual([])
    expect(parseTemplateFrontmatter('description: >\n  folded text').problems.join('\n')).toContain('multi-line')
  })

  test('a byte-order mark and CRLF line ends are not part of the template', () => {
    const parsed = parseVaultTemplate({ id: 'w', text: `\uFEFF${template('Windows')}`.replace(/\n/g, '\r\n') })
    expect(parsed.template?.name).toBe('Windows')
    expect(parsed.template?.snippet).not.toContain('\r')
  })

  test('a template file becomes a registry entry; a theme wraps the preview', () => {
    const parsed = parseVaultTemplate({ id: 'close', text: template('Pitch Close').replace('---\n<Slide', 'theme: folio\n---\n<Slide') })
    expect(parsed.template).toMatchObject({ id: 'template-close', name: 'Pitch Close', description: 'Ends a pitch.', keywords: ['close', 'end'] })
    expect(parsed.template!.snippet).toBe('<Slide>\n  <Title>Thanks</Title>\n</Slide>')
    expect(parsed.template!.previewCode).toStartWith('<Presentation theme="folio">')
  })

  test('a template needs a name, a description and exactly one slide', () => {
    expect(parseVaultTemplate({ id: 'a', text: '<Slide />' }).error).toContain('frontmatter')
    expect(parseVaultTemplate({ id: 'a', text: '---\nname: A\n---\n<Slide></Slide>' }).error).toContain('no description')
    expect(parseVaultTemplate({ id: 'a', text: template('A', '<Slide></Slide>\n<Slide></Slide>') }).error).toContain('exactly one')
  })

  test('one named like a built-in replaces it; an id taken by another name is a problem', () => {
    const builtin = getAllTemplates(null)[0]
    const clashing = templateEntries([{ id: builtin.id.replace(/^template-/, ''), text: template('Something Else') }])
    expect(clashing.problems.map((p) => p.message).join('\n')).toContain(`is the built-in template ${builtin.name}'s`)
    const { templates, problems } = templateEntries([
      { id: 'mine', text: template(builtin.name) },
      { id: 'twice', text: template('Pitch Close') },
      { id: 'twice-again', text: template('Pitch Close') },
    ])
    expect(templates.map((t) => t.name)).toEqual([builtin.name, 'Pitch Close'])
    expect(problems.map((p) => p.message).join('\n')).toContain('also named Pitch Close')
    // Once the vault replaces that built-in by name, its id is free for a folder named after it.
    const freed = templateEntries([
      { id: 'mine', text: template(builtin.name) },
      { id: builtin.id.replace(/^template-/, ''), text: template('Something Else') },
    ])
    expect(freed.problems).toEqual([])
    registerFolders('template-test', [], { templates: [{ id: 'mine', text: template(builtin.name) }] })
    const view = getAllTemplates('template-test')
    expect(view.length).toBe(getAllTemplates(null).length)
    expect(view.find((t) => t.name === builtin.name)?.description).toBe('Ends a pitch.')
    // A template problem is not a component: no placeholder in the scope.
    registerFolders('template-test', [], { templates: [{ id: 'bad', text: 'nothing' }] })
    expect(getSourceProblems('template-test')[0]).toMatchObject({ template: true })
    expect('bad' in (getMdxScope('template-test') as Record<string, unknown>)).toBe(false)
    clearSource('template-test')
  })

  test("templates load in a vault whose components may not run", async () => {
    setComponentTrust('stranger', 'blocked')
    const listing = await listVaultComponents(getContentSource('stranger')!)
    expect(listing.templates.map((t) => t.id)).toEqual(['pitch-close'])
    await ensureServerComponents('stranger')
    expect(getAllTemplates('stranger').some((t) => t.name === 'Pitch Close')).toBe(true)
    setComponentTrust('stranger', 'trusted')
  })
})

describe('the app side', () => {
  test('a component that is not loaded gets a placeholder in the scope, unless a built-in has its name', () => {
    registerFolders('placeholder-test', [{ name: 'Gone', hash: 'h', components: [], error: 'boom' }], { blocked: ['Stat'] })
    const scope = getMdxScope('placeholder-test') as Record<string, unknown>
    expect(typeof scope.Gone).toBe('function')
    expect((scope.Gone as { displayName?: string }).displayName).toBe('Unavailable(Gone)')
    expect((scope.Stat as { displayName?: string }).displayName).toBe('Stat')
    clearSource('placeholder-test')
    expect(getSourceProblems('placeholder-test')).toEqual([])
  })

  test('registerSource keeps problems per vault', () => {
    registerSource('p1', {}, [{ name: 'A', message: 'x' }])
    expect(getSourceProblems('p1')).toEqual([{ name: 'A', message: 'x' }])
    expect(getSourceProblems('p2')).toEqual([])
    clearSource('p1')
  })

  test('a folder defines its own component and parts of it, nothing else', () => {
    expect(checkFolderDefinitions('Funnel', [{ name: 'Funnel' }, { name: 'FunnelStage', parent: 'Funnel' }])).toEqual([])
    expect(checkFolderDefinitions('Funnel', [{ name: 'Other' }]).join('\n')).toContain('does not define the component Funnel')
    expect(checkFolderDefinitions('Funnel', [{ name: 'Funnel' }, { name: 'Stray' }]).join('\n')).toContain('Stray is defined in components/Funnel/')
  })

  test('bundled decks drop their @components imports so the provider supplies every component', async () => {
    const out = String(
      await compile("import { Slide, Funnel } from '@components'\nimport pic from './a.png'\n\n<Slide><Funnel /></Slide>\n", {
        remarkPlugins: [dropComponentImports],
        providerImportSource: '@mdx-js/react',
      }),
    )
    expect(out).not.toContain("'@components'")
    expect(out).not.toContain('"@components"')
    expect(out).toContain('./a.png')
    expect(out).toContain('Funnel')
  })
})
