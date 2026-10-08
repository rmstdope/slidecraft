import type { CSSProperties } from 'react'

/** Muted italic caption under diagrams and tables. */
export const captionStyle: CSSProperties = {
  fontFamily: 'var(--font-body)',
  fontSize: 24,
  fontStyle: 'italic',
  color: 'var(--muted)',
  textAlign: 'center',
  marginTop: 20,
}

/** Fades and rises in over 0.5 s; for diagram roots that run their own timeline. */
export const fadeRise = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5 },
} as const

/** Overshoot curve for pop-in nodes and dots. */
export const OVERSHOOT = [0.34, 1.56, 0.64, 1] as const
