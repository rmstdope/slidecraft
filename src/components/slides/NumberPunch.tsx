import { motion } from 'motion/react'
import { springs } from '../../animations/springs'
import { itemVariants } from '../../animations/variants'
import { accentColors, type AccentColor } from './accents'
import { useLive, useStages } from './beats'
import { defineComponent } from './defineComponent'
import { useAccent } from './slideLayoutContext'

export interface NumberPunchProps {
  /** The number before the change. */
  from: number
  /** The number after it. */
  to: number
  /** Written after the number, e.g. "min" or "%". */
  unit?: string
  /** What is measured, under the number. */
  label?: string
  /** When `from` was measured, e.g. "in June": shows "was 38 min in June" after the change. */
  before?: string
  /** A sticker with the change: true computes the percentage, a string is shown as written. */
  delta?: boolean | string
  /** Number size in px. */
  size?: number
  accent?: AccentColor
  /** The roll to the new number waits for a build step. */
  steps?: boolean
}

const decimals = (n: number) => (Number.isInteger(n) ? 0 : Math.min(3, (String(n).split('.')[1] ?? '').length))

/**
 * Both numbers as strings of the same length, so each character has a column: digits roll,
 * other characters (a point, a minus) stay. The shorter number is padded with leading zeros.
 */
export function odometerStrings(from: number, to: number): [string, string] {
  const places = Math.max(decimals(from), decimals(to))
  const a = Math.abs(from).toFixed(places)
  const b = Math.abs(to).toFixed(places)
  const width = Math.max(a.length, b.length)
  return [a.padStart(width, '0'), b.padStart(width, '0')]
}

/** "−76%" for 38 → 9; "+12%" for a rise; "" when there is nothing to compare against. */
export function percentChange(from: number, to: number): string {
  if (!from) return ''
  const change = Math.round(((to - from) / Math.abs(from)) * 100)
  return `${change > 0 ? '+' : change < 0 ? '−' : '±'}${Math.abs(change)}%`
}

/** Leading zeros that only exist because of the padding, for dimming. */
const leadingZeros = (s: string) => {
  const m = /^0+(?=\d)/.exec(s)
  return m ? m[0].length : 0
}

