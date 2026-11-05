import { Children, type ReactNode } from 'react'
import { motion } from 'motion/react'
import { springs } from '../../animations/springs'
import { itemVariants } from '../../animations/variants'
import { accentColors, onAccent, type AccentColor } from './accents'
import { useLive, useStages } from './beats'
import { defineComponent } from './defineComponent'
import { useAccent, useSlideLayout } from './slideLayoutContext'

export interface PunchlineProps {
  /** The headline, as plain text. */
  children?: ReactNode
  /** The words to mark with a highlighter swipe; must appear in the headline. */
  highlight?: string
  /** A supporting line that slides up under the headline. */
  sub?: string
  /** Headline size in px. */
  size?: number
  uppercase?: boolean
  accent?: AccentColor
  /** The highlight and the supporting line each wait for a build step. */
  steps?: boolean
}

type Piece = { text: string; marked: boolean }

/** The headline as words, with the highlighted phrase kept together as one piece. */
export function punchlineWords(text: string, highlight?: string): Piece[] {
  const words = (s: string): Piece[] => s.split(/\s+/).filter(Boolean).map((w) => ({ text: w, marked: false }))
  const at = highlight ? text.toLowerCase().indexOf(highlight.toLowerCase()) : -1
  if (!highlight || at < 0) return words(text)
  return [...words(text.slice(0, at)), { text: text.slice(at, at + highlight.length), marked: true }, ...words(text.slice(at + highlight.length))]
}

const plainText = (children: ReactNode): string | null => {
  const parts = Children.toArray(children)
  return parts.every((p) => typeof p === 'string' || typeof p === 'number') ? parts.join('').trim() : null
}

function stageCount({ highlight, sub }: Pick<PunchlineProps, 'highlight' | 'sub'>): number {
  return (highlight ? 1 : 0) + (sub ? 1 : 0)
}

function PunchlineComponent({ children, highlight, sub, size = 180, uppercase = true, accent: accentProp, steps }: PunchlineProps) {
  const accent = useAccent(accentProp)
  const { layout, align } = useSlideLayout()
  const live = useLive()
  const stage = useStages(stageCount({ highlight, sub }), steps, [1.0, 1.7])
  const text = plainText(children)
  const pieces = text === null ? null : punchlineWords(text, highlight)
  const marked = highlight ? stage >= 1 : false
  const subShown = sub ? stage >= (highlight ? 2 : 1) : false
  const enter = live ? undefined : false
  const left = layout === 'document' || align === 'left'

  return (
    <motion.div variants={itemVariants} style={{ maxWidth: 1700, textAlign: left ? 'left' : 'center' }}>
      <div
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 700,
          fontSize: size,
          lineHeight: 0.95,
          letterSpacing: '-0.01em',
          textTransform: uppercase ? 'uppercase' : undefined,
          color: 'var(--text)',
        }}
      >
        {pieces
          ? pieces.map((piece, i) => (
              <motion.span
                key={i}
                initial={enter ?? { opacity: 0, y: 60, scale: 1.35, filter: 'blur(14px)' }}
                animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
                transition={{ ...springs.punch, delay: i * 0.13, filter: { duration: 0.35, delay: i * 0.13 }, opacity: { duration: 0.2, delay: i * 0.13 } }}
                style={{ display: 'inline-block', marginRight: '0.22em', position: 'relative', zIndex: 0 }}
              >
                {piece.marked && (
                  <motion.span
                    aria-hidden
                    initial={enter ?? { scaleX: 0 }}
                    animate={{ scaleX: marked ? 1 : 0 }}
                    transition={{ duration: 0.45, ease: [0.2, 0.8, 0.2, 1] }}
                    style={{ position: 'absolute', zIndex: -1, left: '-0.08em', right: '-0.08em', top: '0.08em', bottom: '0.02em', background: accentColors[accent], transformOrigin: 'left', skewX: -8 }}
                  />
                )}
                <span style={{ color: piece.marked && marked ? onAccent(accent) : undefined, transition: 'color 0.2s ease 0.2s' }}>{piece.text}</span>
              </motion.span>
            ))
          : children}
      </div>
      {sub && (
        <div style={{ overflow: 'hidden', marginTop: Math.round(size * 0.25) }}>
          <motion.div
            initial={enter ?? { y: '110%' }}
            animate={{ y: subShown ? '0%' : '110%' }}
            transition={{ duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }}
            style={{ fontFamily: 'var(--font-body)', fontSize: Math.max(32, Math.round(size * 0.27)), color: 'var(--muted)' }}
          >
            {sub}
          </motion.div>
        </div>
      )}
    </motion.div>
  )
}

/** With `steps`, the highlight and the supporting line are build steps of the slide. */
PunchlineComponent.countSteps = (props: PunchlineProps): number => (props.steps ? stageCount(props) : 0)

export const Punchline = defineComponent<PunchlineProps>({
  Component: PunchlineComponent,
  registry: {
    id: 'punchline',
    name: 'Punchline',
    category: 'component',
    description: 'A headline whose words slam in one after another, then a highlighter swipe across the key words and a supporting line sliding up.',
    props: [
      { name: 'highlight', type: 'string', description: 'Words of the headline to mark with a highlighter' },
      { name: 'sub', type: 'string', description: 'Supporting line under the headline' },
      { name: 'size', type: 'number', default: '180', description: 'Headline size in px' },
      { name: 'uppercase', type: 'boolean', default: 'true', description: 'Set the headline in capitals' },
      { name: 'accent', type: '"yellow" | "red" | "teal" | "navy" | "gray"', description: 'Highlighter colour; defaults to the slide accent' },
      { name: 'steps', type: 'boolean', default: 'false', description: 'The highlight and the supporting line wait for build steps' },
    ],
    snippet: '<Punchline highlight="41%" sub="after one change to the cache">Builds got 41% faster</Punchline>',
    previewCode: '<Slide scheme="dark">\n  <Punchline highlight="41%" sub="after one change to the cache">Builds got 41% faster</Punchline>\n</Slide>',
    keywords: ['headline', 'kinetic', 'typography', 'highlight', 'marker', 'video', 'youtube', 'punch', 'statement'],
    useCases: ['The one sentence a slide is about, landing word by word', 'A result with the number marked'],
  },
  toolbar: [
    { prop: 'accent', type: 'select', options: ['yellow', 'red', 'teal', 'navy', 'gray'] },
    { prop: 'steps', type: 'boolean' },
    { prop: 'uppercase', type: 'boolean' },
    { prop: 'size', type: 'number', min: 80, max: 260, step: 10 },
  ],
})
