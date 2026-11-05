import { useEffect, useMemo, useState, type ComponentType } from 'react'
import { motion } from 'motion/react'
import { MDXProvider } from '@mdx-js/react'
import type { MDXComponents } from 'mdx/types'
import { AlertTriangle, FileCode2, FileDown, Loader2, PencilLine, Play } from 'lucide-react'
import type { PresentationInfo } from '@shared/decks.ts'
import { SlideThumbnail } from '../components/editor/SlideThumbnail'
import { mdxComponentScope } from '../components/mdxScope'
import { assetResolverFor, DeckContext } from '../components/slides/deckContext'
import { useInView } from '../hooks/useInView'
import { displayName } from './filterDecks'
import { downloadHtmlExport, downloadPdfExport } from '../api'
import { Button, cn } from '../ui'

const scope = mdxComponentScope as MDXComponents

/** Compiled decks, keyed by deck and modification time, so returning home does not recompile. */
const compiled = new Map<string, Promise<ComponentType>>()

export interface PresentationCardProps {
  deck: PresentationInfo
  index: number
  defaultSource?: string
  load: () => Promise<ComponentType>
  onPresent(): void
  onDev(): void
  onEdit?: () => void
  /** Export buttons need the server (hidden in static builds). */
  canExport?: boolean
}

type Thumb = { state: 'loading' } | { state: 'ready'; Content: ComponentType } | { state: 'error'; message: string }

function ExportButton({ kind, deck }: { kind: 'html' | 'pdf'; deck: PresentationInfo }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const label = kind === 'html' ? 'Export HTML' : 'Export PDF'
  const run = async () => {
    setBusy(true)
    setError(null)
    const result = await (kind === 'html' ? downloadHtmlExport(deck) : downloadPdfExport(deck))
    setBusy(false)
    if (result.error) setError(result.error)
  }
  return (
    <Button
      size="icon-sm"
      variant="ghost"
      className={cn(error && 'tw:text-removed')}
      onClick={() => void run()}
      disabled={busy}
      title={error ? `${label} failed: ${error}` : kind === 'html' ? 'Export HTML: one file that works offline' : 'Export PDF: one page per slide'}
      aria-label={label}
    >
      {busy ? <Loader2 className="tw:animate-spin" aria-hidden /> : kind === 'html' ? <FileCode2 aria-hidden /> : <FileDown aria-hidden />}
    </Button>
  )
}

/** One deck on the home grid: its first slide, launch buttons and actions (Part 3 §1.6). */
export function PresentationCard({ deck, index, defaultSource, load, onPresent, onDev, onEdit, canExport = false }: PresentationCardProps) {
  const [ref, inView] = useInView<HTMLDivElement>()
  const [thumb, setThumb] = useState<Thumb>({ state: 'loading' })
  const key = `${deck.source}:${deck.path}:${deck.updatedAt}`

  useEffect(() => {
    if (!inView) return
    let live = true
    let job = compiled.get(key)
    if (!job) {
      job = load()
      compiled.set(key, job)
      job.catch(() => compiled.delete(key)) // retry next time
    }
    job.then(
      (Content) => live && setThumb({ state: 'ready', Content }),
      (error: Error) => live && setThumb({ state: 'error', message: error.message }),
    )
    return () => {
      live = false
    }
  }, [inView, key, load])

  const deckContext = useMemo(() => ({ deck, resolveAsset: assetResolverFor(deck, defaultSource) }), [deck, defaultSource])

  return (
    <motion.article
      className="tw:flex tw:min-w-0 tw:flex-col tw:gap-2.5"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut', delay: Math.min(index, 12) * 0.06 }}
    >
      <div className="tw:rounded-xl tw:bg-field tw:p-2.5">
        <div ref={ref} className="tw:group tw:relative tw:aspect-video tw:overflow-hidden tw:rounded-md tw:bg-black tw:shadow-[0_6px_16px_rgba(0,0,0,0.12)] tw:dark:shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_6px_16px_rgba(0,0,0,0.5)]">
          {thumb.state === 'loading' && (
            <div className="tw:absolute tw:inset-0 tw:grid tw:place-items-center" role="status" aria-label="Loading preview">
              <Loader2 className="tw:size-5 tw:animate-spin tw:text-white/60" aria-hidden />
            </div>
          )}
          {thumb.state === 'error' && (
            <div className="tw:absolute tw:inset-0 tw:flex tw:flex-col tw:items-center tw:justify-center tw:gap-1 tw:bg-panel-alt tw:p-3 tw:text-center tw:text-removed" title={thumb.message}>
              <AlertTriangle className="tw:size-6" aria-hidden />
              <strong className="tw:font-semibold">Syntax error</strong>
              <span className="tw:text-[12px] tw:text-muted">{onEdit ? 'Open it in the workspace to fix' : 'Open it to see the error'}</span>
            </div>
          )}
          {thumb.state === 'ready' && (
            <DeckContext.Provider value={deckContext}>
              <MDXProvider components={scope}>
                <SlideThumbnail>
                  <thumb.Content />
                </SlideThumbnail>
              </MDXProvider>
            </DeckContext.Provider>
          )}
          <div className="tw:absolute tw:inset-0 tw:flex tw:items-center tw:justify-center tw:gap-2 tw:bg-black/45 tw:opacity-0 tw:transition-opacity tw:duration-150 tw:group-hover:opacity-100 tw:focus-within:opacity-100">
            <button
              type="button"
              onClick={onPresent}
              className="tw:inline-flex tw:h-9 tw:items-center tw:gap-1.5 tw:rounded-[9px] tw:bg-white tw:px-3.5 tw:font-medium tw:text-black tw:hover:bg-white/90 tw:[&_svg]:size-3.5"
            >
              <Play className="tw:fill-current" aria-hidden />
              Present
            </button>
            <button
              type="button"
              onClick={onDev}
              title="Present with the dev overlay: outlines, overflow and timing"
              className="tw:inline-flex tw:h-9 tw:items-center tw:rounded-[9px] tw:bg-black/50 tw:px-3.5 tw:font-medium tw:text-white tw:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.3)] tw:hover:bg-black/70"
            >
              Dev
            </button>
          </div>
        </div>
      </div>
      <div className="tw:flex tw:items-start tw:gap-2 tw:px-0.5">
        <div className="tw:flex tw:min-w-0 tw:flex-1 tw:flex-col">
          <h3 className="tw:truncate tw:font-medium">{displayName(deck.path)}</h3>
          <span className="tw:truncate tw:font-mono tw:text-[12px] tw:text-muted" title={`${deck.source} / ${deck.path}`}>
            {deck.path}
          </span>
        </div>
        <div className="tw:-mr-1 tw:flex tw:shrink-0 tw:items-center">
          {canExport && <ExportButton kind="html" deck={deck} />}
          {canExport && <ExportButton kind="pdf" deck={deck} />}
          {onEdit && (
            <Button size="icon-sm" variant="ghost" onClick={onEdit} title="Open in the workspace: the agent and the editor" aria-label="Open in the workspace">
              <PencilLine aria-hidden />
            </Button>
          )}
        </div>
      </div>
    </motion.article>
  )
}
