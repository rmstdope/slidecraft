import { motion } from 'motion/react'
import { itemVariants, staggerContainer } from '../../animations/variants'
import { accentShades, isAccent, type AccentColor } from './accents'
import { defineComponent } from './defineComponent'
import { OVERSHOOT } from './styles'

export interface TimelineEvent {
  date: string
  title: string
  description?: string
  color?: AccentColor
  isDeadline?: boolean
}

export interface TimelineProps {
  events: TimelineEvent[]
  /** Fallback colour for events without one. */
  color?: AccentColor
}

const TOTAL_WIDTH = 1600
const PADDING = 80
const NODE = 24
const DEADLINE_NODE = 32
const DATE_BLOCK = 40 + 24 + 12 // margin-top, date line, margin-bottom
/** The line runs through the node centres. */
const LINE_Y = PADDING + DATE_BLOCK + DEADLINE_NODE / 2

export const timelineSpacing = (count: number): number => (count > 1 ? (TOTAL_WIDTH - 2 * PADDING) / (count - 1) : 0)

function TimelineComponent({ events, color = 'teal' }: TimelineProps) {
  const spacing = timelineSpacing(events.length)
  return (
    <motion.div variants={staggerContainer} initial="initial" animate="animate" style={{ position: 'relative', width: TOTAL_WIDTH, padding: `${PADDING}px 0 120px` }}>
      <motion.div
        aria-hidden
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 0.8, ease: [0.25, 0.1, 0.25, 1] }}
        style={{ position: 'absolute', top: LINE_Y - 2, left: PADDING, right: PADDING, height: 4, borderRadius: 2, background: 'var(--muted)', transformOrigin: 'left' }}
      />
      {/* Each column is `spacing` wide and centred on its node, so nodes sit at PADDING + i × spacing on the line. */}
      <div style={{ display: 'flex', marginLeft: events.length > 1 ? PADDING - spacing / 2 : 0, width: events.length > 1 ? events.length * spacing : TOTAL_WIDTH }}>
        {events.map((event, i) => {
          const accent = isAccent(event.color) ? event.color : isAccent(color) ? color : 'teal'
          const shade = accentShades[accent]
          const size = event.isDeadline ? DEADLINE_NODE : NODE
          return (
            <motion.div key={i} variants={itemVariants} style={{ flex: '1 1 0', minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
              <div style={{ fontFamily: 'var(--font-body)', fontSize: 20, fontWeight: 600, color: shade.base, marginTop: 40, marginBottom: 12, whiteSpace: 'nowrap', height: 24, lineHeight: '24px' }}>{event.date}</div>
              <div style={{ height: DEADLINE_NODE, display: 'flex', alignItems: 'center' }}>
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ duration: 0.4, delay: 0.3 + i * 0.15, ease: OVERSHOOT }}
                  style={{
                    width: size,
                    height: size,
                    borderRadius: event.isDeadline ? 6 : '50%',
                    background: `linear-gradient(135deg, ${shade.light}, ${shade.base}, ${shade.dark})`,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {event.isDeadline && (
                    <svg width={16} height={16} viewBox="0 0 24 24" aria-label="Deadline">
                      <path d="M4 21V4h16v10l-8 7z" fill={accent === 'yellow' ? 'var(--dark-bg)' : '#ffffff'} opacity={0.9} />
                    </svg>
                  )}
                </motion.div>
              </div>
              <div style={{ maxWidth: 280, fontFamily: 'var(--font-body)', fontSize: event.isDeadline ? 28 : 24, fontWeight: event.isDeadline ? 700 : 600, color: 'var(--text)', marginTop: 16, lineHeight: 1.3 }}>{event.title}</div>
              {event.description && <div style={{ fontFamily: 'var(--font-body)', fontSize: 18, color: 'var(--muted)', marginTop: 8, maxWidth: 200 }}>{event.description}</div>}
            </motion.div>
          )
        })}
      </div>
    </motion.div>
  )
}

export const Timeline = defineComponent<TimelineProps>({
  Component: TimelineComponent,
  registry: {
    id: 'timeline',
    name: 'Timeline',
    category: 'component',
    description: 'Horizontal timeline showing events or milestones leading to a deadline.',
    props: [
      { name: 'events', type: 'Array<{ date: string; title: string; description?: string; color?: "teal" | "yellow" | "red" | "navy"; isDeadline?: boolean }>', description: 'Events in order' },
      { name: 'color', type: '"teal" | "yellow" | "red" | "navy"', default: '"teal"', description: 'Colour for events without one' },
    ],
    snippet:
      '<Timeline\n  color="teal"\n  events={[\n    { date: "Jan", title: "Kick-off" },\n    { date: "Mar", title: "Beta" },\n    { date: "Jun", title: "Launch", isDeadline: true },\n  ]}\n/>',
    previewCode: '<Slide scheme="dark">\n  <Timeline events={[{ date: "Jan", title: "Kick-off" }, { date: "Mar", title: "Beta" }, { date: "Jun", title: "Launch", isDeadline: true }]} />\n</Slide>',
    keywords: ['timeline', 'schedule', 'milestone', 'deadline', 'events', 'dates', 'roadmap', 'plan'],
    useCases: ['Milestones towards a deadline', 'A short history'],
  },
  toolbar: [{ prop: 'color', type: 'select', options: ['teal', 'yellow', 'red', 'navy'] }],
})
