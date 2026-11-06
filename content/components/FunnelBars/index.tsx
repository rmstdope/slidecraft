/**
 * An example vault component: it lives in the Examples vault's components/ folder rather than in
 * the app, and imports the app only through 'slidecraft'. Copy this folder into your own vault's
 * components/ to start one of your own.
 */
import { motion } from 'motion/react'
import { accentShades, defineComponent, isAccent, useAccent, type AccentColor } from 'slidecraft'

export interface FunnelBarsProps {
  /** From the widest stage to the narrowest; `value` sets the width and is shown beside the label. */
  stages: { label: string; value: number }[]
  /** Defaults to the slide accent. */
  color?: AccentColor
  /** Text after each value, such as "%". */
  unit?: string
}

export const FunnelBars = defineComponent<FunnelBarsProps>({
  Component: function FunnelBarsComponent({ stages, color, unit = '' }) {
    const slideAccent = useAccent()
    const shade = accentShades[isAccent(color) ? color : slideAccent]
    const max = Math.max(1, ...stages.map((s) => s.value))
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18, width: '100%', maxWidth: 1300 }}>
        {stages.map((stage, i) => (
          <motion.div
            key={stage.label}
            initial={{ opacity: 0, scaleX: 0.6 }}
            animate={{ opacity: 1, scaleX: 1 }}
            transition={{ duration: 0.5, delay: i * 0.12 }}
            style={{
              width: `${Math.max(24, (stage.value / max) * 100)}%`,
              height: 84,
              borderRadius: 14,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0 32px',
              boxSizing: 'border-box',
              background: `linear-gradient(${shade.light}, ${shade.base} 55%, ${shade.dark})`,
              boxShadow: '0 10px 30px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.2)',
              color: '#ffffff',
              fontFamily: 'var(--font-body)',
              fontSize: 30,
              fontWeight: 600,
              textShadow: '0 1px 2px rgba(0,0,0,0.35)',
            }}
          >
            <span>{stage.label}</span>
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>
              {stage.value}
              {unit}
            </span>
          </motion.div>
        ))}
      </div>
    )
  },
  registry: {
    id: 'funnel-bars',
    name: 'FunnelBars',
    category: 'component',
    description: 'Stage bars that narrow from top to bottom, one per step of a funnel.',
    props: [
      { name: 'stages', type: 'Array<{ label: string; value: number }>', description: 'From the widest stage to the narrowest' },
      { name: 'color', type: '"teal" | "yellow" | "red" | "navy"', description: 'Optional; defaults to the slide accent' },
      { name: 'unit', type: 'string', default: '""', description: 'Text after each value, such as "%"' },
    ],
    snippet: '<FunnelBars unit="%" stages={[{ label: "Visited", value: 100 }, { label: "Signed up", value: 42 }, { label: "Paid", value: 9 }]} />',
    previewCode:
      '<Slide scheme="dark">\n  <FunnelBars unit="%" stages={[{ label: "Visited", value: 100 }, { label: "Signed up", value: 42 }, { label: "Active", value: 21 }, { label: "Paid", value: 9 }]} />\n</Slide>',
    keywords: ['funnel', 'conversion', 'stages', 'bars', 'drop-off'],
    useCases: ['Conversion through a sign-up flow', 'Drop-off between the stages of a process'],
  },
})
