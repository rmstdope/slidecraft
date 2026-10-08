/**
 * YAML frontmatter is opaque (Part 0 §0.5 item 9): split off before every compile, preserved
 * byte for byte on save, never parsed or followed.
 */
const FRONTMATTER_RE = /^(---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$))/

export interface SplitFrontmatter {
  frontmatter: string
  body: string
}

export function splitMdxFrontmatter(source: string): SplitFrontmatter {
  const match = FRONTMATTER_RE.exec(source)
  if (!match) return { frontmatter: '', body: source }
  return { frontmatter: match[1], body: source.slice(match[1].length) }
}

export function stripMdxFrontmatter(source: string): string {
  return splitMdxFrontmatter(source).body
}
