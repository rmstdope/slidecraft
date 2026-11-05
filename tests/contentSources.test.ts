import { afterAll, describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { sourceContentAssetUrl } from '../shared/mdxImports.ts'
import { migrateConfig, normalizeContentSource, normalizeContentSources } from '../server/lib/contentSources.ts'
import { vaultIdFromName } from '../shared/decks.ts'
import { discoverContentSources, globToRegex, resolveDeckRefInSources, resolveWritableDeckRefInSources } from '../server/lib/decks.ts'

const root = mkdtempSync(join(tmpdir(), 'slidecraft-sources-'))
afterAll(() => rmSync(root, { recursive: true, force: true }))
const deck = (dir: string) => {
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'index.mdx'), '<Presentation>\n</Presentation>\n')
}

describe('normalisation', () => {
  test('a string source is legacy: top-level decks only, writable', () => {
    expect(normalizeContentSource('mine', root)).toMatchObject({ include: ['*/index.mdx'], readOnly: false })
  })
  test('a descriptor defaults to top-level and presentations/ decks; readOnly is kept', () => {
    expect(normalizeContentSource('team', { path: root })).toMatchObject({ include: ['*/index.mdx', 'presentations/*/index.mdx'], readOnly: false })
    expect(normalizeContentSource('ro', { path: root, readOnly: true }).readOnly).toBe(true)
  })
  test('unsafe include patterns are dropped and a path is required', () => {
    expect(normalizeContentSource('x', { path: root, include: ['./a/*/index.mdx', '/abs/*', '../up/*', ''] }).include).toEqual(['a/*/index.mdx'])
    expect(() => normalizeContentSource('x', { path: root, include: ['../*'] })).toThrow('at least one safe include pattern')
    expect(() => normalizeContentSource('x', '  ')).toThrow('must define a path')
  })
  test('precedence: requested vault, then the last vault, then the first vault, then the examples', () => {
    const config = { default: 'mine', contents: { mine: join(root, 'mine'), team: { path: join(root, 'team'), include: 'presentations/*/index.mdx' } } }
    const requested = normalizeContentSources(config, 'team', '/content/examples', { bundled: false })
    expect(requested.defaultSourceId).toBe('team')
    expect(requested.sources.map((s) => s.id)).toEqual(['mine', 'team', 'examples'])
    expect(normalizeContentSources(config, undefined, '/content/examples', { bundled: false }).defaultSourceId).toBe('mine')
    expect(normalizeContentSources(config, 'Team', '/x', { bundled: false }).defaultSourceId).toBe('team')
    const byPath = normalizeContentSources(config, join(root, 'elsewhere'), '/fallback', { bundled: false })
    expect(byPath.sources[0]).toMatchObject({ id: 'elsewhere', name: 'elsewhere', path: join(root, 'elsewhere'), temporary: true })
    expect(normalizeContentSources({}, undefined, root, { bundled: false })).toMatchObject({ defaultSourceId: 'examples' })
    const vaults = { vaults: [{ name: 'Work', path: join(root, 'w') }, { name: 'Private', path: join(root, 'p') }] }
    expect(normalizeContentSources(vaults, undefined, '/x', { bundled: false }).defaultSourceId).toBe('work')
    expect(normalizeContentSources({ ...vaults, lastVault: 'private' }, undefined, '/x', { bundled: false }).defaultSourceId).toBe('private')
  })
  test('the fallback directory is flagged built-in when a configured source already mounts it', () => {
    const result = normalizeContentSources({ contents: { repo: { path: root } } }, undefined, root, { bundled: false })
    expect(result.sources).toHaveLength(1)
    expect(result.sources[0].builtIn).toBe(true)
    expect(result.defaultSourceId).toBe('repo')
  })
  test('in the release binary the working directory is a temporary vault only when there is no vault', () => {
    expect(normalizeContentSources({}, undefined, join(root, 'here'), { bundled: true }).sources).toEqual([expect.objectContaining({ id: 'here', temporary: true, builtIn: false })])
    const withVault = normalizeContentSources({ vaults: [{ name: 'Work', path: join(root, 'w') }] }, undefined, join(root, 'here'), { bundled: true })
    expect(withVault.sources.map((s) => s.id)).toEqual(['work'])
  })
})

