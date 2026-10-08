import { useEffect, useRef } from 'react'
import { AnimatePresence } from 'motion/react'
import { isTypingTarget } from '../utils/environment'
import { useDrawing } from './DrawingContext'
import { AnnotationLayer, DrawingCanvas } from './DrawingCanvas'
import { DrawingToolbar } from './DrawingToolbar'
import { DESIGN_HEIGHT, DESIGN_WIDTH, TOOLS, type Annotation } from './types'

export interface DrawingOverlayProps {
  slideIndex: number
  /** A stroke being drawn in the other window, shown while it forms. */
  liveAnnotation?: Annotation | null
  onPreviewChange?: (a: Annotation | null) => void
  showToolbar?: boolean
}

/**
 * Saved annotations over the slide, and in draw mode the canvas and toolbar (Part 5 §C.1).
 * Draw-mode keys: Cmd/Ctrl+Z undo, Cmd/Ctrl+Shift+Z or +Y redo, 1–7 tools, C clears the slide.
 */
export function DrawingOverlay({ slideIndex, liveAnnotation, onPreviewChange, showToolbar = true }: DrawingOverlayProps) {
  const d = useDrawing()
  const keyHandler = useRef<(e: KeyboardEvent) => void>(() => {})
  keyHandler.current = (e) => {
    if (!d?.isDrawMode || isTypingTarget(e.target)) return
    const mod = e.metaKey || e.ctrlKey
    const key = e.key.toLowerCase()
    if (mod && (key === 'y' || (key === 'z' && e.shiftKey))) d.redo(slideIndex)
    else if (mod && key === 'z') d.undo(slideIndex)
    else if (!mod && !e.altKey && /^[1-7]$/.test(e.key)) d.setTool(TOOLS[Number(e.key) - 1].tool)
    else if (!mod && !e.altKey && key === 'c') d.clear(slideIndex)
    else return
    e.preventDefault()
    e.stopPropagation()
  }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => keyHandler.current(e)
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [])

  if (!d) return null
  const saved = d.annotations(slideIndex)
  const shown = liveAnnotation ? [...saved, liveAnnotation] : saved
  if (!d.isDrawMode) {
    if (shown.length === 0) return null
    return (
      <div className="drawing-canvas" style={{ pointerEvents: 'none' }}>
        <svg viewBox={`0 0 ${DESIGN_WIDTH} ${DESIGN_HEIGHT}`} preserveAspectRatio="xMidYMid meet" width="100%" height="100%">
          <AnnotationLayer annotations={shown} />
        </svg>
      </div>
    )
  }
  return (
    <>
      <DrawingCanvas
        key={slideIndex /* an unfinished stroke is dropped on slide change */}
        annotations={shown}
        readOnly={false}
        tool={d.tool}
        color={d.color}
        strokeWidth={d.strokeWidth}
        onAdd={(a) => d.add(slideIndex, a)}
        onRemove={(id) => d.remove(slideIndex, id)}
        onPreviewChange={onPreviewChange}
      />
      <AnimatePresence>{showToolbar && <DrawingToolbar slideIndex={slideIndex} />}</AnimatePresence>
    </>
  )
}
