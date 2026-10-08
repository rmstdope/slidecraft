import { createContext, useContext, type ReactNode } from 'react'
import { motion } from 'motion/react'
import { useStepVisible } from '../../animations/stepContext'
import { useStepMotion } from '../../animations/stepMotion'
import { readStep } from '../../animations/steps'
import { itemVariants, staggerContainer } from '../../animations/variants'
import { defineComponent } from './defineComponent'

const ListContext = createContext({ plain: false, bulletColor: '', compact: false })

export interface ListProps {
  children?: ReactNode
  ordered?: boolean
  centered?: boolean
  /** No bullet glyph. */
  plain?: boolean
  compact?: boolean
  /** Any CSS colour; defaults to the slide accent. */
  bulletColor?: string
  indent?: number
  /** Reveal the whole list on this build step; items still stagger in. */
  step?: number
  className?: string
}

function ListComponent({ children, ordered = false, centered = false, plain = false, compact = false, bulletColor = '', indent = 0, step, className }: ListProps) {
  const beat = readStep(step)
  const revealed = useStepVisible(beat)
  const Root = ordered ? motion.ol : motion.ul
  return (
    <ListContext.Provider value={{ plain, bulletColor, compact }}>
      <Root
        className={className}
        variants={staggerContainer}
        initial="initial"
        // Gate the container's state instead of wrapping it: the layout stays put and the items
        // still stagger in when the beat lands.
        animate={beat != null && !revealed ? 'initial' : 'animate'}
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: 36,
          color: 'var(--text)',
          listStyle: 'none',
          display: 'flex',
          flexDirection: 'column',
          gap: compact ? 6 : 20,
          lineHeight: compact ? 1.2 : 1.6,
          alignItems: centered ? 'center' : 'flex-start',
          textAlign: centered ? 'center' : 'left',
          marginLeft: indent,
        }}
      >
        {children}
      </Root>
    </ListContext.Provider>
  )
}

export interface ListItemProps {
  children?: ReactNode
  /** Reveal this item on its own build step. */
  step?: number
}

function ListItemComponent({ children, step }: ListItemProps) {
  const { plain, bulletColor } = useContext(ListContext)
  const stepMotion = useStepMotion(step)
  return (
    <motion.li variants={itemVariants} {...stepMotion} style={plain ? undefined : { display: 'flex', alignItems: 'flex-start', gap: 16 }}>
      {!plain && (
        <span aria-hidden style={{ fontWeight: 700, color: bulletColor || 'var(--accent)', flexShrink: 0 }}>
          •
        </span>
      )}
      <span>{children}</span>
    </motion.li>
  )
}

export const List = defineComponent<ListProps>({
  Component: ListComponent,
  registry: {
    id: 'list',
    name: 'List',
    category: 'component',
    description: 'Animated bullet list with ListItem children.',
    props: [
      { name: 'bulletColor', type: 'string', description: 'Any CSS colour; defaults to the slide accent' },
      { name: 'compact', type: 'boolean', default: 'false', description: 'Tighter spacing' },
      { name: 'centered', type: 'boolean', default: 'false', description: 'Centre the items' },
      { name: 'plain', type: 'boolean', default: 'false', description: 'No bullet glyph' },
      { name: 'ordered', type: 'boolean', default: 'false', description: 'Render an ordered list' },
      { name: 'indent', type: 'number', default: '0', description: 'Left margin in px' },
      { name: 'step', type: 'number', description: 'Reveal the whole list on this build step' },
    ],
    snippet: '<List>\n  <ListItem>First point</ListItem>\n  <ListItem>Second point</ListItem>\n  <ListItem>Third point</ListItem>\n</List>',
    previewCode: '<Slide scheme="dark">\n  <List>\n    <ListItem>First point</ListItem>\n    <ListItem>Second point</ListItem>\n    <ListItem>Third point</ListItem>\n  </List>\n</Slide>',
    keywords: ['bullet', 'points', 'ul', 'items', 'bullets'],
    useCases: ['A few short points', 'Steps in a process'],
  },
  toolbar: [
    { prop: 'compact', type: 'boolean' },
    { prop: 'plain', type: 'boolean' },
    { prop: 'centered', type: 'boolean' },
    { prop: 'ordered', type: 'boolean' },
  ],
})

export const ListItem = defineComponent<ListItemProps>({
  Component: ListItemComponent,
  registry: {
    id: 'list-item',
    name: 'ListItem',
    category: 'component',
    description: 'Individual item within a List component.',
    props: [{ name: 'step', type: 'number', description: 'Reveal this item on its own build step' }],
    snippet: '<ListItem>Item text</ListItem>',
    previewCode: '<Slide scheme="dark">\n  <List>\n    <ListItem>Item text</ListItem>\n  </List>\n</Slide>',
    keywords: ['bullet', 'item', 'li', 'point'],
    useCases: ['One point inside a List'],
  },
})
