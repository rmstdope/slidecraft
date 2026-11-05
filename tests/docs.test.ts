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

  test('the skills named in AGENTS.md exist, with frontmatter, and are linked into .claude/skills', () => {
    const agents = readFileSync(join(ROOT, 'AGENTS.md'), 'utf8')
    for (const skill of ['slidecraft-presentations', 'slidecraft-components', 'slidecraft-dev']) {
      expect(agents).toContain(`skills/${skill}/SKILL.md`)
      const text = readFileSync(join(ROOT, 'skills', skill, 'SKILL.md'), 'utf8')
      expect(text).toMatch(new RegExp(`^---\\nname: ${skill}\\ndescription: .+\\n---\\n`))
      expect(readFileSync(join(ROOT, '.claude/skills', skill, 'SKILL.md'), 'utf8')).toBe(text)
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
