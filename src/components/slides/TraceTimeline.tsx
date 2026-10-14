import { Children, isValidElement, useEffect, useState, type ReactElement, type ReactNode } from 'react'
import { animate, motion, useMotionValue, useMotionValueEvent, useTransform } from 'motion/react'
import { useStepState } from '../../animations/stepContext'
import { ALL_STEPS } from '../../animations/steps'
import { itemVariants } from '../../animations/variants'
import { accentColors, type AccentColor } from './accents'
import { defineComponent } from './defineComponent'
import { GlowFilter, useWireKit } from './glow'
import { useAccent } from './slideLayoutContext'

export interface MilestoneProps {
  /** "YYYY-MM" or "YYYY-MM-DD". */
  at: string
  label: string
  detail?: string
}

export interface TraceTimelineProps {
  /** First month shown, "YYYY-MM". */
  from: string
  /** Last month shown, "YYYY-MM". */
  to: string
  /** Where the charge stops, "YYYY-MM-DD"; later milestones are planned. Omitted: everything is done. */
  now?: string
  /** Each milestone up to now is a build step, and the last step runs on to now. */
  steps?: boolean
  children?: ReactNode
  accent?: AccentColor
  /** Total width in px. */
  width?: number
}

const HEIGHT = 560
const LINE_Y = 280
const PAD = 160
const NODE_R = 14

/** "YYYY-MM[-DD]" as fractional months since year 0; NaN when unreadable. */
export function monthIndex(date: string): number {
  const match = /^(\d{4})-(\d{1,2})(?:-(\d{1,2}))?$/.exec(date.trim())
  if (!match) return Number.NaN
  const year = Number(match[1])
  const month = Number(match[2])
  const day = match[3] ? Number(match[3]) : 1
  if (month < 1 || month > 12) return Number.NaN
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate()
  return year * 12 + (month - 1) + (Math.min(Math.max(day, 1), days) - 1) / days
}

export interface TimelinePlan {
  start: number
  end: number
  now: number
  /** Milestones with their position, in date order. */
  milestones: (MilestoneProps & { t: number; future: boolean })[]
  /** Where the charge rests before the first step. */
  rest: number
  /** Where the charge goes on each build step (only with `steps`). */
  targets: number[]
}

function milestoneProps(children: ReactNode): MilestoneProps[] {
  return Children.toArray(children)
    .filter((child): child is ReactElement<MilestoneProps> => isValidElement(child) && (child.type as { displayName?: string }).displayName === 'Milestone')
    .map((child) => child.props)
}

/** The timeline's geometry in months: shared by rendering and step counting. */
export function planTimeline({ from, to, now, steps, children }: Pick<TraceTimelineProps, 'from' | 'to' | 'now' | 'steps' | 'children'>): TimelinePlan {
  const items = milestoneProps(children)
    .map((m) => ({ ...m, t: monthIndex(m.at) }))
    .filter((m) => Number.isFinite(m.t))
    .sort((a, b) => a.t - b.t)
  let start = monthIndex(from)
  let end = monthIndex(to) + 1
  if (!Number.isFinite(start)) start = items[0]?.t ?? 0
  if (!Number.isFinite(end) || end <= start) end = Math.max(start + 1, (items.at(-1)?.t ?? start) + 1)
  const parsedNow = now ? monthIndex(now) : Number.NaN
  const nowT = Number.isFinite(parsedNow) ? Math.min(Math.max(parsedNow, start), end) : end
  const milestones = items.map((m) => ({ ...m, t: Math.min(Math.max(m.t, start), end), future: m.t > nowT }))
  const past = milestones.filter((m) => !m.future)
  const rest = past.length && past[0].t <= start + 0.5 ? past[0].t : start
  const targets = steps ? [...past.filter((m) => m.t > rest).map((m) => m.t), ...(now && nowT > (past.at(-1)?.t ?? rest) ? [nowT] : [])] : []
  return { start, end, now: nowT, milestones, rest, targets }
}

const MONTH_LETTERS = 'JFMAMJJASOND'

