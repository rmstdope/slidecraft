import type { Annotation } from './types'

/** Per-slide annotations with snapshot undo/redo (Part 5 §C.2). */
export interface SlideHistory {
  annotations: Annotation[]
  undoStack: Annotation[][]
  redoStack: Annotation[][]
}

export type Histories = Record<number, SlideHistory>

const MAX_UNDO = 100
const EMPTY: SlideHistory = { annotations: [], undoStack: [], redoStack: [] }

export const historyOf = (h: Histories, slide: number): SlideHistory => h[slide] ?? EMPTY

function commit(h: Histories, slide: number, next: Annotation[]): Histories {
  const cur = historyOf(h, slide)
  return { ...h, [slide]: { annotations: next, undoStack: [...cur.undoStack, cur.annotations].slice(-MAX_UNDO), redoStack: [] } }
}

export const addAnnotation = (h: Histories, slide: number, a: Annotation): Histories => commit(h, slide, [...historyOf(h, slide).annotations, a])

export function removeAnnotation(h: Histories, slide: number, id: string): Histories {
  const cur = historyOf(h, slide).annotations
  return cur.some((a) => a.id === id) ? commit(h, slide, cur.filter((a) => a.id !== id)) : h
}

export const clearSlide = (h: Histories, slide: number): Histories => (historyOf(h, slide).annotations.length ? commit(h, slide, []) : h)

export function undo(h: Histories, slide: number): Histories {
  const cur = historyOf(h, slide)
  if (!cur.undoStack.length) return h
  return { ...h, [slide]: { annotations: cur.undoStack[cur.undoStack.length - 1], undoStack: cur.undoStack.slice(0, -1), redoStack: [...cur.redoStack, cur.annotations] } }
}

export function redo(h: Histories, slide: number): Histories {
  const cur = historyOf(h, slide)
  if (!cur.redoStack.length) return h
  return { ...h, [slide]: { annotations: cur.redoStack[cur.redoStack.length - 1], undoStack: [...cur.undoStack, cur.annotations], redoStack: cur.redoStack.slice(0, -1) } }
}

export const canUndo = (h: Histories, slide: number) => historyOf(h, slide).undoStack.length > 0
export const canRedo = (h: Histories, slide: number) => historyOf(h, slide).redoStack.length > 0

/** Only slides with something to keep (annotations or history) are stored. */
export function serializeHistories(h: Histories): string {
  const kept: Histories = {}
  for (const [k, v] of Object.entries(h)) if (v.annotations.length || v.undoStack.length || v.redoStack.length) kept[Number(k)] = v
  return JSON.stringify(kept)
}

export function parseHistories(raw: string | null): Histories {
  if (!raw) return {}
  try {
    const data = JSON.parse(raw) as unknown
    if (!data || typeof data !== 'object') return {}
    const out: Histories = {}
    for (const [k, v] of Object.entries(data as Record<string, SlideHistory>)) {
      if (Number.isInteger(Number(k)) && Array.isArray(v?.annotations)) out[Number(k)] = { annotations: v.annotations, undoStack: v.undoStack ?? [], redoStack: v.redoStack ?? [] }
    }
    return out
  } catch {
    return {}
  }
}
