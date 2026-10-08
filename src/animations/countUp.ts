import { useEffect } from 'react'
import { animate, useMotionValue, useReducedMotionConfig, useTransform, type MotionValue } from 'motion/react'

export interface ParsedStatValue {
  prefix: string
  amount: number
  decimals: number
  grouped: boolean
  suffix: string
}

const STAT_RE = /^([^0-9-]*)(-?[0-9][0-9,]*(?:\.[0-9]+)?)(.*)$/

/** "$1,200.5M" → prefix "$", amount 1200.5, 1 decimal, grouped, suffix "M". Null when not numeric. */
export function parseStatValue(value: string): ParsedStatValue | null {
  const match = STAT_RE.exec(value.trim())
  if (!match) return null
  const digits = match[2]
  const [, fraction = ''] = digits.split('.')
  return {
    prefix: match[1],
    amount: Number(digits.replace(/,/g, '')),
    decimals: fraction.length,
    grouped: digits.includes(','),
    suffix: match[3],
  }
}

export function formatStatValue(latest: number, parsed: ParsedStatValue): string {
  const number = latest.toLocaleString('en-US', {
    minimumFractionDigits: parsed.decimals,
    maximumFractionDigits: parsed.decimals,
    useGrouping: parsed.grouped,
  })
  return `${parsed.prefix}${number}${parsed.suffix}`
}

export const COUNT_UP_TRANSITION = { duration: 0.9, ease: [0.16, 1, 0.3, 1] as const }

/**
 * Counts a stat up from 0 while `visible` (Part 1 §5.5): a measurement being taken. Returns the
 * text to render, as a motion value, or the value verbatim when it is not numeric, counting is
 * off, or the user prefers reduced motion.
 */
export function useCountUp(value: string, enabled: boolean, visible: boolean): MotionValue<string> | string {
  const parsed = parseStatValue(value)
  const reduced = useReducedMotionConfig()
  const counting = enabled && parsed !== null && !reduced
  const count = useMotionValue(counting ? 0 : (parsed?.amount ?? 0))
  const text = useTransform(count, (latest) => (parsed ? formatStatValue(latest, parsed) : value))

  useEffect(() => {
    if (!counting || !parsed) return
    if (!visible) {
      count.set(0)
      return
    }
    const controls = animate(count, parsed.amount, COUNT_UP_TRANSITION)
    return () => controls.stop()
  }, [counting, visible, parsed?.amount, count])

  return counting ? text : value
}
