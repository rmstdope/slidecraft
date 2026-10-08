import type { CompileTarget } from '../compileSlide'
import { useMdxCompiler } from '../compileSlide'
import { SlideThumbnail } from '../../components/editor/SlideThumbnail'
import { ThemeScope } from '../../themes/ThemeContext'

/** The live preview of the slide being edited (Part 3 §2.15). */
export function SlidePreview({ source, target, theme }: { source: string; target: CompileTarget; theme?: string }) {
  const { Component, error, isCompiling } = useMdxCompiler(source, target)
  return (
    <section className="preview">
      <header className="preview__header">
        <span>Preview</span>
        {isCompiling && <span className="preview__compiling">Compiling…</span>}
      </header>
      <div className="preview__body">
        {error && (
          <div className="editor-compile-error" role="alert">
            <strong>Compilation error</strong>
            <pre>{error}</pre>
          </div>
        )}
        {!error && Component && (
          <ThemeScope theme={theme}>
            <SlideThumbnail scale="fit" showBorder>
              <Component />
            </SlideThumbnail>
          </ThemeScope>
        )}
        {!error && !Component && <div className="editor-still__placeholder">Loading preview…</div>}
      </div>
    </section>
  )
}
