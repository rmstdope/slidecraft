import type { CompileTarget } from '../compileSlide'
import { useMdxCompiler } from '../compileSlide'
import { SlideThumbnail } from '../../components/editor/SlideThumbnail'
import { ThemeScope } from '../../themes/ThemeContext'
import { CompileError, StillPlaceholder } from './SlideStill'

/**
 * The live preview of the slide being edited (Part 3 §2.15): the slide centred on the dotted
 * canvas, as large as the pane allows at 16:9.
 */
export function SlidePreview({ source, target, theme }: { source: string; target: CompileTarget; theme?: string }) {
  const { Component, error, isCompiling } = useMdxCompiler(source, target)
  return (
    <section aria-label="Preview" className="tw:relative tw:flex tw:h-full tw:min-h-0 tw:flex-col">
      {isCompiling && (
        <span role="status" className="tw:absolute tw:top-3 tw:right-3 tw:z-10 tw:rounded-md tw:bg-raised tw:px-2 tw:py-0.5 tw:text-[11px] tw:text-muted tw:shadow-hairline">
          Compiling…
        </span>
      )}
      <div className="tw:flex tw:min-h-0 tw:flex-1 tw:items-center tw:justify-center tw:p-6 tw:[container-type:size]">
        <div className="tw:relative tw:aspect-video tw:w-[min(100cqw,calc(100cqh*16/9))] tw:overflow-hidden tw:rounded tw:bg-black tw:shadow-[0_24px_60px_rgba(0,0,0,0.18),0_0_0_1px_rgba(0,0,0,0.05)] tw:dark:shadow-[0_24px_70px_rgba(0,0,0,0.7),0_0_0_1px_rgba(255,255,255,0.06)]">
          {error && <CompileError error={error} />}
          {!error && Component && (
            <ThemeScope theme={theme}>
              <SlideThumbnail scale="fit">
                <Component />
              </SlideThumbnail>
            </ThemeScope>
          )}
          {!error && !Component && <StillPlaceholder>Loading preview…</StillPlaceholder>}
        </div>
      </div>
    </section>
  )
}
