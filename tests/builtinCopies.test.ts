/**
 * Vault components, Phase V5: which built-ins can be copied, the copy itself (every copyable one
 * compiles, registers and renders like the built-in), the origin record and the "built-in has
 * changed" note, reset, and the routes.
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createElement } from 'react'
import * as jsxRuntime from 'react/jsx-runtime'
import { renderToStaticMarkup } from 'react-dom/server'
import { evaluate } from '@mdx-js/mdx'
import { BUILTIN_COPIES_FILE, builtinCopiesText } from '../scripts/builtinCopies.ts'
import { copySource, ORIGIN_FILE, parseImports, templateCopyText, templateFolderOf, type BuiltinCopiesManifest } from '../shared/builtinCopies.ts'
import manifest from '../shared/builtinCopies.json'
import { parseVaultTemplate } from '../shared/vaultTemplates.ts'
import { copyBuiltin, copyPlan, originInfo, resetToBuiltin } from '../server/lib/builtinCopies.ts'
import { checkVaultComponent } from '../server/lib/componentChecks.ts'
import { getContentSource, initContentSources } from '../server/lib/contentSources.ts'
import { ensureServerComponents } from '../server/lib/serverRegistry.ts'
import { listVaultComponents } from '../server/lib/vaultComponents.ts'
import { handleVaults } from '../server/routes/content.ts'
import { getMdxScope } from '../src/components/mdxScope.tsx'
import { getAllComponents, getAllTemplates, getSourceProblems, sourceOfEntry } from '../src/components/slides/defineComponent.ts'

const copies = manifest as BuiltinCopiesManifest
const copyable = Object.entries(copies.components).filter(([, c]) => c.file).map(([name]) => name)

const root = mkdtempSync(join(tmpdir(), 'slidecraft-builtin-copies-'))
const acme = join(root, 'acme')
const shelf = join(root, 'shelf')
afterAll(() => rmSync(root, { recursive: true, force: true }))

beforeAll(() => {
  mkdirSync(join(acme, 'talk'), { recursive: true })
  writeFileSync(join(acme, 'talk', 'index.mdx'), '<Presentation>\n\n<Slide>\n  <Timeline events={[{ date: "1", title: "A" }]} />\n</Slide>\n\n</Presentation>\n')
  mkdirSync(join(acme, 'other'), { recursive: true })
  writeFileSync(join(acme, 'other', 'index.mdx'), '<Presentation>\n\n<Slide>\n  <Title>T</Title>\n</Slide>\n\n</Presentation>\n')
  mkdirSync(shelf, { recursive: true })
  initContentSources(
    {
      vaults: [
        { id: 'acme', name: 'Acme', path: acme, components: 'trusted' },
        { id: 'shelf', name: 'Shelf', path: shelf, readOnly: true },
      ],
    },
    undefined,
    join(root, 'fallback'),
    join(root, 'config.json'),
  )
})

const acmeSource = () => getContentSource('acme')!

/** A slide's MDX rendered to markup with a vault's scope (null: the built-ins only). */
async function render(mdx: string, vault: string | null): Promise<string> {
  const { default: Content } = await evaluate(mdx, { ...(jsxRuntime as Parameters<typeof evaluate>[1]), development: false })
  return renderToStaticMarkup(createElement(Content, { components: getMdxScope(vault) as never }))
}

describe('the manifest of copyable built-ins', () => {
  test('is up to date (run `bun run skills` when this fails)', async () => {
    expect(readFileSync(BUILTIN_COPIES_FILE, 'utf8')).toBe(await builtinCopiesText())
  })

  test('says why the others cannot be copied', () => {
    expect(copies.components.Slide.reason).toContain('part of how every deck is built')
    expect(copies.components.Gauge.reason).toContain('shares its file with GaugeRow')
    expect(copies.components.SplitBackground.reason).toContain('@shared/themes.ts')
    expect(copies.components.BlockDiagram.reason).toContain('drawProps')
    expect(copies.components.Timeline).toEqual({ file: 'Timeline.tsx', parts: [] })
    expect(copies.components.List).toEqual({ file: 'List.tsx', parts: ['ListItem'] })
    expect(copyable.length).toBeGreaterThan(30)
  })
})

