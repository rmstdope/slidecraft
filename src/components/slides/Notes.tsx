import type { ReactNode } from 'react'
import { defineComponent } from './defineComponent'

export interface NotesProps {
  children?: ReactNode
}

/** Speaker notes. Renders nothing; the presentation extracts the children by display name. */
export const Notes = defineComponent<NotesProps>({
  Component: () => null,
  registry: {
    id: 'notes',
    name: 'Notes',
    category: 'component',
    description: 'Speaker notes for the presenter view and the reader handout; not shown on the slide.',
    props: [],
    snippet: '<Notes>0:00-0:40. What to say on this slide.</Notes>',
    previewCode: '<Slide theme="dark">\n  <Title>Slide with notes</Title>\n  <Notes>Only the presenter sees this.</Notes>\n</Slide>',
    keywords: ['notes', 'speaker', 'presenter', 'script'],
    useCases: ['What to say on the slide', 'Time budget and sources'],
  },
})
