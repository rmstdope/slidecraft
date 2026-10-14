import type { ReactNode } from 'react'
import { colorValue } from './accents'
import { defineComponent } from './defineComponent'

export interface HighlightProps {
  children?: ReactNode
  /** An accent role or any CSS colour; defaults to the slide accent. */
  color?: string
  bold?: boolean
}

export const Highlight = defineComponent<HighlightProps>({
  Component: ({ children, color, bold = true }) => (
    <span style={{ color: color ? colorValue(color) : 'var(--accent)', fontWeight: bold ? 600 : 'inherit' }}>{children}</span>
  ),
  registry: {
    id: 'highlight',
    name: 'Highlight',
    category: 'component',
    description: 'Inline text highlight in the slide accent or a chosen colour.',
    props: [
      { name: 'color', type: 'string', description: 'An accent role ("teal", "red"…) or any CSS colour; defaults to the slide accent' },
      { name: 'bold', type: 'boolean', default: 'true', description: 'Semi-bold weight' },
    ],
    snippet: '<Highlight>highlighted text</Highlight>',
    previewCode: '<Slide scheme="light">\n  <Text>A sentence with <Highlight>one highlighted phrase</Highlight> in it.</Text>\n</Slide>',
    keywords: ['highlight', 'inline', 'color', 'emphasis'],
    useCases: ['Emphasis on light document-style slides'],
  },
  toolbar: [{ prop: 'bold', type: 'boolean' }],
})
