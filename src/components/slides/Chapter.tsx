import { motion } from 'motion/react'
import { accentColors, type AccentColor } from './accents'
import { useLive, useStages } from './beats'
import { defineComponent } from './defineComponent'
import { useAccent } from './slideLayoutContext'

export interface ChapterProps {
  /** This chapter's number. */
  number: number
  /** How many chapters the talk has; shows progress ticks. */
  of?: number
  title: string
  /** The small line above the title; defaults to "Chapter 2 of 4". */
  label?: string
  accent?: AccentColor
  /** The title waits for a build step. */
  steps?: boolean
}

const EASE = [0.2, 0.8, 0.2, 1] as const
const pad = (n: number) => String(n).padStart(2, '0')

/** A full-slide chapter card: an accent wipe, a big number filling up, progress ticks, the title. */
function ChapterComponent({ number, of, title, label, accent: accentProp, steps }: ChapterProps) {
  const accent = useAccent(accentProp)
  const color = accentColors[accent]
  const live = useLive()
  const stage = useStages(1, steps, [0.9])
  const enter = live ? undefined : false
  const numeral = pad(number)
  const total = of && of >= number ? of : undefined

  return (
    <motion.div style={{ position: 'absolute', inset: 0, zIndex: 1, textAlign: 'left' }}>
      <div aria-hidden style={{ position: 'absolute', left: 110, top: 70, fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 640, lineHeight: 0.85, letterSpacing: '-0.03em' }}>
        {/* The empty outline the number fills; it goes once the fill is complete. */}
        <motion.span
          initial={enter ?? { opacity: 0 }}
          animate={live ? { opacity: [0, 1, 1, 0] } : { opacity: 0 }}
          transition={{ duration: 1.5, times: [0, 0.15, 0.9, 1], delay: 0.4 }}
          style={{ color: 'transparent', WebkitTextStroke: '4px color-mix(in srgb, var(--text) 35%, transparent)' }}
        >
          {numeral}
        </motion.span>
        <motion.span
          initial={enter ?? { clipPath: 'inset(100% 0% 0% 0%)' }}
          animate={{ clipPath: 'inset(0% 0% 0% 0%)' }}
          transition={{ duration: 0.9, ease: EASE, delay: 0.55 }}
          style={{ position: 'absolute', inset: 0, color }}
        >
          {numeral}
        </motion.span>
      </div>
      <div style={{ position: 'absolute', left: 900, right: 120, top: 360 }}>
        <motion.div
          initial={enter ?? { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.8 }}
          style={{ fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 26, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--muted)' }}
        >
          {label ?? (total ? `Chapter ${number} of ${total}` : `Chapter ${number}`)}
        </motion.div>
        <motion.div
          initial={enter ?? { opacity: 0, letterSpacing: '0.3em', filter: 'blur(10px)' }}
          animate={stage >= 1 ? { opacity: 1, letterSpacing: '-0.01em', filter: 'blur(0px)' } : { opacity: 0, letterSpacing: '0.3em', filter: 'blur(10px)' }}
          transition={{ duration: 0.9, ease: EASE }}
          style={{ marginTop: 24, fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 120, lineHeight: 0.98, textTransform: 'uppercase', color: 'var(--text)' }}
        >
          {title}
        </motion.div>
      </div>
      {total && (
        <div style={{ position: 'absolute', left: 900, bottom: 150, display: 'flex', alignItems: 'center', gap: 14 }}>
          {Array.from({ length: total }, (_, i) => {
            const n = i + 1
            const style = { width: 120, height: 8, background: n < number ? 'color-mix(in srgb, var(--text) 55%, transparent)' : 'color-mix(in srgb, var(--text) 15%, transparent)' }
            return n === number ? (
              <motion.i key={n} initial={enter ?? { scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 0.8, ease: EASE, delay: 0.9 }} style={{ ...style, background: color, transformOrigin: 'left' }} />
            ) : (
              <i key={n} style={style} />
            )
          })}
          <span style={{ marginLeft: 12, fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 24, letterSpacing: '0.1em', color: 'var(--muted)' }}>
            {numeral} / {pad(total)}
          </span>
        </div>
      )}
      {live && (
        <motion.div
          aria-hidden
          initial={{ x: '-101%' }}
          animate={{ x: ['-101%', '0%', '101%'] }}
          transition={{ duration: 0.95, ease: EASE, times: [0, 0.45, 1] }}
          style={{ position: 'absolute', inset: 0, background: color }}
        />
      )}
    </motion.div>
  )
}

/** With `steps`, the title is a build step of the slide. */
ChapterComponent.countSteps = (props: ChapterProps): number => (props.steps ? 1 : 0)

export const Chapter = defineComponent<ChapterProps>({
  Component: ChapterComponent,
  registry: {
    id: 'chapter',
    name: 'Chapter',
    category: 'component',
    description: 'A full-slide chapter card: an accent wipe cuts across, the big chapter number fills up, progress ticks show where the talk is, and the title tightens into place.',
    props: [
      { name: 'number', type: 'number', description: "This chapter's number" },
      { name: 'of', type: 'number', description: 'How many chapters the talk has; shows progress ticks' },
      { name: 'title', type: 'string', description: 'Chapter title' },
      { name: 'label', type: 'string', description: 'The line above the title; defaults to "Chapter 2 of 4"' },
      { name: 'accent', type: '"yellow" | "red" | "teal" | "navy" | "gray"', description: 'Wipe and number colour; defaults to the slide accent' },
      { name: 'steps', type: 'boolean', default: 'false', description: 'The title waits for a build step' },
    ],
    snippet: '<Chapter number={2} of={4} title="Where the time went" />',
    previewCode: '<Slide scheme="dark">\n  <Chapter number={2} of={4} title="Where the time went" />\n</Slide>',
    keywords: ['chapter', 'section', 'divider', 'part', 'agenda', 'progress', 'video', 'youtube'],
    useCases: ['The start of each part of a talk', 'Showing how far through the talk you are'],
  },
  toolbar: [
    { prop: 'accent', type: 'select', options: ['yellow', 'red', 'teal', 'navy', 'gray'] },
    { prop: 'steps', type: 'boolean' },
    { prop: 'number', type: 'number', min: 1, max: 20, step: 1 },
    { prop: 'of', type: 'number', min: 1, max: 20, step: 1 },
  ],
})
