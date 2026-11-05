import { describe, expect, test } from 'bun:test'
import { diffLines, MAX_DIFF_CELLS, toHunks } from '../shared/lineDiff.ts'

const render = (lines: ReturnType<typeof diffLines>) => lines!.map((l) => `${l.kind === 'add' ? '+' : l.kind === 'remove' ? '-' : ' '}${l.text}`).join('\n')

describe('diffLines', () => {
  test('marks a changed line as removed and added, keeping the rest', () => {
    expect(render(diffLines('a\nb\nc\n', 'a\nB\nc\n'))).toBe(' a\n-b\n+B\n c')
  })
  test('insertions, deletions, and empty sides', () => {
    expect(render(diffLines('a\nc', 'a\nb\nc'))).toBe(' a\n+b\n c')
    expect(render(diffLines('a\nb\nc', 'a\nc'))).toBe(' a\n-b\n c')
    expect(render(diffLines('', 'x\ny'))).toBe('+x\n+y')
    expect(render(diffLines('x\n', ''))).toBe('-x')
    expect(diffLines('same\n', 'same\n')!.every((l) => l.kind === 'same')).toBe(true)
  })
  test('line numbers follow both sides', () => {
    const lines = diffLines('a\nb\nc', 'a\nc\nd')!
    expect(lines.map((l) => [l.kind, l.oldLine, l.newLine])).toEqual([
      ['same', 1, 1],
      ['remove', 2, undefined],
      ['same', 3, 2],
      ['add', undefined, 3],
    ])
  })
  test('refuses inputs too large to diff', () => {
    const big = (tag: string) => Array.from({ length: Math.ceil(Math.sqrt(MAX_DIFF_CELLS)) + 10 }, (_, i) => `${tag}${i}`).join('\n')
    expect(diffLines(big('a'), big('b'))).toBeNull()
  })
})

describe('toHunks', () => {
  test('groups changes with context and splits distant ones', () => {
    const old = Array.from({ length: 20 }, (_, i) => `line ${i + 1}`).join('\n')
    const next = old.replace('line 2\n', 'line two\n').replace('line 18\n', 'line eighteen\n')
    const hunks = toHunks(diffLines(old, next)!, 2)
    expect(hunks).toHaveLength(2)
    expect(hunks[0]).toMatchObject({ oldStart: 1, newStart: 1 })
    expect(hunks[0].lines.map((l) => l.text)).toEqual(['line 1', 'line 2', 'line two', 'line 3', 'line 4'])
    expect(hunks[1].oldStart).toBe(16)
    expect(toHunks(diffLines('a', 'a')!)).toEqual([])
  })
})
