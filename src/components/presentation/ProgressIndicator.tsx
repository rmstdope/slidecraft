export interface ProgressIndicatorProps {
  total: number
  current: number
  step: number
  stepsOnSlide: number
  /** Light slides (light theme or any chrome) flip the pill colours for contrast. */
  light: boolean
  onSelect: (index: number) => void
}

/** Bottom-centre pills plus the "N / total · step s / S" counter (Part 1 §3.11). */
export function ProgressIndicator({ total, current, step, stepsOnSlide, light, onSelect }: ProgressIndicatorProps) {
  return (
    <>
      <nav className={`progress${light ? ' progress--light' : ''}`} aria-label="Slides" data-no-advance>
        {Array.from({ length: total }, (_, i) => (
          <button
            key={i}
            type="button"
            className={`progress__pill${i === current ? ' is-current' : ''}`}
            aria-label={`Go to slide ${i + 1}`}
            aria-current={i === current ? 'step' : undefined}
            onClick={() => onSelect(i)}
          />
        ))}
      </nav>
      <div className={`progress__counter${light ? ' progress--light' : ''}`} aria-live="polite">
        {current + 1} / {total}
        {stepsOnSlide > 0 && ` · step ${step} / ${stepsOnSlide}`}
      </div>
    </>
  )
}
