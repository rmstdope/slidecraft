import type { Position, Range } from './types'

export function lineStarts(text: string): number[] {
  const starts = [0]
  for (let i = 0; i < text.length; i++) if (text[i] === '\n') starts.push(i + 1)
  return starts
}

export function offsetAt(text: string, pos: Position, starts = lineStarts(text)): number {
  const line = Math.max(0, Math.min(pos.line, starts.length - 1))
  return Math.min(text.length, starts[line] + pos.character)
}

export function positionAt(offset: number, starts: number[]): Position {
  let lo = 0
  let hi = starts.length - 1
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (starts[mid] <= offset) lo = mid
    else hi = mid - 1
  }
  return { line: lo, character: offset - starts[lo] }
}

export const rangeOf = (start: number, end: number, starts: number[]): Range => ({ start: positionAt(start, starts), end: positionAt(end, starts) })

/**
 * Blank out JSX comments, template literals and quoted attribute strings (keeping offsets), so
 * that `<div>` inside code samples or strings is not mistaken for markup.
 */
export function maskNonMarkup(text: string): string {
  const out = text.split('')
  const blank = (from: number, to: number) => {
    for (let i = from; i < to; i++) if (out[i] !== '\n') out[i] = ' '
  }
  let i = 0
  while (i < text.length) {
    if (text.startsWith('{/*', i)) {
      const end = text.indexOf('*/}', i + 3)
      const stop = end < 0 ? text.length : end + 3
      blank(i, stop)
      i = stop
    } else if (text[i] === '`') {
      const end = text.indexOf('`', i + 1)
      const stop = end < 0 ? text.length : end + 1
      blank(i + 1, stop - 1)
      i = stop
    } else i++
  }
  return out.join('')
}

/** Edit distance, for "did you mean" suggestions. */
export function levenshtein(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0]
    row[0] = i
    for (let j = 1; j <= b.length; j++) {
      const tmp = row[j]
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1].toLowerCase() === b[j - 1].toLowerCase() ? 0 : 1))
      prev = tmp
    }
  }
  return row[b.length]
}

export function closest(name: string, candidates: string[], maxDistance = 3): string | undefined {
  let best: { name: string; d: number } | undefined
  for (const c of candidates) {
    const d = levenshtein(name, c)
    if (d <= maxDistance && (!best || d < best.d)) best = { name: c, d }
  }
  return best?.name
}
