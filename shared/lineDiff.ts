/**
 * A line diff for showing what an agent turn changed (UX overhaul U5): the longest common
 * subsequence of lines, grouped into hunks with a few lines of context. Pure and small; deck
 * files are short enough that the quadratic table is fine, and larger inputs are refused.
 */

export type DiffLine = { kind: 'same' | 'add' | 'remove'; text: string; oldLine?: number; newLine?: number }

export interface DiffHunk {
  /** 1-based first line in the old and the new text. */
  oldStart: number
  newStart: number
  lines: DiffLine[]
}

/** Above this many cells (old lines × new lines) the diff is not computed. */
export const MAX_DIFF_CELLS = 4_000_000

const splitLines = (text: string): string[] => {
  if (text === '') return []
  const lines = text.split('\n')
  if (lines[lines.length - 1] === '') lines.pop()
  return lines
}

/** Every line of both texts in order, marked same, add or remove; null when too large. */
export function diffLines(oldText: string, newText: string): DiffLine[] | null {
  const a = splitLines(oldText)
  const b = splitLines(newText)
  // Common head and tail are cheap to take off first.
  let head = 0
  while (head < a.length && head < b.length && a[head] === b[head]) head++
  let tail = 0
  while (tail < a.length - head && tail < b.length - head && a[a.length - 1 - tail] === b[b.length - 1 - tail]) tail++
  const ma = a.slice(head, a.length - tail)
  const mb = b.slice(head, b.length - tail)
  if (ma.length * mb.length > MAX_DIFF_CELLS) return null

  // lcs[i][j] = length of the common subsequence of ma[i..] and mb[j..]
  const lcs = Array.from({ length: ma.length + 1 }, () => new Uint32Array(mb.length + 1))
  for (let i = ma.length - 1; i >= 0; i--) for (let j = mb.length - 1; j >= 0; j--) lcs[i][j] = ma[i] === mb[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1])

  const out: DiffLine[] = []
  let oldLine = 1
  let newLine = 1
  const same = (text: string) => out.push({ kind: 'same', text, oldLine: oldLine++, newLine: newLine++ })
  for (let k = 0; k < head; k++) same(a[k])
  let i = 0
  let j = 0
  while (i < ma.length || j < mb.length) {
    if (i < ma.length && j < mb.length && ma[i] === mb[j]) {
      same(ma[i])
      i++
      j++
    } else if (i < ma.length && (j === mb.length || lcs[i + 1][j] >= lcs[i][j + 1])) {
      // Removals before additions, as diffs are usually read.
      out.push({ kind: 'remove', text: ma[i++], oldLine: oldLine++ })
    } else {
      out.push({ kind: 'add', text: mb[j++], newLine: newLine++ })
    }
  }
  for (let k = a.length - tail; k < a.length; k++) same(a[k])
  return out
}

/** The changed regions of a diff, each with up to `context` unchanged lines around it. */
export function toHunks(lines: DiffLine[], context = 3): DiffHunk[] {
  const changed = lines.map((l, i) => (l.kind === 'same' ? -1 : i)).filter((i) => i >= 0)
  if (changed.length === 0) return []
  const hunks: DiffHunk[] = []
  let start = Math.max(0, changed[0] - context)
  let end = Math.min(lines.length - 1, changed[0] + context)
  const flush = () => {
    const slice = lines.slice(start, end + 1)
    const firstOld = slice.find((l) => l.oldLine !== undefined)?.oldLine ?? 1
    const firstNew = slice.find((l) => l.newLine !== undefined)?.newLine ?? 1
    hunks.push({ oldStart: firstOld, newStart: firstNew, lines: slice })
  }
  for (const index of changed.slice(1)) {
    if (index - context <= end + 1) end = Math.min(lines.length - 1, index + context)
    else {
      flush()
      start = Math.max(0, index - context)
      end = Math.min(lines.length - 1, index + context)
    }
  }
  flush()
  return hunks
}
