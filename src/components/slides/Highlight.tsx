import type { ReactNode } from 'react'
import { defineComponent } from './defineComponent'

export interface HighlightProps {
  children?: ReactNode
  /** Any CSS colour. */
  color?: string
  bold?: boolean
}

export const Highlight = defineComponent<HighlightProps>({
  Component: ({ children, color = '#2e7d4f', bold = true }) => (
    <span style={{ color, fontWeight: bold ? 600 : 'inherit' }}>{children}</span>
  ),
  registry: {
    id: 'highlight',
    name: 'Highlight',
    category: 'component',
    description: 'Inline text highlight with custom color.',
    props: [
      { name: 'color', type: 'string', default: '"#2e7d4f"', description: 'Any CSS colour' },
      { name: 'bold', type: 'boolean', default: 'true', description: 'Semi-bold weight' },
    ],
    snippet: '<Highlight>highlighted text</Highlight>',
    previewCode: '<Slide theme="light">\n  <Text>A sentence with <Highlight>one highlighted phrase</Highlight> in it.</Text>\n</Slide>',
    keywords: ['highlight', 'inline', 'color', 'emphasis'],
    useCases: ['Emphasis on light document-style slides'],
  },
  toolbar: [{ prop: 'bold', type: 'boolean' }],
})
