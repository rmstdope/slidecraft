/**
 * Attributes of one opening JSX tag, read and rewritten as text. Works on half-typed MDX, which
 * the editor needs: the slide being edited is often not valid while the author types.
 */
import { openingTagEnd } from './openingTag.ts'

export type TagAttrValue = string | true | { expression: string }

export interface ScannedAttr {
  name: string
  value: TagAttrValue
  /** Range of the whole attribute (name and value) within the tag text. */
  start: number
  end: number
}

export interface ScannedTag {
  name: string
  attrs: ScannedAttr[]
  /** Index just past the closing `>` of the opening tag. */
  end: number
  selfClosing: boolean
}

/** Scan the opening tag that starts at `from` (which points at `<`). Null when it is not a tag. */
export function scanTag(text: string, from = 0): ScannedTag | null {
  const head = /^<([A-Za-z][\w.]*)/.exec(text.slice(from))
  if (!head) return null
  const end = openingTagEnd(text, from)
  if (end < 0) return null
  const selfClosing = text[end - 2] === '/'
  const attrs: ScannedAttr[] = []
  let i = from + head[0].length
  const stop = selfClosing ? end - 2 : end - 1
  while (i < stop) {
    while (i < stop && /\s/.test(text[i])) i++
    const nameMatch = /^[A-Za-z_$][\w$:-]*/.exec(text.slice(i, stop))
    if (!nameMatch) {
      i++
      continue
    }
    const start = i
    const name = nameMatch[0]
    i += name.length
    let value: TagAttrValue = true
    let j = i
    while (j < stop && /\s/.test(text[j])) j++
    if (text[j] === '=') {
      j++
      while (j < stop && /\s/.test(text[j])) j++
      const quote = text[j]
      if (quote === '"' || quote === "'") {
        const close = text.indexOf(quote, j + 1)
        value = text.slice(j + 1, close < 0 ? stop : close)
        i = close < 0 ? stop : close + 1
      } else if (quote === '{') {
        let depth = 0
        let k = j
        for (; k < stop; k++) {
          if (text[k] === '{') depth++
          else if (text[k] === '}' && --depth === 0) break
        }
        value = { expression: text.slice(j + 1, k).trim() }
        i = k + 1
      } else i = j
    }
    attrs.push({ name, value, start, end: i })
  }
  return { name: head[1], attrs, end, selfClosing }
}

export const formatAttr = (name: string, value: TagAttrValue): string => {
  if (value === true) return name
  if (typeof value === 'object') return `${name}={${value.expression}}`
  return value.includes('"') ? `${name}='${value}'` : `${name}="${value}"`
}

/** Set, replace or (with null) remove an attribute on the opening tag at `from`. */
export function setTagAttr(text: string, name: string, value: TagAttrValue | null, from = 0): string {
  const tag = scanTag(text, from)
  if (!tag) return text
  const existing = tag.attrs.find((a) => a.name === name)
  if (existing) {
    if (value === null) {
      let s = existing.start
      while (s > from && /[ \t]/.test(text[s - 1])) s--
      return text.slice(0, s) + text.slice(existing.end)
    }
    return text.slice(0, existing.start) + formatAttr(name, value) + text.slice(existing.end)
  }
  if (value === null) return text
  const insertAt = tag.selfClosing ? tag.end - 2 : tag.end - 1
  const before = text.slice(0, insertAt).replace(/\s+$/, '')
  return `${before} ${formatAttr(name, value)}${tag.selfClosing ? ' ' : ''}${text.slice(insertAt)}`
}

export function tagAttrs(text: string, from = 0): Record<string, TagAttrValue> {
  return Object.fromEntries((scanTag(text, from)?.attrs ?? []).map((a) => [a.name, a.value]))
}
