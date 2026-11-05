import { useEffect, useRef, type MouseEvent, type ReactNode } from 'react'
import { ArrowDown, ArrowUp, Eye, EyeOff, Plus, Trash2 } from 'lucide-react'
import { isSlideTextHidden, type ModelSlide } from '@shared/deckModel.ts'
import { useInView } from '../../hooks/useInView'
import { cn } from '../../ui'
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

function ThumbAction({ title, onClick, danger, active, children }: { title: string; onClick(e: MouseEvent): void; danger?: boolean; active?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      className={cn(
        'tw:grid tw:size-6 tw:place-items-center tw:rounded-md tw:text-muted tw:hover:bg-field tw:hover:text-fg tw:[&_svg]:size-3.5',
        danger && 'tw:hover:text-removed',
        active && 'tw:text-fg',
      )}
    >
      {children}
    </button>
  )
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
  const stop = (fn: () => void) => (e: MouseEvent) => {
    e.stopPropagation()
    fn()
  }
  return (
    <div
      ref={(el) => {
        viewRef.current = el
        register(el)
      }}
      className="tw:flex tw:cursor-pointer tw:flex-col tw:gap-1"
      role="button"
      tabIndex={-1}
      aria-label={`Slide ${index + 1}`}
      aria-current={selected || undefined}
      onClick={() => onSelect(slide.id)}
    >
      <div
        className={cn(
          'tw:relative tw:aspect-video tw:overflow-hidden tw:rounded-md tw:bg-black tw:transition-shadow tw:duration-150',
          selected ? 'tw:shadow-[0_0_0_2px_var(--sc-focus)]' : 'tw:shadow-hairline tw:hover:shadow-[0_0_0_1px_var(--sc-muted)]',
          hidden && 'tw:opacity-45',
        )}
      >
        <SlideStill source={inView ? slide.text : null} target={target} theme={theme} />
      </div>
      <div className="tw:flex tw:h-6 tw:items-center tw:gap-1.5 tw:px-0.5 tw:text-[11px] tw:text-muted">
        <span className="tw:font-mono">{index + 1}</span>
        {hidden && <span className="tw:rounded tw:bg-field tw:px-1.5 tw:leading-4">Hidden</span>}
        <span className="tw:flex-1" />
        {selected && !readOnly && (
          <span className="tw:flex tw:items-center">
            <ThumbAction title={hidden ? 'Show slide when presenting' : 'Hide slide when presenting'} active={hidden} onClick={stop(() => onToggleHidden(slide.id))}>
              {hidden ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
            </ThumbAction>
            {index > 0 && (
              <ThumbAction title="Move up (Alt+↑)" onClick={stop(() => onMove(index, index - 1))}>
                <ArrowUp aria-hidden />
              </ThumbAction>
            )}
            {index < total - 1 && (
              <ThumbAction title="Move down (Alt+↓)" onClick={stop(() => onMove(index, index + 1))}>
                <ArrowDown aria-hidden />
              </ThumbAction>
            )}
            {total > 1 && (
              <ThumbAction title="Delete slide" danger onClick={stop(() => onDelete(slide.id))}>
                <Trash2 aria-hidden />
              </ThumbAction>
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
    <aside aria-label="Slides" className="tw:flex tw:h-full tw:min-h-0 tw:w-full tw:flex-col tw:rounded-[14px] tw:bg-panel-alt tw:shadow-hairline">
      <header className="tw:flex tw:items-center tw:justify-between tw:px-3 tw:pt-3 tw:pb-2">
        <span className="tw:font-semibold">Slides</span>
        <span className="tw:font-mono tw:text-[11px] tw:text-muted" title={hiddenCount ? `${hiddenCount} hidden when presenting` : undefined}>
          {hiddenCount ? `${slides.length - hiddenCount} / ${slides.length}` : slides.length}
        </span>
      </header>
      <div className="tw:flex tw:min-h-0 tw:flex-1 tw:flex-col tw:gap-2 tw:overflow-y-auto tw:px-3 tw:pt-0.5 tw:pb-3">
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
          <button
            type="button"
            onClick={onAddSlide}
            className="tw:flex tw:h-8 tw:shrink-0 tw:items-center tw:justify-center tw:gap-1.5 tw:rounded-lg tw:border tw:border-dashed tw:border-line tw:text-[13px] tw:text-fg-2 tw:hover:bg-field tw:[&_svg]:size-3.5"
          >
            <Plus aria-hidden />
            Add slide
          </button>
        )}
      </div>
    </aside>
  )
}
