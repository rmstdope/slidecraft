import type { ReactNode } from 'react'
import { useStepVisible } from '../../animations/stepContext'
import { readStep } from '../../animations/steps'
import { colorValue } from './accents'
import { defineComponent } from './defineComponent'

export interface HighlightProps {
  children?: ReactNode
  /** An accent role or any CSS colour; defaults to the slide accent. */
  color?: string
  bold?: boolean
  /** The beat the highlight switches on; before it the text is plain. */
  step?: number
}

function HighlightComponent({ children, color, bold = true, step }: HighlightProps) {
  const on = useStepVisible(readStep(step))
  return (
    <span style={{ color: on ? (color ? colorValue(color) : 'var(--accent)') : 'inherit', fontWeight: on && bold ? 600 : 'inherit', transition: 'color 0.4s ease' }}>
      {children}
    </span>
  )
}

export const Highlight = defineComponent<HighlightProps>({
  Component: HighlightComponent,
  registry: {
    id: 'highlight',
    name: 'Highlight',
    category: 'component',
    description: 'Inline text highlight in the slide accent or a chosen colour.',
    props: [
      { name: 'color', type: 'string', description: 'An accent role ("teal", "red"…) or any CSS colour; defaults to the slide accent' },
      { name: 'bold', type: 'boolean', default: 'true', description: 'Semi-bold weight' },
      { name: 'step', type: 'number', description: 'Build step on which the highlight switches on' },
    ],
    snippet: '<Highlight>highlighted text</Highlight>',
    previewCode: '<Slide scheme="light">\n  <Text>A sentence with <Highlight>one highlighted phrase</Highlight> in it.</Text>\n</Slide>',
    keywords: ['highlight', 'inline', 'color', 'emphasis'],
    useCases: ['Emphasis on light document-style slides'],
  },
  toolbar: [{ prop: 'bold', type: 'boolean' }],
})
