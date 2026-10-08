import { useEffect, useRef } from 'react'
import { isSlideTextHidden, type ModelSlide } from '@shared/deckModel.ts'
import { useInView } from '../../hooks/useInView'
import type { CompileTarget } from '../compileSlide'
import { SlideStill } from './SlideStill'

export interface SlideSidebarProps {
  slides: ModelSlide[]
  selectedId: string | null
  readOnly: boolean
  target: CompileTarget
  theme?: string
  onSelect(id: string): void
  onDelete(id: string): void
  onMove(from: number, to: number): void
  onToggleHidden(id: string): void
  onAddSlide(): void
}

function SlideThumb({ slide, index, selected, total, readOnly, target, theme, onSelect, onDelete, onMove, onToggleHidden, register }: {
  slide: ModelSlide
  index: number
  selected: boolean
  total: number
  readOnly: boolean
  target: CompileTarget
  theme?: string
  register: (el: HTMLDivElement | null) => void
} & Pick<SlideSidebarProps, 'onSelect' | 'onDelete' | 'onMove' | 'onToggleHidden'>) {
  const [viewRef, inView] = useInView<HTMLDivElement>()
  const hidden = isSlideTextHidden(slide.text)
  const stop = (fn: () => void) => (e: React.MouseEvent) => {
    e.stopPropagation()
    fn()
  }
  return (
    <div
      ref={(el) => {
        viewRef.current = el
        register(el)
      }}
      className={`rail-thumb${selected ? ' is-selected' : ''}${hidden ? ' is-hidden' : ''}`}
      role="button"
      tabIndex={-1}
      aria-label={`Slide ${index + 1}`}
      aria-current={selected || undefined}
      onClick={() => onSelect(slide.id)}
    >
      <div className="rail-thumb__frame">
        <SlideStill source={inView ? slide.text : null} target={target} theme={theme} />
      </div>
      <div className="rail-thumb__footer">
        <span>
          {index + 1}
          {hidden && <span className="rail-thumb__badge">Hidden</span>}
        </span>
        {selected && !readOnly && (
          <span className="rail-thumb__actions">
            <button type="button" title={hidden ? 'Show slide when presenting' : 'Hide slide when presenting'} className={hidden ? 'is-active' : ''} onClick={stop(() => onToggleHidden(slide.id))}>
              {hidden ? '◌' : '◉'}
            </button>
            {index > 0 && (
              <button type="button" title="Move up (Alt+↑)" onClick={stop(() => onMove(index, index - 1))}>
                ↑
              </button>
            )}
            {index < total - 1 && (
              <button type="button" title="Move down (Alt+↓)" onClick={stop(() => onMove(index, index + 1))}>
                ↓
              </button>
            )}
            {total > 1 && (
              <button type="button" title="Delete slide" className="is-danger" onClick={stop(() => onDelete(slide.id))}>
                ✕
              </button>
            )}
          </span>
        )}
      </div>
    </div>
  )
}

/** The slide rail (Part 3 §2.7). */
export function SlideSidebar(props: SlideSidebarProps) {
  const { slides, selectedId, readOnly, onAddSlide } = props
  const refs = useRef(new Map<string, HTMLDivElement>())
  const hiddenCount = slides.filter((s) => isSlideTextHidden(s.text)).length

  useEffect(() => {
    if (selectedId) refs.current.get(selectedId)?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [selectedId])

  return (
    <aside className="rail">
      <header className="rail__header">
        <span>Slides</span>
        <span title={hiddenCount ? `${hiddenCount} hidden when presenting` : undefined}>{hiddenCount ? `${slides.length - hiddenCount} / ${slides.length}` : slides.length}</span>
      </header>
      <div className="rail__list">
        {slides.map((slide, index) => (
          <SlideThumb
            key={slide.id}
            slide={slide}
            index={index}
            total={slides.length}
            selected={slide.id === selectedId}
            readOnly={readOnly}
            target={props.target}
            theme={props.theme}
            onSelect={props.onSelect}
            onDelete={props.onDelete}
            onMove={props.onMove}
            onToggleHidden={props.onToggleHidden}
            register={(el) => (el ? refs.current.set(slide.id, el) : refs.current.delete(slide.id))}
          />
        ))}
        {!readOnly && (
          <button type="button" className="rail__add" onClick={onAddSlide}>
            + Add slide
          </button>
        )}
      </div>
    </aside>
  )
}