describe('vault config', () => {
  test('content sources migrate to vaults; other settings are kept', () => {
    const { config, changed } = migrateConfig({ default: 'team', contents: { mine: '~/decks', team: { path: '/t', readOnly: true } }, agent: { model: 'x' } })
    expect(changed).toBe(true)
    expect(config).toEqual({
      agent: { model: 'x' },
      vaults: [
        { id: 'mine', name: 'Mine', path: '~/decks', include: ['*/index.mdx'] },
        { id: 'team', name: 'Team', path: '/t', readOnly: true },
      ],
      lastVault: 'team',
    })
    expect(migrateConfig(config).changed).toBe(false)
  })
  test('vault ids come from names and stay unique', () => {
    expect(vaultIdFromName('Work Stuff!')).toBe('work-stuff')
    expect(vaultIdFromName('Privé')).toBe('prive')
    expect(vaultIdFromName('!!!')).toBe('vault')
    const { sources } = normalizeContentSources({ vaults: [{ name: 'Work', path: '/a' }, { name: 'work', path: '/b' }] }, undefined, '/x', { bundled: false })
    expect(sources.map((s) => [s.id, s.name])).toEqual([['work', 'Work'], ['work-2', 'work'], ['examples', 'Examples']])
  })
})

describe('globs and refs', () => {
  test('glob conversion', () => {
    expect(globToRegex('*/index.mdx').test('a/index.mdx')).toBe(true)
    expect(globToRegex('*/index.mdx').test('a/b/index.mdx')).toBe(false)
    expect(globToRegex('**/index.mdx').test('a/b/index.mdx')).toBe(true)
    expect(globToRegex('**/index.mdx').test('index.mdx')).toBe(true)
  })

  const local = normalizeContentSource('local', join(root, 'local'))
  const team = normalizeContentSource('team', { path: join(root, 'team'), readOnly: true })
  deck(join(root, 'local', 'quarterly'))
  deck(join(root, 'local', 'presentations', 'ignored'))
  deck(join(root, 'team', 'presentations', 'quarterly'))
  deck(join(root, 'team', '.hidden'))

  test('traversal and include mismatches do not resolve', () => {
    expect(resolveDeckRefInSources({ source: 'local', path: '../outside' }, [local])).toBeNull()
    expect(resolveDeckRefInSources({ source: 'team', path: 'presentations/../../outside' }, [team])).toBeNull()
    expect(resolveDeckRefInSources({ source: 'local', path: 'presentations/ignored' }, [local])).toBeNull()
    expect(resolveDeckRefInSources({ source: 'nope', path: 'quarterly' }, [local])).toBeNull()
    expect(resolveDeckRefInSources({ source: 'local', path: 'quarterly' }, [local])?.mdxPath).toBe(join(root, 'local', 'quarterly', 'index.mdx'))
  })

  test('read-only sources refuse writes', () => {
    expect(resolveWritableDeckRefInSources({ source: 'team', path: 'presentations/quarterly' }, [team])).toEqual({ error: 'read-only' })
  })

  test('discovery across sources keeps the same slug apart and filters by source and path', async () => {
    const all = await discoverContentSources([local, team])
    expect(all.map((d) => `${d.source}:${d.path}`)).toEqual(['local:quarterly', 'team:presentations/quarterly'])
    const filtered = await discoverContentSources([local, team], { source: 'team', path: 'presentations/' })
    expect(filtered.map((d) => d.path)).toEqual(['presentations/quarterly'])
    expect(filtered[0].readOnly).toBe(true)
  })

  test('source ids are percent-encoded in asset URLs', () => {
    expect(sourceContentAssetUrl('id with space', 'presentations/quarterly', './images/chart.svg')).toBe('/content-source/id%20with%20space/presentations/quarterly/images/chart.svg')
  })
})
