import { useEffect, useLayoutEffect, useRef, type ReactElement } from 'react'
import { motion } from 'motion/react'
import { SlideThumbnail } from '../editor/SlideThumbnail'
import type { SlideProps } from '../slides/Slide'

export interface OverviewProps {
  slides: ReactElement<SlideProps>[]
  current: number
  focused: number
  previewMode: boolean
  onFocus: (index: number) => void
  onSelect: (index: number) => void
  onClose: () => void
  onColumnsChange: (columns: number) => void
  /** Opens dev mode at the focused slide; omitted in exported files. */
  onEditSlide?: (index: number) => void
}

/** Count grid columns from the DOM: the first cell whose offsetTop differs starts row two. */
export function measureColumns(grid: HTMLElement): number {
  const cells = Array.from(grid.children) as HTMLElement[]
  if (cells.length === 0) return 1
  const top = cells[0].offsetTop
  const nextRow = cells.findIndex((cell) => cell.offsetTop !== top)
  return nextRow === -1 ? cells.length : nextRow
}

/** Full-screen slide overview with an optional large preview (Part 1 §3.13). */
export function Overview({ slides, current, focused, previewMode, onFocus, onSelect, onClose, onColumnsChange, onEditSlide }: OverviewProps) {
  const gridRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const grid = gridRef.current
    if (!grid) return
    const update = () => onColumnsChange(measureColumns(grid))
    const frame = requestAnimationFrame(update)
    window.addEventListener('resize', update)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', update)
    }
  }, [previewMode, slides.length, onColumnsChange])

  useEffect(() => {
    gridRef.current?.querySelector(`[data-index="${focused}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [focused])

  return (
    <motion.div
      className="overview"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      onClick={onClose}
      data-no-advance
    >
      <header className="overview__header" onClick={(e) => e.stopPropagation()}>
        <h2>Slide Overview</h2>
        <span className="overview__hints">Arrows to move · Enter to open · Tab for preview · Esc to close</span>
        {onEditSlide && (
          <button type="button" className="presentation-view-button" onClick={() => onEditSlide(focused)}>
            Edit Slide {focused + 1}
          </button>
        )}
      </header>
      <div className={`overview__body${previewMode ? ' is-preview' : ''}`}>
        <div className="overview__grid" ref={gridRef}>
          {slides.map((slide, i) => (
            <motion.button
              key={i}
              type="button"
              data-index={i}
              className={`overview__cell${i === focused ? ' is-focused' : ''}${i === current ? ' is-current' : ''}`}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.02 }}
              whileHover={{ scale: 1.03 }}
              onMouseEnter={() => onFocus(i)}
              onClick={(event) => {
                event.stopPropagation()
                onSelect(i)
              }}
            >
              <span className="overview__frame">
                <SlideThumbnail>{slide}</SlideThumbnail>
              </span>
              <span className="overview__caption">
                Slide {i + 1}
                {i === current && ' · current'}
              </span>
            </motion.button>
          ))}
        </div>
        {previewMode && slides[focused] && (
          <div className="overview__preview" onClick={(e) => e.stopPropagation()}>
            <div className="overview__preview-frame">
              <SlideThumbnail>{slides[focused]}</SlideThumbnail>
            </div>
            <span className="overview__caption">Slide {focused + 1}</span>
          </div>
        )}
      </div>
    </motion.div>
  )
}
