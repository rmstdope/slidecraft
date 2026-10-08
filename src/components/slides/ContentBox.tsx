import type { ReactNode } from 'react'
import { motion } from 'motion/react'
import { useStepMotion } from '../../animations/stepMotion'
import { itemVariants } from '../../animations/variants'
import { PASTEL_INK, PASTELS, type PastelColor } from './accents'
import { defineComponent } from './defineComponent'

export interface ContentBoxProps {
  children?: ReactNode
  color?: PastelColor
  /** Custom background; overrides color. */
  background?: string
  width?: number
  height?: number
  padding?: number
  radius?: number
  title?: string
  titleColor?: string
  align?: 'left' | 'center' | 'right'
  step?: number
  morph?: string
  className?: string
}

function ContentBoxComponent({ children, color = 'white', background, width = 500, height, padding = 40, radius = 8, title, titleColor = PASTEL_INK, align = 'center', step, morph, className }: ContentBoxProps) {
  const stepMotion = useStepMotion(step, morph)
  return (
    <motion.div
      className={className}
      variants={itemVariants}
      {...stepMotion}
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        boxSizing: 'border-box',
        width,
        height,
        padding,
        borderRadius: radius,
        background: background ?? (PASTELS[color] ?? PASTELS.white).bg,
        textAlign: align,
      }}
    >
      {title && <div style={{ fontFamily: 'var(--font-body)', fontSize: 20, fontWeight: 700, color: titleColor, marginBottom: 16 }}>{title}</div>}
      <div style={{ fontFamily: 'var(--font-body)', fontSize: 24, fontStyle: 'italic', color: PASTEL_INK, lineHeight: 1.5 }}>{children}</div>
    </motion.div>
  )
}

export const ContentBox = defineComponent<ContentBoxProps>({
  Component: ContentBoxComponent,
  registry: {
    id: 'content-box',
    name: 'ContentBox',
    category: 'component',
    description: 'Simple colored box for diagrams and callouts (no shadows).',
    props: [
      { name: 'color', type: '"green" | "yellow" | "teal" | "red" | "navy" | "white" | "cream"', default: '"white"', description: 'Pastel preset' },
      { name: 'width', type: 'number', default: '500', description: 'Width in px' },
      { name: 'title', type: 'string', description: 'Bold line above the content' },
      { name: 'align', type: '"left" | "center" | "right"', default: '"center"', description: 'Text alignment' },
      { name: 'step', type: 'number', description: 'Reveal on this build step' },
      { name: 'morph', type: 'string', description: 'Shared-element id' },
    ],
    snippet: '<ContentBox color="green" title="Title">Content</ContentBox>',
    previewCode: '<Slide theme="light">\n  <ContentBox color="green" title="Observation">Flat, pastel, no shadow.</ContentBox>\n</Slide>',
    keywords: ['box', 'pastel', 'diagram', 'callout', 'container'],
    useCases: ['Boxes on a light diagram slide'],
  },
  toolbar: [
    { prop: 'color', type: 'select', options: ['white', 'green', 'yellow', 'teal', 'red', 'navy', 'cream'] },
    { prop: 'align', type: 'select', options: ['center', 'left', 'right'] },
    { prop: 'width', type: 'number', min: 200, max: 1200, step: 50 },
  ],
})
