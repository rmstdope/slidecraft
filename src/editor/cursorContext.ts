/** What the cursor is on (Part 3 §2.9), for the contextual toolbar. Multi-line tags included. */
import { scanTag } from '@shared/tagAttrs.ts'
import { openStack } from '../language-service/context'

export type CursorContext =
  | { type: 'slide'; props: Record<string, string>; tagStart: number }
  | { type: 'component'; name: string; props: Record<string, string>; tagStart: number }
  | { type: 'insert'; parentComponent?: string }
  | { type: 'none' }

const asStrings = (attrs: { name: string; value: unknown }[]) =>
  Object.fromEntries(attrs.map((a) => [a.name, a.value === true ? '' : typeof a.value === 'string' ? a.value : `{${(a.value as { expression: string }).expression}}`]))

export function getCursorContext(text: string, offset: number): CursorContext {
  // On an opening tag: the last `<Name` at or before the cursor whose tag reaches past it.
  const re = /<([A-Z][\w.]*)/g
  let m: RegExpExecArray | null
  let hit: { name: string; start: number; attrs: { name: string; value: unknown }[] } | undefined
  while ((m = re.exec(text)) && m.index <= offset) {
    const tag = scanTag(text, m.index)
    if (tag && offset <= tag.end) hit = { name: m[1], start: m.index, attrs: tag.attrs }
  }
  if (hit) return hit.name === 'Slide' ? { type: 'slide', props: asStrings(hit.attrs), tagStart: hit.start } : { type: 'component', name: hit.name, props: asStrings(hit.attrs), tagStart: hit.start }
  const stack = openStack(text, offset)
  if (stack.includes('Slide')) return { type: 'insert', parentComponent: stack[stack.length - 1] === 'Slide' ? undefined : stack[stack.length - 1] }
  return { type: 'none' }
}