function NumberPunchComponent({ from, to, unit, label, before, delta, size = 480, accent: accentProp, steps }: NumberPunchProps) {
  const accent = useAccent(accentProp)
  const color = accentColors[accent]
  const live = useLive()
  const rolled = useStages(1, steps, [1.3]) >= 1
  const enter = live ? undefined : false
  const [start, end] = odometerStrings(from, to)
  const shown = rolled ? end : start
  const dim = leadingZeros(shown)
  const negative = (rolled ? to : from) < 0
  const sticker = delta === true ? percentChange(from, to) : typeof delta === 'string' ? delta : ''
  const cell = 1 // em per digit row: a whole em, so every theme's digits fit their window

  return (
    <motion.div variants={itemVariants} style={{ position: 'relative', textAlign: 'center', padding: '40px 120px' }}>
      {before && (
        <motion.div
          initial={enter ?? { opacity: 0 }}
          animate={{ opacity: rolled ? 1 : 0 }}
          transition={{ duration: 0.4, delay: rolled && live ? 1.5 : 0 }}
          style={{ fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 34, letterSpacing: '0.12em', color: 'var(--muted)', marginBottom: 20 }}
        >
          was{' '}
          <s style={{ textDecorationColor: color, textDecorationThickness: 4 }}>
            {from}
            {unit ? ` ${unit}` : ''}
          </s>{' '}
          {before}
        </motion.div>
      )}
      <motion.div
        initial={enter ?? { opacity: 0, scale: 1.25, filter: 'blur(16px)' }}
        animate={{ opacity: 1, scale: 1, filter: 'blur(0px)', color: rolled ? color : 'var(--text)' }}
        transition={{ ...springs.punch, filter: { duration: 0.4 }, opacity: { duration: 0.25 }, color: { duration: 0.3, delay: rolled && live ? 1.1 : 0 } }}
        style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: size, lineHeight: cell, letterSpacing: '-0.02em', fontVariantNumeric: 'lining-nums tabular-nums' }}
        aria-label={`${rolled ? to : from}${unit ? ` ${unit}` : ''}`}
      >
        {negative && <span>−</span>}
        {shown.split('').map((ch, k) => {
          if (!/\d/.test(ch)) return <span key={k}>{ch}</span>
          return (
            <span key={k} aria-hidden style={{ display: 'inline-block', height: `${cell}em`, overflow: 'hidden', opacity: k < dim ? 0.18 : 1, transition: 'opacity 0.4s' }}>
              <motion.span
                initial={false}
                animate={{ y: `${-Number(ch) * cell}em` }}
                transition={live ? { duration: 1.4, ease: [0.6, 0.05, 0.2, 1], delay: k * 0.14 } : { duration: 0 }}
                style={{ display: 'flex', flexDirection: 'column' }}
              >
                {'0123456789'.split('').map((n) => (
                  <span key={n} style={{ height: `${cell}em`, lineHeight: cell }}>
                    {n}
                  </span>
                ))}
              </motion.span>
            </span>
          )
        })}
        {unit && <span style={{ fontSize: '0.3em', marginLeft: '0.2em', marginBottom: '0.3em', color: 'var(--muted)', lineHeight: 1 }}>{unit}</span>}
      </motion.div>
      {label && <div style={{ marginTop: 50, fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 34, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--muted)' }}>{label}</div>}
      {sticker && (
        <motion.div
          initial={enter ?? { scale: 0, rotate: -6 }}
          animate={{ scale: rolled ? 1 : 0, rotate: -6 }}
          transition={{ ...springs.punch, delay: rolled && live ? 1.5 : 0 }}
          style={{ position: 'absolute', right: 0, top: 30, fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 96, background: 'var(--text)', color: 'var(--bg)', padding: '6px 28px' }}
        >
          {sticker}
        </motion.div>
      )}
    </motion.div>
  )
}

/** With `steps`, the roll to the new number is a build step of the slide. */
NumberPunchComponent.countSteps = (props: NumberPunchProps): number => (props.steps ? 1 : 0)

export const NumberPunch = defineComponent<NumberPunchProps>({
  Component: NumberPunchComponent,
  registry: {
    id: 'number-punch',
    name: 'NumberPunch',
    category: 'component',
    description: 'A full-size number that punches in, then rolls like an odometer to its new value with a sticker for the change.',
    props: [
      { name: 'from', type: 'number', description: 'The number before the change' },
      { name: 'to', type: 'number', description: 'The number after it' },
      { name: 'unit', type: 'string', description: 'Written after the number, e.g. "min"' },
      { name: 'label', type: 'string', description: 'What is measured, under the number' },
      { name: 'before', type: 'string', description: 'When `from` was measured; shows "was 38 min in June"' },
      { name: 'delta', type: 'boolean | string', description: 'Sticker with the change: true computes the percentage' },
      { name: 'size', type: 'number', default: '480', description: 'Number size in px' },
      { name: 'accent', type: '"yellow" | "red" | "teal" | "navy" | "gray"', description: 'Colour of the new number; defaults to the slide accent' },
      { name: 'steps', type: 'boolean', default: 'false', description: 'The roll waits for a build step' },
    ],
    snippet: '<NumberPunch from={38} to={9} unit="min" label="Clean build" delta />',
    previewCode: '<Slide scheme="dark">\n  <NumberPunch from={38} to={9} unit="min" label="Clean build, main branch" before="in June" delta />\n</Slide>',
    keywords: ['number', 'metric', 'before after', 'odometer', 'counter', 'change', 'result', 'video', 'youtube', 'kpi'],
    useCases: ['One number that changed, before and after', 'The result a talk builds up to'],
  },
  toolbar: [
    { prop: 'accent', type: 'select', options: ['yellow', 'red', 'teal', 'navy', 'gray'] },
    { prop: 'steps', type: 'boolean' },
    { prop: 'size', type: 'number', min: 160, max: 600, step: 20 },
  ],
})