function TraceTimelineComponent(props: TraceTimelineProps) {
  const { now, accent: accentProp, width = 1760 } = props
  const accent = useAccent(accentProp)
  const kit = useWireKit(accentColors[accent])
  const { colors: c, filter, live } = kit
  const { step: current } = useStepState()
  const plan = planTimeline(props)
  const { start, end, milestones, rest, targets } = plan
  const nowT = plan.now
  const x = (t: number) => PAD + ((t - start) / (end - start)) * (width - 2 * PAD)
  const entry = live ? undefined : false

  // The charge's goal: now when the timeline plays through, else the target of the current beat.
  const goal = !props.steps || current === ALL_STEPS ? nowT : current <= 0 ? rest : (targets[Math.min(current, targets.length) - 1] ?? nowT)
  const charge = useMotionValue(live ? rest : goal)
  const [reached, setReached] = useState(live ? rest : goal)

  useEffect(() => {
    if (!live) {
      charge.set(goal)
      return
    }
    const travel = Math.abs(goal - charge.get())
    if (travel < 0.001) return
    const controls = animate(charge, goal, props.steps ? { duration: Math.min(1.2, 0.5 + travel * 0.15), ease: 'easeInOut' } : { duration: 3.2, delay: 0.6, ease: 'easeInOut' })
    return () => controls.stop()
  }, [live, goal, charge, props.steps])

  useMotionValueEvent(charge, 'change', (t) => {
    // Re-render only when the charge passes a milestone or arrives at now.
    const lit = milestones.filter((m) => !m.future && m.t <= t + 0.01).length
    const was = milestones.filter((m) => !m.future && m.t <= reached + 0.01).length
    if (lit !== was || (t >= nowT - 0.001) !== (reached >= nowT - 0.001)) setReached(t)
  })

  const progress = useTransform(charge, (t) => (nowT > start ? (t - start) / (nowT - start) : 1))
  const chargeX = useTransform(charge, x)
  const atNow = reached >= nowT - 0.001
  // NOW goes on the side away from the nearest milestone's label and stub.
  const nearest = milestones.reduce<number>((best, m, i) => (best < 0 || Math.abs(m.t - nowT) < Math.abs(milestones[best].t - nowT) ? i : best), -1)
  const nowAbove = nearest >= 0 && nearest % 2 === 1
  const months = Math.round(end - start)
  const ticks: { t: number; text: string; above: boolean }[] = []
  for (let k = 0; k < months; k++) {
    const t = Math.ceil(start) + k
    const month = ((t % 12) + 12) % 12
    if (months <= 24) ticks.push({ t, text: MONTH_LETTERS[month], above: k % 2 === 1 })
    else if (month === 0) ticks.push({ t, text: String(Math.floor(t / 12)), above: false })
  }

  return (
    <motion.div variants={itemVariants} style={{ position: 'relative', width, height: HEIGHT, flexShrink: 0 }}>
      <svg width={width} height={HEIGHT} viewBox={`0 0 ${width} ${HEIGHT}`} style={{ position: 'absolute', inset: 0, overflow: 'visible' }} aria-hidden>
        <defs>
          <GlowFilter kit={kit} width={width} height={HEIGHT} />
        </defs>
        <line x1={x(start)} y1={LINE_Y} x2={x(nowT)} y2={LINE_Y} stroke={c.dim} strokeWidth={3} />
        {nowT < end && <line x1={x(nowT)} y1={LINE_Y} x2={x(end)} y2={LINE_Y} stroke={c.dim} strokeWidth={3} strokeDasharray="10 12" />}
        {nowT > start && <motion.path d={`M${x(start)},${LINE_Y} H${x(nowT)}`} fill="none" stroke={c.accent} strokeWidth={4} strokeLinecap="round" filter={filter} style={{ pathLength: progress }} />}
        {ticks.map((tick) => (
          <text
            key={tick.t}
            x={x(tick.t)}
            y={tick.above ? LINE_Y - 26 : LINE_Y + 44}
            textAnchor="middle"
            style={{ fontFamily: 'var(--font-body)', fontSize: 20, letterSpacing: '0.1em', fill: c.steel, opacity: 0.75 }}
          >
            {tick.text}
          </text>
        ))}
        {milestones.map((m, i) => {
          const lit = !m.future && m.t <= reached + 0.01
          const up = i % 2 === 0
          return (
            <g key={`m-${i}`}>
              <line x1={x(m.t)} y1={up ? LINE_Y - 60 : LINE_Y + 70} x2={x(m.t)} y2={up ? LINE_Y - 150 : LINE_Y + 160} stroke={lit ? c.steel : c.dim} strokeWidth={2} style={{ transition: 'stroke 0.25s' }} />
              <circle
                cx={x(m.t)}
                cy={LINE_Y}
                r={NODE_R}
                fill={lit ? c.core : 'var(--bg)'}
                stroke={lit ? c.accent : m.future ? c.steel : c.dim}
                strokeWidth={3}
                strokeDasharray={m.future ? '5 5' : undefined}
                filter={lit ? filter : undefined}
                style={{ transition: 'fill 0.25s, stroke 0.25s' }}
              />
            </g>
          )
        })}
        {now && atNow && (
          <motion.circle
            cx={x(nowT)}
            cy={LINE_Y}
            r={30}
            fill="none"
            stroke={c.accent}
            strokeWidth={2}
            style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
            initial={{ opacity: 0.9, scale: 1 }}
            animate={live ? { opacity: [0.9, 0.25, 0.9], scale: [1, 1.6, 1] } : { opacity: 0.9, scale: 1 }}
            transition={live ? { duration: 2.4, ease: 'easeInOut', repeat: Infinity } : undefined}
          />
        )}
        <motion.circle r={12} cx={chargeX} cy={LINE_Y} fill={c.core} filter={filter} />
      </svg>
      {milestones.map((m, i) => {
        const lit = !m.future && m.t <= reached + 0.01
        const up = i % 2 === 0
        return (
          <motion.div
            key={`l-${i}`}
            initial={entry ?? { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            style={{
              position: 'absolute',
              left: x(m.t) - 170,
              width: 340,
              top: up ? LINE_Y - 245 : LINE_Y + 168,
              height: 80,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: up ? 'flex-end' : 'flex-start',
              alignItems: 'center',
              textAlign: 'center',
              gap: 4,
            }}
          >
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 36, lineHeight: 1.1, color: lit ? 'var(--text)' : 'var(--muted)', opacity: lit ? 1 : 0.75, transition: 'color 0.3s, opacity 0.3s', whiteSpace: 'nowrap' }}>
              {m.label}
            </span>
            {m.detail && <span style={{ fontFamily: 'var(--font-body)', fontSize: 24, color: 'var(--muted)', opacity: lit ? 1 : 0.55, transition: 'opacity 0.3s', whiteSpace: 'nowrap' }}>{m.detail}</span>}
          </motion.div>
        )
      })}
      {now && atNow && (
        <div style={{ position: 'absolute', left: x(nowT) - 60, width: 120, top: nowAbove ? LINE_Y - 100 : LINE_Y + 72, textAlign: 'center', fontFamily: 'var(--font-body)', fontSize: 22, fontWeight: 600, letterSpacing: '0.14em', color: c.accent }}>NOW</div>
      )}
    </motion.div>
  )
}

