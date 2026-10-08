import { motion } from 'motion/react'
import { DRAWING_COLORS, STROKE_WIDTHS, useDrawing } from './DrawingContext'
import { TOOLS, type DrawingTool } from './types'

const ICONS: Record<DrawingTool | 'undo' | 'redo' | 'clear' | 'close', string> = {
  pen: 'M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z',
  highlighter: 'm9 11-6 6v3h9l3-3M22 12l-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4',
  arrow: 'M5 19 19 5M9 5h10v10',
  rectangle: 'M4 6h16v12H4Z',
  text: 'M5 6V4h14v2M12 4v16M9 20h6',
  eraser: 'm7 21-4.3-4.3a1 1 0 0 1 0-1.4l10-10a1 1 0 0 1 1.4 0l5.6 5.6a1 1 0 0 1 0 1.4L13 19M22 21H7M5 11l9 9',
  laser: 'M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0M12 2v3M12 19v3M2 12h3M19 12h3',
  undo: 'M9 14 4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11',
  redo: 'm15 14 5-5-5-5M20 9H9.5a5.5 5.5 0 0 0 0 11H13',
  clear: 'M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6',
  close: 'M18 6 6 18M6 6l12 12',
}

const Icon = ({ name }: { name: keyof typeof ICONS }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d={ICONS[name]} />
  </svg>
)

const tap = { whileHover: { scale: 1.08 }, whileTap: { scale: 0.94 } }

/** Floating draw-mode toolbar (Part 5 §C.5). */
export function DrawingToolbar({ slideIndex }: { slideIndex: number }) {
  const d = useDrawing()
  if (!d) return null
  return (
    <motion.div className="drawing-toolbar" data-no-advance initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} transition={{ duration: 0.2 }} onClick={(e) => e.stopPropagation()}>
      <div className="drawing-toolbar__group">
        {TOOLS.map((t, i) => (
          <motion.button key={t.tool} type="button" {...tap} className={d.tool === t.tool ? 'is-active' : ''} title={`${t.label} (${i + 1})`} aria-label={t.label} onClick={() => d.setTool(t.tool)}>
            <Icon name={t.tool} />
          </motion.button>
        ))}
      </div>
      <div className="drawing-toolbar__group">
        {DRAWING_COLORS.map((c) => (
          <motion.button
            key={c.value}
            type="button"
            {...tap}
            className={`drawing-toolbar__swatch${d.color === c.value ? ' is-active' : ''}`}
            style={{ background: c.value }}
            title={c.name}
            aria-label={c.name}
            onClick={() => d.setColor(c.value)}
          />
        ))}
      </div>
      <div className="drawing-toolbar__group">
        {STROKE_WIDTHS.map((w) => (
          <motion.button key={w.value} type="button" {...tap} className={d.strokeWidth === w.value ? 'is-active' : ''} title={w.name} aria-label={`${w.name} stroke`} onClick={() => d.setStrokeWidth(w.value)}>
            <span className="drawing-toolbar__width" style={{ height: w.value, background: d.strokeWidth === w.value ? d.color : undefined }} />
          </motion.button>
        ))}
      </div>
      <div className="drawing-toolbar__group">
        <motion.button type="button" {...tap} disabled={!d.canUndo(slideIndex)} title="Undo (Ctrl+Z)" aria-label="Undo" onClick={() => d.undo(slideIndex)}>
          <Icon name="undo" />
        </motion.button>
        <motion.button type="button" {...tap} disabled={!d.canRedo(slideIndex)} title="Redo (Ctrl+Shift+Z)" aria-label="Redo" onClick={() => d.redo(slideIndex)}>
          <Icon name="redo" />
        </motion.button>
        <motion.button type="button" {...tap} className="is-danger" title="Clear slide (C)" aria-label="Clear slide" onClick={() => d.clear(slideIndex)}>
          <Icon name="clear" />
        </motion.button>
      </div>
      <motion.button type="button" {...tap} title="Close draw mode (Esc)" aria-label="Close draw mode" onClick={() => d.setDrawMode(false)}>
        <Icon name="close" />
      </motion.button>
    </motion.div>
  )
}
