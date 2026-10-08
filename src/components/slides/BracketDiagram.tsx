import { motion } from 'motion/react'
import { itemVariants, staggerContainer } from '../../animations/variants'
import { PASTEL_INK, PASTELS } from './accents'
import { defineComponent } from './defineComponent'

type BracketColor = 'green' | 'yellow' | 'teal' | 'red' | 'navy'

export interface BracketDiagramProps {
  title: string
  titleColor?: string
  items: { content: string; color: BracketColor }[]
  lineColor?: string
  secondaryLineColor?: string
}

const BOX_W = 500
const BOX_H = 200
const SVG_H = 120

const BOX_GAP = 40

/**
 * Connector paths from under the title down to the box centres. The boxes are centred under the
 * SVG, so one box sits straight below the title and two sit at cx ± (gap + box) / 2.
 */
export function bracketPaths(count: 1 | 2): { width: number; paths: string[]; centres: number[] } {
  if (count === 1) {
    const width = 700
    return { width, paths: [`M${width / 2},0 L${width / 2},${SVG_H}`], centres: [width / 2] }
  }
  const width = 1200
  const cx = width / 2
  const offset = (BOX_GAP + BOX_W) / 2
  const left = cx - offset
  const right = cx + offset
  return {
    width,
    centres: [left, right],
    paths: [
      `M${cx - 60},0 L${cx - 60},30 Q${cx - 60},50 ${cx - 80},50 L${left + 20},50 Q${left},50 ${left},70 L${left},${SVG_H}`,
      `M${cx + 60},0 L${cx + 60},30 Q${cx + 60},50 ${cx + 80},50 L${right - 20},50 Q${right},50 ${right},70 L${right},${SVG_H}`,
    ],
  }
}

function BracketDiagramComponent({ title, titleColor = PASTEL_INK, items, lineColor, secondaryLineColor }: BracketDiagramProps) {
  const shown = items.slice(0, 2)
  const primary = lineColor ?? PASTELS[shown[0]?.color ?? 'green'].line
  const secondary = secondaryLineColor ?? PASTELS[shown[1]?.color ?? shown[0]?.color ?? 'green'].line
  const { width, paths } = bracketPaths(shown.length === 2 ? 2 : 1)
  return (
    <motion.div variants={staggerContainer} initial="initial" animate="animate" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <motion.div variants={itemVariants} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 56, color: titleColor, marginBottom: 8 }}>{title}</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {shown.length === 2 ? (
            <>
              <div style={{ width: 250, height: 4, borderRadius: 2, background: primary }} />
              <div style={{ width: 250, height: 4, borderRadius: 2, background: secondary }} />
            </>
          ) : (
            <div style={{ width: 300, height: 4, borderRadius: 2, background: primary }} />
          )}
        </div>
      </motion.div>
      <svg width={width} height={SVG_H} aria-hidden>
        {paths.map((d, i) => (
          <path key={i} d={d} fill="none" stroke={i === 0 ? primary : secondary} strokeWidth={2} strokeDasharray="6,6" />
        ))}
      </svg>
      <motion.div variants={itemVariants} style={{ display: 'flex', gap: BOX_GAP, justifyContent: 'center' }}>
        {shown.map((item, i) => (
          <div key={i} style={{ width: BOX_W, height: BOX_H, padding: 40, borderRadius: 8, background: PASTELS[item.color]?.bg ?? PASTELS.green.bg, fontFamily: 'var(--font-body)', fontSize: 24, fontStyle: 'italic', color: PASTEL_INK, textAlign: 'center', lineHeight: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {item.content}
          </div>
        ))}
      </motion.div>
    </motion.div>
  )
}

export const BracketDiagram = defineComponent<BracketDiagramProps>({
  Component: BracketDiagramComponent,
  registry: {
    id: 'bracket-diagram',
    name: 'BracketDiagram',
    category: 'component',
    description: 'Title with bracket connectors to content boxes below.',
    props: [
      { name: 'title', type: 'string', description: 'Heading the brackets hang from' },
      { name: 'titleColor', type: 'string', description: 'Any CSS colour' },
      { name: 'items', type: 'Array<{ content: string; color: "green" | "yellow" | "teal" | "red" | "navy" }>', description: 'One or two boxes' },
    ],
    snippet: '<BracketDiagram\n  title="Two kinds"\n  items={[\n    { content: "The first kind", color: "green" },\n    { content: "The second kind", color: "navy" },\n  ]}\n/>',
    previewCode: '<Slide theme="light">\n  <BracketDiagram title="Two kinds" items={[{ content: "The first kind", color: "green" }, { content: "The second kind", color: "navy" }]} />\n</Slide>',
    keywords: ['bracket', 'diagram', 'connector', 'tree', 'hierarchy'],
    useCases: ['A concept splitting into two kinds'],
  },
})
