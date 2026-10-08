import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { hitTest, screenToSlide, slideFit, smoothPath, textFontSize } from './geometry'
import { DESIGN_HEIGHT, DESIGN_WIDTH, type Annotation, type DrawingTool, type Point } from './types'

let counter = 0
const newId = () => `a${Date.now().toString(36)}${(++counter).toString(36)}`

export interface DrawingCanvasProps {
  annotations: Annotation[]
  readOnly: boolean
  tool: DrawingTool
  color: string
  strokeWidth: number
  onAdd(a: Annotation): void
  onRemove(id: string): void
  onPreviewChange?: (a: Annotation | null) => void
}

const CURSORS: Record<DrawingTool, string> = {
  pen: 'crosshair',
  highlighter: 'crosshair',
  arrow: 'crosshair',
  rectangle: 'crosshair',
  text: 'text',
  eraser: 'cell',
  laser: 'none',
}

function AnnotationShape({ a }: { a: Annotation }) {
  const common = { stroke: a.color, strokeWidth: a.strokeWidth, strokeOpacity: a.opacity, fill: 'none', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  switch (a.type) {
    case 'path':
      return <path d={smoothPath(a.points)} {...common} />
    case 'arrow':
      return (
        <>
          <defs>
            <marker id={`arrow-${a.id}`} markerWidth="9" markerHeight="6" refX="9" refY="3" orient="auto" markerUnits="strokeWidth">
              <path d="M0,0 L9,3 L0,6 Z" fill={a.color} fillOpacity={a.opacity} />
            </marker>
          </defs>
          <line x1={a.start.x} y1={a.start.y} x2={a.end.x} y2={a.end.y} {...common} markerEnd={`url(#arrow-${a.id})`} />
        </>
      )
    case 'rectangle':
      return (
        <rect
          x={Math.min(a.start.x, a.end.x)}
          y={Math.min(a.start.y, a.end.y)}
          width={Math.abs(a.end.x - a.start.x)}
          height={Math.abs(a.end.y - a.start.y)}
          rx={2}
          {...common}
        />
      )
    case 'text':
      return (
        <text x={a.start.x} y={a.start.y} fill={a.color} fillOpacity={a.opacity} fontSize={textFontSize(a.strokeWidth)} fontFamily="var(--font-body)" fontWeight={600} style={{ userSelect: 'none' }}>
          {a.text}
        </text>
      )
  }
}

export function AnnotationLayer({ annotations }: { annotations: Annotation[] }) {
  return (
    <>
      {annotations.map((a) => (
        <g key={a.id}>
          <AnnotationShape a={a} />
        </g>
      ))}
    </>
  )
}

/** An SVG over the slide in design coordinates: input and rendering for every tool (Part 5 §C.4). */
export function DrawingCanvas({ annotations, readOnly, tool, color, strokeWidth, onAdd, onRemove, onPreviewChange }: DrawingCanvasProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [draft, setDraft] = useState<Annotation | null>(null)
  const [laser, setLaser] = useState<Point | null>(null)
  const [textAt, setTextAt] = useState<Point | null>(null)
  const drawing = useRef(false)
  const lastMove = useRef(0)

  useEffect(() => onPreviewChange?.(draft), [draft, onPreviewChange])
  useEffect(() => () => onPreviewChange?.(null), [onPreviewChange])

  const toSlide = (e: { clientX: number; clientY: number }) => screenToSlide(e.clientX, e.clientY, rootRef.current!.getBoundingClientRect())

  const eraseAt = (p: Point) => {
    const hit = [...annotations].reverse().find((a) => hitTest(a, p, strokeWidth * 2))
    if (hit) onRemove(hit.id)
  }

  const onDown = (e: ReactPointerEvent) => {
    if (readOnly || e.button !== 0) return
    e.preventDefault()
    const p = toSlide(e)
    if (tool === 'text') {
      setTextAt(p)
      return
    }
    try {
      ;(e.target as Element).setPointerCapture?.(e.pointerId) // keep the stroke when the pointer leaves the slide
    } catch {
      /* not an active pointer (synthetic events) */
    }
    drawing.current = true
    if (tool === 'eraser') return eraseAt(p)
    if (tool === 'laser') return setLaser(p)
    const base = { id: 'preview', color, strokeWidth, opacity: 1 }
    if (tool === 'pen') setDraft({ ...base, type: 'path', points: [p] })
    else if (tool === 'highlighter') setDraft({ ...base, type: 'path', points: [p], strokeWidth: strokeWidth * 3, opacity: 0.4 })
    else setDraft({ ...base, type: tool === 'arrow' ? 'arrow' : 'rectangle', start: p, end: p })
  }

  const onMove = (e: ReactPointerEvent) => {
    if (readOnly) return
    const now = performance.now()
    if (now - lastMove.current < 16) return
    lastMove.current = now
    const p = toSlide(e)
    if (tool === 'laser') return setLaser(drawing.current || e.pointerType === 'mouse' ? p : null)
    if (!drawing.current) return
    if (tool === 'eraser') return eraseAt(p)
    setDraft((d) => {
      if (!d) return d
      if (d.type === 'path') return { ...d, points: [...d.points, p] }
      if (d.type === 'arrow' || d.type === 'rectangle') return { ...d, end: p }
      return d
    })
  }

  const finish = () => {
    if (!drawing.current) return
    drawing.current = false
    if (tool === 'laser') return
    setDraft((d) => {
      if (d) {
        const long = d.type === 'path' ? d.points.length >= 2 : d.type === 'text' ? true : Math.hypot(d.end.x - d.start.x, d.end.y - d.start.y) > 10
        if (long) onAdd({ ...d, id: newId() })
      }
      return null
    })
  }

  const commitText = (value: string) => {
    const text = value.trim()
    if (text && textAt) onAdd({ id: newId(), type: 'text', color, strokeWidth, opacity: 1, start: textAt, text })
    setTextAt(null)
  }

  // The text box is HTML over the SVG, so it needs the slide's scale and letterbox offset.
  const box = rootRef.current?.getBoundingClientRect()
  const fit = box ? slideFit(box) : { scale: 1, offsetX: 0, offsetY: 0 }
  const shown = draft ? [...annotations, draft] : annotations

  return (
    <div
      ref={rootRef}
      className="drawing-canvas"
      data-no-advance={readOnly ? undefined : true}
      style={{ pointerEvents: readOnly ? 'none' : 'all', cursor: readOnly ? 'default' : CURSORS[tool] }}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={finish}
      onPointerCancel={finish}
      onPointerLeave={() => {
        finish()
        setLaser(null)
      }}
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => !readOnly && e.stopPropagation()}
    >
      <svg viewBox={`0 0 ${DESIGN_WIDTH} ${DESIGN_HEIGHT}`} preserveAspectRatio="xMidYMid meet" width="100%" height="100%">
        <defs>
          <filter id="laser-glow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <AnnotationLayer annotations={shown} />
        {laser && !readOnly && <circle cx={laser.x} cy={laser.y} r={15} fill="#ff2d2d" filter="url(#laser-glow)" />}
      </svg>
      {textAt && (
        <input
          className="drawing-text-input"
          autoFocus
          style={{
            left: fit.offsetX + textAt.x * fit.scale,
            top: fit.offsetY + textAt.y * fit.scale,
            color,
            borderColor: color,
            fontSize: Math.max(10, textFontSize(strokeWidth) * fit.scale),
          }}
          onKeyDown={(e) => {
            e.stopPropagation()
            if (e.key === 'Enter') commitText(e.currentTarget.value)
            if (e.key === 'Escape') setTextAt(null)
          }}
          onBlur={(e) => commitText(e.currentTarget.value)}
          onPointerDown={(e) => e.stopPropagation()}
        />
      )}
    </div>
  )
}
