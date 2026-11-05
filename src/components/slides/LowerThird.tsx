import { motion } from 'motion/react'
import { accentColors, type AccentColor } from './accents'
import { useLive, useStages } from './beats'
import { defineComponent } from './defineComponent'
import { useAccent } from './slideLayoutContext'

export interface LowerThirdProps {
  /** Who is speaking or quoted. */
  name: string
  /** Their role, as a tag under the name. */
  role?: string
  /** What they said, shown on the right. */
  quote?: string
  accent?: AccentColor
  /** The role and the quote each wait for a build step. */
  steps?: boolean
}

const EASE = [0.2, 0.8, 0.2, 1] as const

function stageCount({ role, quote }: Pick<LowerThirdProps, 'role' | 'quote'>): number {
  return (role ? 1 : 0) + (quote ? 1 : 0)
}

/** A name caption in the lower left of the slide, as in a filmed interview. */
function LowerThirdComponent({ name, role, quote, accent: accentProp, steps }: LowerThirdProps) {
  const accent = useAccent(accentProp)
  const live = useLive()
  const stage = useStages(stageCount({ role, quote }), steps, [0.7, 1.5])
  const roleShown = role ? stage >= 1 : false
  const quoteShown = quote ? stage >= (role ? 2 : 1) : false
  const enter = live ? undefined : false

  return (
    // Full-slide overlay: positioned against the slide, outside the content flow.
    <motion.div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1 }}>
      <div style={{ position: 'absolute', left: 130, bottom: 150, display: 'grid', gridTemplateColumns: '14px auto', columnGap: 28, alignItems: 'start' }}>
        <motion.span
          aria-hidden
          initial={enter ?? { scaleY: 0 }}
          animate={{ scaleY: 1 }}
          transition={{ duration: 0.4, ease: EASE }}
          style={{ gridRow: role ? '1 / span 2' : '1', alignSelf: 'stretch', background: accentColors[accent], transformOrigin: 'bottom' }}
        />
        <span style={{ overflow: 'hidden', display: 'block' }}>
          <motion.span
            initial={enter ?? { y: '105%' }}
            animate={{ y: '0%' }}
            transition={{ duration: 0.55, ease: EASE, delay: 0.12 }}
            style={{ display: 'block', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 86, lineHeight: 1.05, color: 'var(--text)', whiteSpace: 'nowrap' }}
          >
            {name}
          </motion.span>
        </span>
        {role && (
          <span style={{ overflow: 'hidden', display: 'block', paddingTop: 10 }}>
            <motion.span
              initial={enter ?? { y: '130%' }}
              animate={{ y: roleShown ? '0%' : '130%' }}
              transition={{ duration: 0.5, ease: EASE }}
              style={{ display: 'inline-block', fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 30, letterSpacing: '0.08em', textTransform: 'uppercase', background: 'var(--text)', color: 'var(--bg)', padding: '8px 18px' }}
            >
              {role}
            </motion.span>
          </span>
        )}
      </div>
      {quote && (
        <motion.div
          initial={enter ?? { opacity: 0, y: 20 }}
          animate={quoteShown ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.6, ease: EASE }}
          style={{ position: 'absolute', right: 130, bottom: 160, width: 760, fontFamily: 'var(--font-body)', fontSize: 44, lineHeight: 1.25, color: 'var(--text)', textAlign: 'left' }}
        >
          <span aria-hidden style={{ display: 'block', fontFamily: 'var(--font-display)', fontSize: 140, lineHeight: 0.6, color: accentColors[accent] }}>
            “
          </span>
          {quote}
        </motion.div>
      )}
    </motion.div>
  )
}

/** With `steps`, the role and the quote are build steps of the slide. */
LowerThirdComponent.countSteps = (props: LowerThirdProps): number => (props.steps ? stageCount(props) : 0)

export const LowerThird = defineComponent<LowerThirdProps>({
  Component: LowerThirdComponent,
  registry: {
    id: 'lower-third',
    name: 'LowerThird',
    category: 'component',
    description: 'A name caption in the lower left of the slide, as in a filmed interview, with a role tag and an optional quote.',
    props: [
      { name: 'name', type: 'string', description: 'Who is speaking or quoted' },
      { name: 'role', type: 'string', description: 'Their role, as a tag under the name' },
      { name: 'quote', type: 'string', description: 'What they said, shown on the right' },
      { name: 'accent', type: '"yellow" | "red" | "teal" | "navy" | "gray"', description: 'Colour of the rail and quote mark; defaults to the slide accent' },
      { name: 'steps', type: 'boolean', default: 'false', description: 'The role and the quote wait for build steps' },
    ],
    snippet: '<LowerThird name="Jordan Lee" role="Platform lead" quote="We stopped rebuilding what had not changed." />',
    previewCode: '<Slide scheme="dark" gradient="spotlight">\n  <Title>Stop rebuilding what did not change</Title>\n  <LowerThird name="Jordan Lee" role="Platform lead" />\n</Slide>',
    keywords: ['name', 'caption', 'speaker', 'interview', 'quote', 'lower third', 'video', 'youtube', 'testimonial'],
    useCases: ['Introducing who is speaking', 'A customer or colleague quote with their name and role'],
  },
  toolbar: [
    { prop: 'accent', type: 'select', options: ['yellow', 'red', 'teal', 'navy', 'gray'] },
    { prop: 'steps', type: 'boolean' },
  ],
})
