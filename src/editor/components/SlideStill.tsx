import { SlideThumbnail } from '../../components/editor/SlideThumbnail'
import { ThemeScope } from '../../themes/ThemeContext'
import { useMdxCompiler, type CompileTarget } from '../compileSlide'

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
      <div className="editor-compile-error" role="alert">
        <strong>Compilation error</strong>
        <pre>{error}</pre>
      </div>
    )
  }
  if (!Component) return <div className="editor-still__placeholder">{isCompiling || source === null ? 'Loading…' : (error ?? '')}</div>
  return (
    <ThemeScope theme={theme}>
      <SlideThumbnail scale={scale} showBorder={showBorder}>
        <Component />
      </SlideThumbnail>
    </ThemeScope>
  )
}
