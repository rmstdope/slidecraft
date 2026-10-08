import { useEffect, type ReactElement, type ReactNode } from 'react'
import { SlideThumbnail } from '../editor/SlideThumbnail'
import type { SlideProps } from '../slides/Slide'
import { sanitizeReaderNotes } from './readerNotes'

export interface ReaderViewProps {
  slides: ReactElement<SlideProps>[]
  notes: (ReactNode | undefined)[]
  onPresent(): void
}

const smooth = () => (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth')

function goTo(index: number) {
  document.getElementById(`slide-${index + 1}`)?.scrollIntoView({ behavior: smooth(), block: 'start' })
  window.history.replaceState(window.history.state, '', `${window.location.pathname}${window.location.search}#slide-${index + 1}`)
}

/** Every slide with its notes, as a scrolling document that prints as a handout (Part 1 §11.3). */
export function ReaderView({ slides, notes, onPresent }: ReaderViewProps) {
  const total = slides.length
  useEffect(() => {
    const match = /^#slide-(\d+)/.exec(window.location.hash)
    if (match) document.getElementById(`slide-${match[1]}`)?.scrollIntoView({ block: 'start' })
  }, [])
  return (
    <div className="reader-view">
      <button type="button" className="reader-view__present" onClick={onPresent}>
        Present
      </button>
      {slides.map((slide, i) => {
        const note = notes[i]
        return (
          <article key={i} className="reader-slide" id={`slide-${i + 1}`}>
            <div className="reader-slide__grid">
              <figure className="reader-slide__figure">
                <div className="reader-slide__frame">
                  <SlideThumbnail>{slide}</SlideThumbnail>
                </div>
                <figcaption>
                  {i + 1} / {total}
                </figcaption>
              </figure>
              <aside className="reader-slide__notes">
                <h2>Notes</h2>
                {note ? <div className="reader-slide__note-body">{sanitizeReaderNotes(note)}</div> : <p className="reader-slide__empty">No notes for this slide.</p>}
              </aside>
            </div>
            <nav className="reader-slide__nav">
              <button type="button" disabled={i === 0} onClick={() => goTo(i - 1)}>
                ← Previous
              </button>
              <button type="button" disabled={i === total - 1} onClick={() => goTo(i + 1)}>
                Next →
              </button>
            </nav>
          </article>
        )
      })}
    </div>
  )
}
