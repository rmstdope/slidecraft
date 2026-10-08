import { Fragment } from 'react'
import { motion } from 'motion/react'
import { itemVariants, staggerContainer } from '../../animations/variants'
import { accentColors, isAccent, tint, type AccentColor } from './accents'
import { defineComponent } from './defineComponent'
import { drawProps } from './draw'
import { useAccent } from './slideLayoutContext'
import { captionStyle } from './styles'

export interface StackDiagramProps {
  layers: { title: string; sub?: string; items?: string[]; accent?: AccentColor }[]
  arrows?: 'solid' | 'dashed' | 'none'
  caption?: string
  width?: number
  className?: string
}

function StackDiagramComponent({ layers, arrows = 'solid', caption, width = 1500, className }: StackDiagramProps) {
  const slideAccent = useAccent()
  const dashed = arrows === 'dashed'
  return (
    <motion.div className={className} variants={staggerContainer} style={{ width, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      {layers.map((layer, i) => {
        const accent = isAccent(layer.accent) ? layer.accent : slideAccent
        return (
          <Fragment key={i}>
            {i > 0 && arrows !== 'none' && (
              <motion.svg variants={itemVariants} width={28} height={34} aria-hidden style={{ margin: '6px 0' }}>
                <motion.line x1={14} y1={0} x2={14} y2={22} stroke="var(--muted)" strokeWidth={3} strokeDasharray={dashed ? '6 6' : undefined} {...drawProps(i - 1, dashed)} />
                <polygon points="14,34 5,20 23,20" fill="var(--muted)" />
              </motion.svg>
            )}
            <motion.div
              variants={itemVariants}
              style={{ width: '100%', background: tint(accent, 0.14), border: `1px solid ${tint(accent, 0.45)}`, borderLeft: `8px solid ${accentColors[accent]}`, borderRadius: 12, padding: '22px 30px', textAlign: 'left', fontFamily: 'var(--font-body)' }}
            >
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 20 }}>
                <span style={{ fontSize: 34, fontWeight: 700, color: 'var(--text)' }}>{layer.title}</span>
                {layer.sub && <span style={{ fontSize: 24, color: 'var(--muted)' }}>{layer.sub}</span>}
              </div>
              {layer.items && layer.items.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 16 }}>
                  {layer.items.map((item, j) => (
                    <span key={j} style={{ fontSize: 23, padding: '8px 16px', borderRadius: 8, background: tint('gray', 0.14), border: `1px solid ${tint(accent, 0.35)}`, color: 'var(--text)' }}>
                      {item}
                    </span>
                  ))}
                </div>
              )}
            </motion.div>
          </Fragment>
        )
      })}
      {caption && <div style={captionStyle}>{caption}</div>}
    </motion.div>
  )
}

export const StackDiagram = defineComponent<StackDiagramProps>({
  Component: StackDiagramComponent,
  registry: {
    id: 'stack-diagram',
    name: 'StackDiagram',
    category: 'component',
    description: 'Layered architecture: horizontal bands stacked top to bottom.',
    props: [
      { name: 'layers', type: 'Array<{ title: string; sub?: string; items?: string[]; accent?: string }>', description: 'Bands from top to bottom' },
      { name: 'arrows', type: '"solid" | "dashed" | "none"', default: '"solid"', description: 'Connectors between bands' },
      { name: 'caption', type: 'string', description: 'Italic caption below' },
      { name: 'width', type: 'number', default: '1500', description: 'Width in px' },
    ],
    snippet: '<StackDiagram\n  layers={[\n    { title: "Interface", items: ["Web", "CLI"] },\n    { title: "Services", items: ["Auth", "Billing"] },\n    { title: "Storage", items: ["Postgres"] },\n  ]}\n/>',
    previewCode: '<Slide scheme="dark">\n  <StackDiagram width={1200} layers={[{ title: "Interface", items: ["Web", "CLI"] }, { title: "Services", items: ["Auth", "Billing"] }, { title: "Storage", items: ["Postgres"] }]} />\n</Slide>',
    keywords: ['stack', 'layers', 'layered', 'architecture', 'tiers', 'platform', 'diagram'],
    useCases: ['A layered architecture', 'What sits on what'],
  },
  toolbar: [{ prop: 'arrows', type: 'select', options: ['solid', 'dashed', 'none'] }],
})
