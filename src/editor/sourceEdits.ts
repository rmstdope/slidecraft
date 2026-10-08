/** Source rewrites behind the contextual toolbar (Part 3 §2.10), on plain text. */
import { scanTag, setTagAttr, type TagAttrValue } from '@shared/tagAttrs.ts'

/**
 * Toolbar values become attributes: "true" → bare attribute, "false" or "" → removed, numbers →
 * `{n}`, anything else → a quoted string.
 */
export function toolbarValue(value: string): TagAttrValue | null {
  if (value === 'true') return true
  if (value === 'false' || value === '') return null
  if (/^-?\d+(\.\d+)?$/.test(value)) return { expression: value }
  return value
}

/** Set a prop on the tag that starts at `tagStart` (the `<`). */
export const setPropAt = (text: string, tagStart: number, prop: string, value: string): string => setTagAttr(text, prop, toolbarValue(value), tagStart)

/** The element starting at `tagStart`, including its closing tag (or the self-closing tag alone). */
export function elementRange(text: string, tagStart: number): { start: number; end: number } | null {
  const tag = scanTag(text, tagStart)
  if (!tag) return null
  if (tag.selfClosing) return { start: tagStart, end: tag.end }
  let depth = 1
  const re = new RegExp(`<(/?)${tag.name.replace('.', '\\.')}(?=[\\s>/])`, 'g')
  re.lastIndex = tag.end
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    if (m[1]) {
      if (--depth === 0) return { start: tagStart, end: text.indexOf('>', m.index) + 1 }
    } else if (!scanTag(text, m.index)?.selfClosing) depth++
  }
  return null
}

/** Remove the element at `tagStart` with the blank line it leaves behind. */
export function deleteElementAt(text: string, tagStart: number): string {
  const range = elementRange(text, tagStart)
  if (!range) return text
  let start = range.start
  let end = range.end
  while (start > 0 && (text[start - 1] === ' ' || text[start - 1] === '\t')) start--
  if (text[end] === '\n') end++
  return text.slice(0, start) + text.slice(end)
}

/**
 * Re-indent JSX by nesting, two spaces per level (Part 3 §3.1). Lines inside template literals and
 * multi-line opening tags are left as written; blank lines are kept.
 */
export function formatMdx(content: string): string {
  let level = 0
  let inTemplate = false
  let inTag = false
  const out: string[] = []
  for (const raw of content.split('\n')) {
    const line = raw.trim()
    if (inTemplate || inTag) {
      out.push(raw)
    } else if (line === '') {
      out.push('')
    } else {
      if (/^<\/[A-Z][\w.]*>$/.test(line)) level = Math.max(0, level - 1)
      out.push('  '.repeat(level) + line)
      const opens = /^<([A-Z][\w.]*)(\s[^>]*)?>$/.exec(line)
      const startsTag = /^<[A-Z][\w.]*(\s[^>]*)?$/.test(line) && !line.includes('>')
      if (opens && !line.endsWith('/>') && !line.includes(`</${opens[1]}>`)) level++
      if (startsTag) inTag = true
    }
    if (inTag && !raw.trim().startsWith('<') && /\/?>\s*$/.test(raw)) {
      inTag = false
      if (!/\/>\s*$/.test(raw)) level++
    }
    const ticks = (raw.match(/`/g) ?? []).length
    if (ticks % 2 === 1) inTemplate = !inTemplate
  }
  return out.join('\n')
}
