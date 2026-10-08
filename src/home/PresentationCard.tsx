import { useEffect, useMemo, useState, type ComponentType } from 'react'
import { motion } from 'motion/react'
import { MDXProvider } from '@mdx-js/react'
import type { MDXComponents } from 'mdx/types'
import type { PresentationInfo } from '@shared/decks.ts'
import { SlideThumbnail } from '../components/editor/SlideThumbnail'
import { mdxComponentScope } from '../components/mdxScope'
import { assetResolverFor, DeckContext } from '../components/slides/deckContext'
import { useInView } from '../hooks/useInView'
import { displayName } from './filterDecks'
import { downloadHtmlExport, downloadPdfExport } from '../api'
import { AlertIcon, ChatIcon, DownloadIcon, EditIcon, FileIcon } from './icons'

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
  onChat?: () => void
  /** Export buttons need the server (hidden in static builds). */
  canExport?: boolean
}

type Thumb = { state: 'loading' } | { state: 'ready'; Content: ComponentType } | { state: 'error'; message: string }

/** One deck on the home grid: its first slide, launch buttons and actions (Part 3 §1.6). */
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
    <button
      type="button"
      className={`icon-button${busy ? ' is-busy' : ''}${error ? ' is-error' : ''}`}
      onClick={() => void run()}
      disabled={busy}
      title={error ? `${label} failed: ${error}` : kind === 'html' ? 'Export HTML: one file that works offline' : 'Export PDF: one page per slide'}
      aria-label={label}
    >
      {busy ? <span className="icon-button__spinner" /> : kind === 'html' ? <FileIcon /> : <DownloadIcon />}
    </button>
  )
}

export function PresentationCard({ deck, index, defaultSource, load, onPresent, onDev, onEdit, onChat, canExport = false }: PresentationCardProps) {
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
      className="deck-card"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut', delay: Math.min(index, 12) * 0.1 }}
      whileHover={{ scale: 1.02, y: -4 }}
    >
      <div ref={ref} className="deck-card__thumb">
        {thumb.state === 'loading' && <div className="deck-card__spinner" role="status" aria-label="Loading preview" />}
        {thumb.state === 'error' && (
          <div className="deck-card__error" title={thumb.message}>
            <AlertIcon size={28} />
            <strong>Syntax Error</strong>
            <span>{onEdit ? 'Click Edit to fix' : 'Open it to see the error'}</span>
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
        <div className="deck-card__overlay">
          <button type="button" className="tool-button is-primary" onClick={onPresent}>
            Present
          </button>
          <button type="button" className="tool-button" onClick={onDev}>
            Dev
          </button>
        </div>
      </div>
      <footer className="deck-card__footer">
        <div className="deck-card__text">
          <h2 className="deck-card__title">{displayName(deck.path)}</h2>
          <span className="deck-card__where">
            {deck.source} / {deck.path}
          </span>
        </div>
        <div className="deck-card__actions">
          {canExport && <ExportButton kind="html" deck={deck} />}
          {canExport && <ExportButton kind="pdf" deck={deck} />}
          {onChat && (
            <button type="button" className="icon-button" onClick={onChat} title="Chat about this deck" aria-label="Chat">
              <ChatIcon />
            </button>
          )}
          {onEdit && (
            <button type="button" className="icon-button" onClick={onEdit} title="Edit" aria-label="Edit">
              <EditIcon />
            </button>
          )}
        </div>
      </footer>
    </motion.article>
  )
}
