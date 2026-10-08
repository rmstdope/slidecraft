import { useLayoutEffect, useRef, type ReactNode } from 'react'
import { stagger as staggerDelay, useAnimate, useReducedMotionConfig } from 'motion/react'
import { springs } from '../../animations/springs'
import { useStepVisible } from '../../animations/stepContext'
import { hiddenOffsets, resolveEnter, shownOffsets, StepReveal, type StepEnter } from '../../animations/stepReveal'
import { readStep } from '../../animations/steps'
import { defineComponent } from './defineComponent'

export interface StepProps {
  children?: ReactNode
  /** The beat this content arrives on; beats start at 1. */
  at: number
  enter?: StepEnter
  /** Land direct children one by one: true = 0.08 s apart, or a number of seconds. */
  stagger?: boolean | number
  /** Lay children out in a row instead of a column. */
  row?: boolean
  gap?: number
  className?: string
}

const DEFAULT_STAGGER = 0.08

/** Children animated individually through useAnimate (Part 1 §5.4). */
function StaggeredStep({ at, enter, stagger, row, gap, className, children }: Required<Pick<StepProps, 'enter' | 'row' | 'gap'>> & StepProps) {
  const [scope, animate] = useAnimate<HTMLDivElement>()
  const visible = useStepVisible(readStep(at))
  const reduced = useReducedMotionConfig()
  const hasAnimated = useRef(false)
  const staggerStep = typeof stagger === 'number' ? stagger : DEFAULT_STAGGER

  useLayoutEffect(() => {
    const items = Array.from(scope.current?.children ?? []) as HTMLElement[]
    if (items.length === 0) return
    if (!visible) {
      // Hide synchronously so no frame shows the children before motion applies the snap.
      for (const item of items) item.style.opacity = '0'
      animate(items, { opacity: 0, ...hiddenOffsets[enter] }, { duration: 0 })
      hasAnimated.current = false
      return
    }
    if (hasAnimated.current) return
    hasAnimated.current = true
    animate(
      items,
      { opacity: 1, ...shownOffsets[enter] },
      reduced ? { duration: 0 } : { ...springs.smooth, delay: staggerDelay(staggerStep) },
    )
  }, [visible, enter, reduced, staggerStep, animate, scope])

  return (
    <div ref={scope} className={className} data-step-at={readStep(at)} style={{ display: 'flex', flexDirection: row ? 'row' : 'column', gap, width: '100%', pointerEvents: visible ? undefined : 'none' }}>
      {children}
    </div>
  )
}

function StepComponent({ at, enter = 'rise', stagger = false, row = false, gap = 32, className, children }: StepProps) {
  const resolved = resolveEnter(enter)
  if (stagger !== false && readStep(at) != null) {
    return (
      <StaggeredStep at={at} enter={resolved} stagger={stagger} row={row} gap={gap} className={className}>
        {children}
      </StaggeredStep>
    )
  }
  return (
    <StepReveal at={at} enter={resolved} className={className} style={{ display: 'flex', flexDirection: row ? 'row' : 'column', gap, width: '100%' }}>
      {children}
    </StepReveal>
  )
}

export const Step = defineComponent<StepProps>({
  Component: StepComponent,
  registry: {
    id: 'step',
    name: 'Step',
    category: 'component',
    description: 'Reveals its content on a build step, in speech order; the layout never reflows.',
    props: [
      { name: 'at', type: 'number', description: 'The beat this content arrives on (1, 2, 3…)' },
      { name: 'enter', type: '"fade" | "rise" | "fall" | "scale" | "left" | "right"', default: '"rise"', description: 'How it arrives; direction can carry meaning' },
      { name: 'stagger', type: 'boolean | number', default: 'false', description: 'Land children one by one (seconds apart when a number)' },
      { name: 'row', type: 'boolean', default: 'false', description: 'Lay children out in a row' },
      { name: 'gap', type: 'number', default: '32', description: 'Gap between children in px' },
    ],
    snippet: '<Step at={1}>\n  <Text>Arrives on the first beat</Text>\n</Step>',
    previewCode: '<Slide scheme="dark">\n  <Title>Build in speech order</Title>\n  <Step at={1}>\n    <Text>Arrives on the first beat</Text>\n  </Step>\n</Slide>',
    keywords: ['step', 'build', 'reveal', 'animation', 'beat', 'fragment', 'appear'],
    useCases: ['Reveal points in the order you say them', 'Land a row of items one by one'],
  },
  toolbar: [
    { prop: 'enter', type: 'select', options: ['rise', 'fade', 'fall', 'scale', 'left', 'right'] },
    { prop: 'row', type: 'boolean' },
    { prop: 'stagger', type: 'boolean' },
  ],
})
