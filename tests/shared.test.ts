import { describe, expect, test } from 'bun:test'
import { deckKey, deckName, deckQuery, RESERVED_DECK_NAMES } from '../shared/decks.ts'
import { splitMdxFrontmatter, stripMdxFrontmatter } from '../shared/frontmatter.ts'

describe('frontmatter', () => {
  const source = "---\ntitle: Q3\nsource_url: https://example.com\n---\nimport { Slide } from '@components'\n"

  test('split keeps the YAML block verbatim', () => {
    const { frontmatter, body } = splitMdxFrontmatter(source)
    expect(frontmatter).toBe('---\ntitle: Q3\nsource_url: https://example.com\n---\n')
    expect(frontmatter + body).toBe(source)
  })
  test('strip yields the text starting at the import', () => {
    expect(stripMdxFrontmatter(source).startsWith('import')).toBe(true)
  })
  test('handles CRLF and files without frontmatter', () => {
    expect(splitMdxFrontmatter('---\r\na: 1\r\n---\r\nbody').body).toBe('body')
    expect(stripMdxFrontmatter('no frontmatter')).toBe('no frontmatter')
    expect(stripMdxFrontmatter('--- not a fence')).toBe('--- not a fence')
  })
})

describe('deck refs', () => {
  const ref = { source: 'team space', path: 'presentations/quarterly' }
  test('key, name and query', () => {
    expect(deckKey(ref)).toBe('team space:presentations/quarterly')
    expect(deckName(ref)).toBe('quarterly')
    expect(deckQuery(ref)).toBe('source=team+space&path=presentations%2Fquarterly')
  })
  test('app routes are reserved deck names', () => {
    for (const name of ['gallery', 'chat', 'edit', 'api', 'content', 'content-source', 'images', 'themes']) {
      expect(RESERVED_DECK_NAMES.has(name)).toBe(true)
    }
  })
})