describe('the copy', () => {
  test('imports are read, and only the app ones point at slidecraft', () => {
    const source = "import { motion } from 'motion/react'\nimport { accentShades, type AccentColor } from './accents'\nimport type { X } from '../../animations/variants'\nimport './side'\n\nconst a = 1\n"
    const imports = parseImports(source)
    expect(imports.map((i) => i.spec)).toEqual(['motion/react', './accents', '../../animations/variants', './side'])
    expect(imports[1].named).toEqual([
      { name: 'accentShades', type: false },
      { name: 'AccentColor', type: true },
    ])
    expect(imports[2]).toMatchObject({ typeOnly: true, named: [{ name: 'X', type: true }] })
    expect(imports[3].sideEffect).toBe(true)
    const copy = copySource(source, 'Thing', '1.2.3')
    expect(copy).toContain("from 'motion/react'")
    expect(copy).toContain("import { accentShades, type AccentColor } from 'slidecraft'")
    expect(copy).toContain("import type { X } from 'slidecraft'")
    expect(copy.split('\n')[0]).toContain("Copied from Slidecraft's built-in Thing (app 1.2.3)")
  })

  test('the dialog learns what copying Timeline does', async () => {
    expect(await copyPlan(acmeSource(), 'component', 'Timeline')).toEqual({ kind: 'component', name: 'Timeline', folder: 'components/Timeline', copyable: true, parts: [], decks: 1, exists: false })
    expect(await copyPlan(acmeSource(), 'component', 'Gauge')).toMatchObject({ copyable: false, reason: expect.stringContaining('GaugeRow') })
    expect(copyPlan(acmeSource(), 'component', 'Nope')).rejects.toThrow('No built-in component')
  })

  test('every copyable built-in copies, compiles, registers in the vault and renders as the built-in', async () => {
    for (const name of copyable) await copyBuiltin(acmeSource(), 'component', name)
    await ensureServerComponents('acme')
    expect(getSourceProblems('acme').filter((p) => !p.template)).toEqual([])
    const own = new Map(getAllComponents('acme').filter((c) => sourceOfEntry(c.registry) === 'acme').map((c) => [c.registry.name, c]))
    const mismatched: string[] = []
    for (const name of copyable) {
      expect(own.has(name)).toBe(true)
      for (const part of copies.components[name].parts ?? []) expect(own.get(part)?.registry.parent).toBe(name)
      const builtin = getAllComponents(null).find((c) => c.registry.name === name)!
      expect(own.get(name)!.Component).not.toBe(builtin.Component)
      expect(own.get(name)!.registry.previewCode).toBe(builtin.registry.previewCode)
      if ((await render(builtin.registry.previewCode, 'acme')) !== (await render(builtin.registry.previewCode, null))) mismatched.push(name)
    }
    expect(mismatched).toEqual([])
  })

  test('every copy passes validate_component, so the agent starts from a clean check', async () => {
    const failing: string[] = []
    for (const name of copyable) {
      const check = await checkVaultComponent('acme', name)
      if (!check.ok) failing.push(`${name}: ${check.problems.filter((p) => p.severity === 'error').map((p) => p.message).join('; ')}`)
    }
    expect(failing).toEqual([])
  })

  test('the copy records its origin, and the listing reports it', async () => {
    const dir = join(acme, 'components', 'Timeline')
    const origin = JSON.parse(readFileSync(join(dir, ORIGIN_FILE), 'utf8'))
    expect(origin).toMatchObject({ kind: 'component', builtin: 'Timeline', appVersion: expect.any(String), hash: expect.stringMatching(/^[0-9a-f]{16}$/) })
    expect(readFileSync(join(dir, 'index.tsx'), 'utf8')).not.toContain("from './")
    const listing = await listVaultComponents(acmeSource())
    expect(listing.components.find((c) => c.name === 'Timeline')?.origin).toMatchObject({ builtin: 'Timeline', changed: false })
  })

  test('a built-in that changed since the copy is noticed', () => {
    const file = join(acme, 'components', 'Card', ORIGIN_FILE)
    const origin = JSON.parse(readFileSync(file, 'utf8'))
    writeFileSync(file, JSON.stringify({ ...origin, hash: '0000000000000000' }))
    expect(originInfo(acmeSource(), 'component', 'Card')?.changed).toBe(true)
  })

  test('copying refuses what it cannot do', async () => {
    expect(copyBuiltin(acmeSource(), 'component', 'Timeline')).rejects.toMatchObject({ status: 409 })
    expect(copyBuiltin(acmeSource(), 'component', 'Slide')).rejects.toMatchObject({ status: 400 })
    expect(copyBuiltin(getContentSource('shelf')!, 'component', 'Card')).rejects.toMatchObject({ status: 403 })
  })
})

