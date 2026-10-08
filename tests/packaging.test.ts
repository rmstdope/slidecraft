import { describe, expect, test } from 'bun:test'
import { embeddedModule, TARGETS } from '../scripts/buildRelease'
import { PAGES, resolveLink, type Page } from '../scripts/buildSite'

describe('release binaries', () => {
  test('the embedded table imports each file as a file and maps its app path', () => {
    const module = embeddedModule(['dist/index.html', 'public/logo-on-dark.svg'])
    expect(module).toContain("import f0 from '../dist/index.html' with { type: 'file' }")
    expect(module).toContain('"public/logo-on-dark.svg": f1,')
    expect(module).toContain('export const embedded: Record<string, string> = {')
  })

  test('targets cover macOS, Linux and Windows', () => {
    expect(Object.values(TARGETS)).toEqual(expect.arrayContaining(['bun-darwin-arm64', 'bun-darwin-x64', 'bun-linux-x64', 'bun-windows-x64']))
  })

  test('the tracked stub is the empty map', async () => {
    const { embedded } = await import('../server/embedded.generated.ts')
    expect(embedded).toEqual({})
  })
})

describe('docs site links', () => {
  const pages: Page[] = PAGES
  const repo = 'https://github.com/example/slidecraft'

  test('links to pages become page URLs, from any folder', () => {
    expect(resolveLink('docs/agents/presentation-author.md', 'README.md', pages, repo)).toBe('presentation-author.html')
    expect(resolveLink('../../README.md#run-from-a-checkout', 'docs/agents/presentation-author.md', pages, repo)).toBe('./#run-from-a-checkout')
    expect(resolveLink('../plans/implementation-plan.md', 'docs/agents/presentation-author.md', pages, repo)).toBe('implementation-plan.html')
  })

  test('other repo files go to the repository; absolute links and anchors stay', () => {
    expect(resolveLink('server/mcp.ts', 'README.md', pages, repo)).toBe(`${repo}/blob/main/server/mcp.ts`)
    expect(resolveLink('https://bun.sh', 'README.md', pages, repo)).toBe('https://bun.sh')
    expect(resolveLink('#usage', 'README.md', pages, repo)).toBe('#usage')
    expect(resolveLink('mailto:a@b.c', 'README.md', pages, repo)).toBe('mailto:a@b.c')
  })
})
