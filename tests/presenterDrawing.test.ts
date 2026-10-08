import { describe, expect, test } from 'bun:test'
import { clientPointToSlide, hitTest, screenToSlide, smoothPath } from '../src/drawing/geometry'
import { addAnnotation, canRedo, canUndo, clearSlide, historyOf, parseHistories, redo, removeAnnotation, serializeHistories, undo } from '../src/drawing/history'
import type { Annotation } from '../src/drawing/types'
import { deckSyncKey, parseSyncMessage, throttle } from '../src/presenter/sync'

describe('clientPointToSlide (Part 5 §B.4)', () => {
  test('a 960×540 preview maps its centre to the slide centre', () => {
    expect(clientPointToSlide(480, 270, { left: 0, top: 0, width: 960, height: 540 })).toEqual({ x: 960, y: 540 })
  })
  test('a square container letterboxes the slide', () => {
    const p = clientPointToSlide(500, 500, { left: 0, top: 0, width: 1000, height: 1000 })!
    expect(p.x).toBeCloseTo(960)
    expect(p.y).toBeCloseTo(540)
  })
  test('a point in the letterbox band is null; screenToSlide keeps it', () => {
    const box = { left: 0, top: 0, width: 1000, height: 1000 }
    expect(clientPointToSlide(500, 100, box)).toBeNull()
    expect(screenToSlide(500, 100, box).y).toBeLessThan(0)
  })
})

const pen = (id: string, points = [{ x: 0, y: 0 }, { x: 100, y: 0 }]): Annotation => ({ id, type: 'path', color: '#fff', strokeWidth: 4, opacity: 1, points })

describe('annotation history', () => {
  test('add, undo, redo and clear per slide', () => {
    let h = addAnnotation({}, 2, pen('a'))
    h = addAnnotation(h, 2, pen('b'))
    expect(historyOf(h, 2).annotations.map((a) => a.id)).toEqual(['a', 'b'])
    expect(historyOf(h, 1).annotations).toEqual([])
    h = undo(h, 2)
    expect(historyOf(h, 2).annotations.map((a) => a.id)).toEqual(['a'])
    expect(canRedo(h, 2)).toBe(true)
    h = redo(h, 2)
    expect(historyOf(h, 2).annotations.map((a) => a.id)).toEqual(['a', 'b'])
    h = clearSlide(h, 2)
    expect(historyOf(h, 2).annotations).toEqual([])
    h = undo(h, 2)
    expect(historyOf(h, 2).annotations).toHaveLength(2) // clearing is undoable
  })

  test('the eraser removes one annotation, undoably; a new stroke clears redo', () => {
    let h = addAnnotation(addAnnotation({}, 0, pen('a')), 0, pen('b'))
    h = removeAnnotation(h, 0, 'a')
    expect(historyOf(h, 0).annotations.map((a) => a.id)).toEqual(['b'])
    expect(removeAnnotation(h, 0, 'missing')).toBe(h)
    h = undo(h, 0)
    expect(canRedo(h, 0)).toBe(true)
    h = addAnnotation(h, 0, pen('c'))
    expect(canRedo(h, 0)).toBe(false)
    expect(canUndo(h, 0)).toBe(true)
  })

  test('serialisation keeps only slides with content and survives garbage', () => {
    const h = { ...addAnnotation({}, 3, pen('a')), 5: { annotations: [], undoStack: [], redoStack: [] } }
    const round = parseHistories(serializeHistories(h))
    expect(Object.keys(round)).toEqual(['3'])
    expect(parseHistories('{not json')).toEqual({})
    expect(parseHistories('{"x": 1}')).toEqual({})
  })
})

describe('drawing geometry', () => {
  test('a smoothed path starts, curves through midpoints and ends on the last point', () => {
    expect(smoothPath([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 10 }])).toBe('M 0 0 Q 10 0 15 5 L 20 10')
  })

  test('hit testing per annotation type', () => {
    expect(hitTest(pen('a'), { x: 50, y: 6 }, 8)).toBe(true)
    expect(hitTest(pen('a'), { x: 50, y: 40 }, 8)).toBe(false)
    const rect: Annotation = { id: 'r', type: 'rectangle', color: '#fff', strokeWidth: 4, opacity: 1, start: { x: 0, y: 0 }, end: { x: 100, y: 100 } }
    expect(hitTest(rect, { x: 100, y: 50 }, 8)).toBe(true)
    expect(hitTest(rect, { x: 50, y: 50 }, 8)).toBe(false) // the inside is empty
    const text: Annotation = { id: 't', type: 'text', color: '#fff', strokeWidth: 4, opacity: 1, start: { x: 100, y: 100 }, text: 'Hello' }
    expect(hitTest(text, { x: 120, y: 90 }, 8)).toBe(true)
    expect(hitTest(text, { x: 120, y: 160 }, 8)).toBe(false)
  })
})

describe('sync messages', () => {
  test('only well-formed messages for this deck pass', () => {
    expect(parseSyncMessage({ deck: 'a:b', message: { type: 'nav', current: 2, step: 1 } }, 'a:b')).toEqual({ type: 'nav', current: 2, step: 1 })
    expect(parseSyncMessage({ deck: 'other', message: { type: 'nav', current: 2, step: 1 } }, 'a:b')).toBeNull()
    expect(parseSyncMessage({ deck: 'a:b', message: { type: 'pointer', slideIndex: 1, point: { x: 1 } } }, 'a:b')).toBeNull()
    expect(parseSyncMessage({ deck: 'a:b', message: { type: 'pointer', slideIndex: 1, point: null } }, 'a:b')).toEqual({ type: 'pointer', slideIndex: 1, point: null })
    expect(parseSyncMessage({ deck: 'a:b', message: { type: 'bogus' } }, 'a:b')).toBeNull()
  })

  test('decks with the same slug in different sources get different keys', () => {
    expect(deckSyncKey({ source: 'team', path: 'q3' })).not.toBe(deckSyncKey({ source: 'mine', path: 'q3' }))
  })

  test('throttle runs at once, then at most once per window with the latest arguments', async () => {
    const calls: number[] = []
    const t = throttle((n: number) => calls.push(n), 30)
    t(1)
    t(2)
    t(3)
    expect(calls).toEqual([1])
    await new Promise((r) => setTimeout(r, 50))
    expect(calls).toEqual([1, 3])
  })
})