describe('templates', () => {
  test('every built-in template copies to a vault template with the same entry', async () => {
    for (const t of getAllTemplates(null)) {
      const parsed = parseVaultTemplate({ id: templateFolderOf(t), text: templateCopyText(t) })
      expect(parsed.error).toBeUndefined()
      expect(parsed.template).toEqual({ id: t.id, name: t.name, description: t.description, keywords: t.keywords ?? [], useCases: t.useCases ?? [], snippet: t.snippet.trim(), previewCode: t.previewCode.trim() })
    }
  })

  test('a copied template replaces the built-in in the vault', async () => {
    const title = getAllTemplates(null)[0]
    const plan = await copyBuiltin(acmeSource(), 'template', title.name)
    expect(plan.folder).toBe(`templates/${templateFolderOf(title)}`)
    await ensureServerComponents('acme')
    const inVault = getAllTemplates('acme').filter((t) => t.name === title.name)
    expect(inVault.length).toBe(1)
    expect(sourceOfEntry(inVault[0])).toBe('acme')
    expect(originInfo(acmeSource(), 'template', templateFolderOf(title))).toMatchObject({ builtin: title.name, changed: false })
  })
})

describe('reset', () => {
  test('deletes the copy, so the built-in is back', async () => {
    expect(resetToBuiltin(acmeSource(), 'component', 'Timeline')).toBe('Timeline')
    expect(existsSync(join(acme, 'components', 'Timeline'))).toBe(false)
    await ensureServerComponents('acme')
    expect(sourceOfEntry(getAllComponents('acme').find((c) => c.registry.name === 'Timeline')!.registry)).toBe('builtin')
  })

  test('refuses a folder that replaces no built-in', () => {
    mkdirSync(join(acme, 'components', 'MyOwn'), { recursive: true })
    expect(() => resetToBuiltin(acmeSource(), 'component', 'MyOwn')).toThrow('does not replace a built-in')
    expect(() => resetToBuiltin(acmeSource(), 'component', '../talk')).toThrow('does not replace a built-in')
    expect(existsSync(join(acme, 'components', 'MyOwn'))).toBe(true)
  })
})

describe('the routes', () => {
  const call = (method: string, path: string, body?: unknown) =>
    handleVaults(new Request(`http://x/api/vaults/acme/components/${path}`, { method, body: body ? JSON.stringify(body) : undefined }), new URL(`http://x/api/vaults/acme/components/${path}`))

  test('plan, copy and reset', async () => {
    const plan = await call('GET', 'copy?kind=component&name=Timeline')
    expect(await plan.json()).toMatchObject({ copyable: true, exists: false, decks: 1 })
    const copied = await call('POST', 'copy', { kind: 'component', name: 'Timeline' })
    expect(copied.status).toBe(201)
    expect(existsSync(join(acme, 'components', 'Timeline', 'index.tsx'))).toBe(true)
    expect((await call('POST', 'copy', { kind: 'component', name: 'Timeline' })).status).toBe(409)
    expect((await call('POST', 'copy', { kind: 'component', name: 'Gauge' })).status).toBe(400)
    expect((await call('POST', 'copy', { kind: 'widget', name: 'Timeline' })).status).toBe(400)
    const reset = await call('POST', 'reset', { kind: 'component', folder: 'Timeline' })
    expect(await reset.json()).toEqual({ builtin: 'Timeline' })
    expect((await call('POST', 'reset', { kind: 'component', folder: 'Timeline' })).status).toBe(404)
  })
})
