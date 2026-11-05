import type { ReactNode } from 'react'
import { SlideThumbnail } from '../../components/editor/SlideThumbnail'
import { ThemeScope } from '../../themes/ThemeContext'
import { useMdxCompiler, type CompileTarget } from '../compileSlide'

/** Fills a positioned slide frame with a short message (loading, nothing selected). */
export function StillPlaceholder({ children }: { children: ReactNode }) {
  return <div className="tw:absolute tw:inset-0 tw:grid tw:place-items-center tw:p-2 tw:text-center tw:text-[12px] tw:text-muted">{children}</div>
}

/** A slide that does not compile: the compiler's message, scrollable. */
export function CompileError({ error }: { error: string }) {
  return (
    <div role="alert" className="tw:absolute tw:inset-0 tw:flex tw:flex-col tw:gap-2 tw:overflow-auto tw:bg-panel tw:p-4 tw:text-removed">
      <strong className="tw:font-semibold">Compilation error</strong>
      <pre className="tw:m-0 tw:font-mono tw:text-[12px] tw:whitespace-pre-wrap tw:text-fg-2">{error}</pre>
    </div>
  )
}

export interface SlideStillProps {
  /** MDX of one slide (or any snippet wrapped in a Slide); null to compile nothing yet. */
  source: string | null
  target: CompileTarget
  theme?: string
  scale?: number | 'fit'
  showBorder?: boolean
  /** Show the compile error text instead of keeping the last good render. */
  showErrors?: boolean
  onState?: (state: { isCompiling: boolean; error: string | null }) => void
}

/** A slide compiled from text and rendered as a frozen still in the deck's theme. */
export function SlideStill({ source, target, theme, scale = 'fit', showBorder, showErrors }: SlideStillProps) {
  const { Component, error, isCompiling } = useMdxCompiler(source, target)
  if (showErrors && error) {
    return (
      <CompileError error={error} />
    )
  }
  if (!Component) return <StillPlaceholder>{isCompiling || source === null ? 'Loading…' : (error ?? '')}</StillPlaceholder>
  return (
    <ThemeScope theme={theme}>
      <SlideThumbnail scale={scale} showBorder={showBorder}>
        <Component />
      </SlideThumbnail>
    </ThemeScope>
  )
}
