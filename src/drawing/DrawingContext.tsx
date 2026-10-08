import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { storageKeys } from '../presenter/sync'
import * as H from './history'
import type { Annotation, DrawingTool } from './types'

export const DRAWING_COLORS = [
  { name: 'Yellow', value: '#f5b400' },
  { name: 'Red', value: '#e0452b' },
  { name: 'Teal', value: '#1f9e89' },
  { name: 'White', value: '#ffffff' },
  { name: 'Black', value: '#111111' },
]
export const STROKE_WIDTHS = [
  { name: 'Thin', value: 2 },
  { name: 'Medium', value: 4 },
  { name: 'Thick', value: 8 },
]

export interface DrawingState {
  isDrawMode: boolean
  tool: DrawingTool
  color: string
  strokeWidth: number
  setDrawMode(on: boolean): void
  toggleDrawMode(): void
  setTool(tool: DrawingTool): void
  setColor(color: string): void
  setStrokeWidth(width: number): void
  annotations(slide: number): Annotation[]
  add(slide: number, a: Annotation): void
  remove(slide: number, id: string): void
  undo(slide: number): void
  redo(slide: number): void
  clear(slide: number): void
  canUndo(slide: number): boolean
  canRedo(slide: number): boolean
}

const DrawingContext = createContext<DrawingState | null>(null)

export const useDrawing = (): DrawingState | null => useContext(DrawingContext)

/**
 * Annotation state for one window (Part 5 §C.2–C.3). Annotations persist per deck in localStorage;
 * the `storage` event brings the other window's committed strokes, undo and clears.
 */
export function DrawingProvider({ deckKey, children }: { deckKey: string; children?: ReactNode }) {
  const key = storageKeys(deckKey).annotations
  const [histories, setHistories] = useState<H.Histories>(() => (typeof localStorage === 'undefined' ? {} : H.parseHistories(localStorage.getItem(key))))
  const [isDrawMode, setDrawMode] = useState(false)
  const [tool, setToolState] = useState<DrawingTool>('pen')
  const [color, setColor] = useState(DRAWING_COLORS[0].value)
  const [strokeWidth, setStrokeWidthState] = useState(4)
  const skipSave = useRef(true)

  useEffect(() => {
    if (skipSave.current) {
      skipSave.current = false
      return
    }
    try {
      localStorage.setItem(key, H.serializeHistories(histories))
    } catch {
      /* storage full or unavailable: annotations stay in memory */
    }
  }, [histories, key])

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== key) return
      skipSave.current = true // already stored by the other window
      setHistories(H.parseHistories(event.newValue))
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [key])

  const update = useCallback((fn: (h: H.Histories) => H.Histories) => setHistories(fn), [])

  const value = useMemo<DrawingState>(
    () => ({
      isDrawMode,
      tool,
      color,
      strokeWidth,
      setDrawMode,
      toggleDrawMode: () => setDrawMode((d) => !d),
      setTool: setToolState,
      setColor,
      setStrokeWidth: (w) => setStrokeWidthState(Math.max(1, Math.min(50, w))),
      annotations: (slide) => H.historyOf(histories, slide).annotations,
      add: (slide, a) => update((h) => H.addAnnotation(h, slide, a)),
      remove: (slide, id) => update((h) => H.removeAnnotation(h, slide, id)),
      undo: (slide) => update((h) => H.undo(h, slide)),
      redo: (slide) => update((h) => H.redo(h, slide)),
      clear: (slide) => update((h) => H.clearSlide(h, slide)),
      canUndo: (slide) => H.canUndo(histories, slide),
      canRedo: (slide) => H.canRedo(histories, slide),
    }),
    [isDrawMode, tool, color, strokeWidth, histories, update],
  )
  return <DrawingContext.Provider value={value}>{children}</DrawingContext.Provider>
}
