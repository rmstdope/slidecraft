import { useEffect, useRef, type ReactNode } from 'react'
import { motion } from 'motion/react'
import { itemVariants } from '../../animations/variants'
import { defineComponent } from './defineComponent'
import { useInThumbnail } from './thumbnailContext'

export interface CodeProps {
  /** The code, usually a template literal: {`...`}. */
  children?: ReactNode
  /** Scroll long code slowly so it can be read in full. */
  scroll?: boolean
  /** Pixels per second. */
  scrollSpeed?: number
  fontSize?: number
  /** Shown in a window title bar. */
  title?: string
  /** Accent-coloured border. */
  accent?: boolean
}

const BG = '#14161a'

/** Scroll position at an elapsed time: linear over maxScroll / speed seconds, clamped. */
export const scrollAt = (elapsed: number, maxScroll: number, speed: number): number =>
  maxScroll <= 0 ? 0 : Math.min(1, elapsed / (maxScroll / speed)) * maxScroll

function CodeComponent({ children, scroll = false, scrollSpeed = 30, fontSize = 28, title, accent = false }: CodeProps) {
  const areaRef = useRef<HTMLDivElement>(null)
  const hovered = useRef(false)
  const inThumbnail = useInThumbnail()

  // Auto-scroll after 1.5 s; hovering pauses the clock so the presenter can hold a frame.
  useEffect(() => {
    const el = areaRef.current
    if (!scroll || !el || inThumbnail) return
    let frame = 0
    let last = 0
    let elapsed = 0
    const tick = (now: number) => {
      if (last && !hovered.current) elapsed += (now - last) / 1000
      last = now
      const maxScroll = el.scrollHeight - el.clientHeight
      el.scrollTop = scrollAt(elapsed, maxScroll, scrollSpeed)
      if (el.scrollTop < maxScroll) frame = requestAnimationFrame(tick)
    }
    const timer = setTimeout(() => (frame = requestAnimationFrame(tick)), 1500)
    return () => {
      clearTimeout(timer)
      cancelAnimationFrame(frame)
    }
  }, [scroll, scrollSpeed, inThumbnail])

  return (
    <motion.div
      variants={itemVariants}
      onMouseEnter={() => (hovered.current = true)}
      onMouseLeave={() => (hovered.current = false)}
      style={{ width: 1300, borderRadius: 16, overflow: 'hidden', background: BG, border: `2px solid ${accent ? 'var(--accent)' : 'rgba(255,255,255,0.15)'}`, boxShadow: '0 8px 32px rgba(0,0,0,0.4)', textAlign: 'left' }}
    >
      {title && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '16px 28px', borderBottom: '1px solid rgba(255,255,255,0.08)', fontFamily: 'var(--font-body)', fontSize: 20, color: 'rgba(255,255,255,0.5)' }}>
          {['#ff5f57', '#febc2e', '#28c840'].map((c) => (
            <span key={c} aria-hidden style={{ width: 12, height: 12, borderRadius: '50%', background: c }} />
          ))}
          <span style={{ marginLeft: 12 }}>{title}</span>
        </div>
      )}
      <div style={{ position: 'relative' }}>
        <div ref={areaRef} className="code-scroll" style={{ padding: '28px 32px', maxHeight: scroll ? 600 : undefined, overflow: scroll ? 'auto' : 'visible', scrollbarWidth: 'none' }}>
          <pre style={{ margin: 0, fontFamily: 'var(--font-mono)', fontSize, lineHeight: 1.6, whiteSpace: 'pre', tabSize: 2, color: '#e6e6e6' }}>{typeof children === 'string' ? children.replace(/^\n/, '').replace(/\n\s*$/, '') : children}</pre>
        </div>
        <div aria-hidden style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 40, background: `linear-gradient(transparent, ${BG})`, pointerEvents: 'none' }} />
      </div>
    </motion.div>
  )
}

export const Code = defineComponent<CodeProps>({
  Component: CodeComponent,
  registry: {
    id: 'code',
    name: 'Code',
    category: 'component',
    description: 'Code block with optional auto-scroll to reveal long code.',
    props: [
      { name: 'scroll', type: 'boolean', default: 'false', description: 'Auto-scroll long code' },
      { name: 'scrollSpeed', type: 'number', default: '30', description: 'Pixels per second' },
      { name: 'fontSize', type: 'number', default: '28', description: 'Font size in px' },
      { name: 'title', type: 'string', description: 'Window title bar text' },
      { name: 'accent', type: 'boolean', default: 'false', description: 'Accent-coloured border' },
    ],
    snippet: '<Code title="deck.mdx">{`<Slide>\n  <Title>Hello</Title>\n</Slide>`}</Code>',
    previewCode: '<Slide theme="dark">\n  <Code title="hello.ts">{`export const hello = (name: string) => \\`Hello, \\${name}\\``}</Code>\n</Slide>',
    keywords: ['code', 'source', 'syntax', 'programming', 'snippet', 'scroll'],
    useCases: ['A short code example', 'Scrolling through a longer file'],
  },
  toolbar: [
    { prop: 'scroll', type: 'boolean' },
    { prop: 'accent', type: 'boolean' },
    { prop: 'fontSize', type: 'number', min: 16, max: 48, step: 2 },
    { prop: 'scrollSpeed', type: 'number', min: 10, max: 100, step: 5 },
  ],
})
