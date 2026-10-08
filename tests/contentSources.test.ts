import { afterAll, describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { sourceContentAssetUrl } from '../shared/mdxImports.ts'
import { normalizeContentSource, normalizeContentSources } from '../server/lib/contentSources.ts'
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
  test('precedence: requested source, then config default, then the fallback', () => {
    const config = { default: 'mine', contents: { mine: join(root, 'mine'), team: { path: join(root, 'team'), include: 'presentations/*/index.mdx' } } }
    const requested = normalizeContentSources(config, 'team', '/content/built-in')
    expect(requested.defaultSourceId).toBe('team')
    expect(requested.sources.map((s) => s.id)).toEqual(['mine', 'team', 'built-in'])
    expect(normalizeContentSources(config, undefined, '/content/built-in').defaultSourceId).toBe('mine')
    const byPath = normalizeContentSources(config, join(root, 'elsewhere'), '/fallback')
    expect(byPath.sources[0]).toMatchObject({ id: 'default', path: join(root, 'elsewhere') })
    expect(normalizeContentSources({}, undefined, root)).toMatchObject({ defaultSourceId: 'built-in' })
  })
  test('the fallback directory is flagged built-in when a configured source already mounts it', () => {
    const result = normalizeContentSources({ contents: { repo: { path: root } } }, undefined, root)
    expect(result.sources).toHaveLength(1)
    expect(result.sources[0].builtIn).toBe(true)
    expect(result.defaultSourceId).toBe('repo')
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