/** The build steps a timeline adds to its slide: one per milestone up to now, then now. */
TraceTimelineComponent.countSteps = (props: TraceTimelineProps): number => (props.steps ? planTimeline(props).targets.length : 0)

/** Read by TraceTimeline; renders nothing on its own. */
function MilestoneComponent(_props: MilestoneProps) {
  return null
}

const PREVIEW = `<TraceTimeline from="2026-01" to="2026-12" now="2026-10-14">
  <Milestone at="2026-01" label="Pilot" detail="2 teams" />
  <Milestone at="2026-03" label="Remote cache" detail="41% faster builds" />
  <Milestone at="2026-05" label="Flake quarantine" detail="212 tests" />
  <Milestone at="2026-07" label="10 teams" detail="self-serve onboarding" />
  <Milestone at="2026-09" label="Under 10 minutes" detail="p95 build time" />
  <Milestone at="2026-11" label="Every team" detail="planned" />
</TraceTimeline>`

export const TraceTimeline = defineComponent<TraceTimelineProps>({
  Component: TraceTimelineComponent,
  registry: {
    id: 'trace-timeline',
    name: 'TraceTimeline',
    category: 'component',
    description: 'A timeline a charge runs along to today, lighting each milestone it reaches; later milestones stay dashed as planned.',
    props: [
      { name: 'from', type: 'string', description: 'First month, "YYYY-MM"' },
      { name: 'to', type: 'string', description: 'Last month, "YYYY-MM"' },
      { name: 'now', type: 'string', description: 'Where the charge stops, "YYYY-MM-DD"; omitted means everything is done' },
      { name: 'steps', type: 'boolean', default: 'false', description: 'Each milestone up to now is a build step' },
      { name: 'accent', type: '"yellow" | "red" | "teal" | "navy" | "gray"', description: 'Defaults to the slide accent' },
      { name: 'width', type: 'number', default: '1760', description: 'Total width in px' },
    ],
    snippet: '<TraceTimeline from="2026-01" to="2026-12" now="2026-10-14">\n  <Milestone at="2026-02" label="Pilot" detail="2 teams" />\n  <Milestone at="2026-06" label="Rollout" />\n  <Milestone at="2026-11" label="Every team" detail="planned" />\n</TraceTimeline>',
    previewCode: `<Slide scheme="dark">\n${PREVIEW}\n</Slide>`,
    keywords: ['timeline', 'roadmap', 'milestones', 'progress', 'history', 'today', 'now', 'glow', 'animated', 'futuristic'],
    useCases: ['How far a rollout has come and what is still planned', 'A roadmap the presenter walks through milestone by milestone (steps)'],
  },
  toolbar: [
    { prop: 'steps', type: 'boolean' },
    { prop: 'accent', type: 'select', options: ['yellow', 'red', 'teal', 'navy', 'gray'] },
  ],
})

export const Milestone = defineComponent<MilestoneProps>({
  Component: MilestoneComponent,
  registry: {
    id: 'milestone',
    name: 'Milestone',
    category: 'component',
    parent: 'TraceTimeline',
    description: 'One milestone of a TraceTimeline, at a month or a day.',
    props: [
      { name: 'at', type: 'string', description: '"YYYY-MM" or "YYYY-MM-DD"' },
      { name: 'label', type: 'string', description: 'What happened or is planned' },
      { name: 'detail', type: 'string', description: 'A short line under the label' },
    ],
    snippet: '<Milestone at="2026-06" label="Rollout" detail="10 teams" />',
    previewCode: `<Slide scheme="dark">\n${PREVIEW}\n</Slide>`,
    keywords: ['milestone', 'date', 'event'],
  },
})
