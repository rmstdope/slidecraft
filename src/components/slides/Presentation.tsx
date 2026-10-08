import { Children, cloneElement, isValidElement, useEffect, useState, type ReactElement, type ReactNode } from 'react'
import { defineComponent } from './defineComponent'
import type { SlideProps } from './Slide'

export interface PresentationProps {
  children?: ReactNode
}

const HASH_RE = /^#slide-(\d+)(?:-step-(\d+))?$/

function slideFromHash(total: number): number {
  const match = HASH_RE.exec(window.location.hash)
  const n = match ? Number(match[1]) - 1 : 0
  return Math.max(0, Math.min(total - 1, n))
}

/**
 * Phase 1 stub: renders the slide named by the #slide-N hash. Phase 2 replaces it with the
 * full engine (navigation, transitions, overview, dev mode, presenter sync).
 */
function PresentationComponent({ children }: PresentationProps) {
  const slides = Children.toArray(children).filter(
    (child): child is ReactElement<SlideProps> => isValidElement<SlideProps>(child) && !child.props.hidden,
  )
  const [index, setIndex] = useState(() => slideFromHash(slides.length))
  useEffect(() => {
    const onHashChange = () => setIndex(slideFromHash(slides.length))
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [slides.length])

  const devMode = new URLSearchParams(window.location.search).get('mode') === 'dev'
  const slide = slides[index]
  return (
    <div className="presentation" style={{ position: 'fixed', inset: 0, overflow: 'hidden', background: 'var(--dark-bg)' }}>
      {slide ? cloneElement(slide, { key: index, _devMode: devMode }) : <div className="presentation__empty">No slides yet</div>}
    </div>
  )
}

export const Presentation = defineComponent<PresentationProps>({
  Component: PresentationComponent,
  registry: {
    id: 'presentation',
    name: 'Presentation',
    category: 'component',
    description: 'The deck root; every child Slide is one slide.',
    props: [],
    snippet: '<Presentation>\n\n<Slide>\n  <Title>First slide</Title>\n</Slide>\n\n</Presentation>',
    previewCode: '<Slide theme="dark">\n  <Title>Presentation</Title>\n  <Subtitle>Wraps every slide</Subtitle>\n</Slide>',
    keywords: ['deck', 'root', 'presentation'],
    useCases: ['The outermost element of every deck'],
  },
})
