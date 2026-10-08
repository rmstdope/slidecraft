/**
 * Where the cursor is (Part 3 §2.9, extended to multi-line tags): inside an opening tag, inside a
 * prop value, typing a component name or a closing tag, or in a slide's body.
 */
import { scanTag } from '@shared/tagAttrs.ts'

export type CursorTarget =
  | { kind: 'component-name'; partial: string; start: number }
  | { kind: 'prop-name'; component: string; partial: string; present: string[]; tagStart: number }
  | { kind: 'prop-value'; component: string; prop: string; partial: string; quoted: boolean; start: number }
  | { kind: 'closing-tag'; partial: string; open?: string; start: number }
  | { kind: 'none' }


/** The opening tag (start offset) that the offset lies inside, if any. */
export function enclosingOpenTag(text: string, offset: number): { start: number; name: string } | null {
  const before = text.slice(0, offset)
  const lt = before.lastIndexOf('<')
  if (lt < 0) return null
  const match = /^<([A-Z][\w.]*)/.exec(text.slice(lt))
  if (!match) return null
  const tag = scanTag(text, lt)
  // Still inside when the tag is unterminated, or ends after the cursor.
  if (tag && tag.end <= offset) return null
  return { start: lt, name: match[1] }
}

/** Components opened before the offset and not yet closed (innermost last). */
export function openStack(text: string, offset: number): string[] {
  const stack: string[] = []
  const re = /<(\/?)([A-Z][\w.]*)/g
  let m: RegExpExecArray | null
  const before = text.slice(0, offset)
  while ((m = re.exec(before))) {
    if (m[1]) {
      const at = stack.lastIndexOf(m[2])
      if (at >= 0) stack.splice(at, 1)
      continue
    }
    const tag = scanTag(before, m.index)
    if (tag?.selfClosing) continue
    stack.push(m[2])
  }
  return stack
}

export function cursorTarget(text: string, offset: number): CursorTarget {
  const before = text.slice(0, offset)
  const closing = /<\/([A-Za-z]*)$/.exec(before)
  if (closing) {
    const stack = openStack(text, offset - closing[0].length)
    return { kind: 'closing-tag', partial: closing[1], open: stack[stack.length - 1], start: offset - closing[1].length }
  }
  const name = /<([A-Z][\w]*)?$/.exec(before)
  if (name) return { kind: 'component-name', partial: name[1] ?? '', start: offset - (name[1]?.length ?? 0) }

  const tag = enclosingOpenTag(text, offset)
  if (!tag) return { kind: 'none' }
  const inside = text.slice(tag.start, offset)
  const quotedValue = /(\w+)=(["'])([^"']*)$/.exec(inside)
  if (quotedValue) return { kind: 'prop-value', component: tag.name, prop: quotedValue[1], partial: quotedValue[3], quoted: true, start: offset - quotedValue[3].length }
  const exprValue = /(\w+)=\{([^{}]*)$/.exec(inside)
  if (exprValue) return { kind: 'prop-value', component: tag.name, prop: exprValue[1], partial: exprValue[2].trim(), quoted: false, start: offset - exprValue[2].length }
  // Inside an unfinished nested expression (e.g. camera={{ x: … ): nothing to offer.
  const opens = (inside.match(/\{/g) ?? []).length
  const closes = (inside.match(/\}/g) ?? []).length
  if (opens > closes) return { kind: 'none' }
  const present = (scanTag(`${inside}>`, 0)?.attrs ?? []).map((a) => a.name)
  const partial = /(\w*)$/.exec(inside)?.[1] ?? ''
  if (!/\s\w*$/.test(inside)) return { kind: 'none' } // still on the tag name
  return { kind: 'prop-name', component: tag.name, partial, present: present.filter((p) => p !== partial), tagStart: tag.start }
}
