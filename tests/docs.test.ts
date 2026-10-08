import { describe, expect, test } from 'bun:test'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { PAGES } from '../scripts/buildSite'

const ROOT = join(import.meta.dir, '..')
const markdownUnder = (dir: string): string[] =>
  readdirSync(join(ROOT, dir), { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? markdownUnder(join(dir, e.name)) : e.name.endsWith('.md') ? [join(dir, e.name)] : [],
  )

const pageFiles = PAGES.flatMap((p) => (p.file ? [p.file] : []))

describe('documentation', () => {
  test('every site page exists', () => {
    expect(pageFiles.filter((f) => !existsSync(join(ROOT, f)))).toEqual([])
  })

  test('every doc is published on the site', () => {
    const docs = ['README.md', 'AGENTS.md', ...markdownUnder('docs')]
    expect(docs.filter((f) => !pageFiles.includes(f))).toEqual([])
  })

  test('the persona guides named in AGENTS.md exist', () => {
    const agents = readFileSync(join(ROOT, 'AGENTS.md'), 'utf8')
    for (const persona of ['presentation-author', 'component-developer', 'framework-developer']) {
      expect(agents).toContain(`docs/agents/${persona}.md`)
      expect(existsSync(join(ROOT, 'docs/agents', `${persona}.md`))).toBe(true)
    }
  })

  for (const file of pageFiles) {
    test(`relative links in ${file} resolve`, () => {
      const text = readFileSync(join(ROOT, file), 'utf8').replace(/```[\s\S]*?```/g, '')
      const broken = [...text.matchAll(/\]\(([^)\s]+)\)/g)]
        .map((m) => m[1].split('#')[0])
        .filter((href) => href && !/^[a-z]+:/i.test(href))
        .filter((href) => !existsSync(join(ROOT, dirname(file), href)))
        .map((href) => relative(ROOT, join(ROOT, dirname(file), href)))
      expect(broken).toEqual([])
    })
  }
})
