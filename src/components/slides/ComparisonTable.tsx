import { motion } from 'motion/react'
import { itemVariants, staggerContainer } from '../../animations/variants'
import { accentColors, tint, type AccentColor } from './accents'
import { defineComponent } from './defineComponent'
import { useAccent } from './slideLayoutContext'

type Row = string[] | { cells: string[]; highlight?: boolean }
type Align = 'left' | 'center' | 'right'

export interface ComparisonTableProps {
  headers: string[]
  rows: Row[]
  align?: Align[]
  accent?: AccentColor
  caption?: string
  width?: number
  className?: string
}

export const normaliseRow = (row: Row): { cells: string[]; highlight?: boolean } => (Array.isArray(row) ? { cells: row } : row)

function ComparisonTableComponent({ headers, rows, align, accent: accentProp, caption, width = 1600, className }: ComparisonTableProps) {
  const accent = useAccent(accentProp)
  const color = accentColors[accent]
  const alignOf = (i: number): Align => align?.[i] ?? (i === 0 ? 'left' : 'center')
  return (
    <motion.div className={className} variants={staggerContainer} style={{ width, textAlign: 'left' }}>
      {caption && <motion.div variants={itemVariants} style={{ fontFamily: 'var(--font-body)', fontSize: 24, fontStyle: 'italic', color: 'var(--muted)', marginBottom: 16 }}>{caption}</motion.div>}
      <motion.table variants={itemVariants} style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontFamily: 'var(--font-body)' }}>
        <thead>
          <tr>
            {headers.map((header, i) => (
              <th key={i} style={{ fontSize: 24, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', color, padding: '0 24px 16px', borderBottom: `2px solid ${color}`, textAlign: alignOf(i) }}>
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(normaliseRow).map((row, r) => (
            <tr key={r}>
              {row.cells.map((cell, i) => {
                const first = i === 0
                const last = i === row.cells.length - 1
                return (
                  <td
                    key={i}
                    style={{
                      fontSize: 28,
                      lineHeight: 1.4,
                      padding: '20px 24px',
                      textAlign: alignOf(i),
                      borderBottom: `1px solid ${tint('gray', 0.25)}`,
                      color: row.highlight ? 'var(--text)' : 'var(--muted)',
                      fontWeight: row.highlight ? 600 : 400,
                      background: row.highlight ? tint(accent, 0.12) : undefined,
                      borderTopLeftRadius: row.highlight && first ? 10 : undefined,
                      borderBottomLeftRadius: row.highlight && first ? 10 : undefined,
                      borderTopRightRadius: row.highlight && last ? 10 : undefined,
                      borderBottomRightRadius: row.highlight && last ? 10 : undefined,
                    }}
                  >
                    {cell}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </motion.table>
    </motion.div>
  )
}

export const ComparisonTable = defineComponent<ComparisonTableProps>({
  Component: ComparisonTableComponent,
  registry: {
    id: 'comparison-table',
    name: 'ComparisonTable',
    category: 'component',
    description: 'Options against criteria, with an optional highlighted (recommended) row.',
    props: [
      { name: 'headers', type: 'string[]', description: 'Column headers' },
      { name: 'rows', type: 'Array<string[] | { cells: string[]; highlight?: boolean }>', description: 'Rows; highlight marks the recommended one' },
      { name: 'align', type: 'Array<"left" | "center" | "right">', description: 'Per-column alignment' },
      { name: 'accent', type: '"yellow" | "red" | "teal" | "navy" | "gray"', description: 'Defaults to the slide accent' },
      { name: 'caption', type: 'string', description: 'Italic line above the table' },
      { name: 'width', type: 'number', default: '1600', description: 'Width in px' },
    ],
    snippet:
      '<ComparisonTable\n  headers={["Option", "Cost", "Speed"]}\n  rows={[\n    ["A", "Low", "Slow"],\n    { cells: ["B", "Medium", "Fast"], highlight: true },\n  ]}\n/>',
    previewCode: '<Slide theme="dark">\n  <ComparisonTable headers={["Option", "Cost", "Speed"]} rows={[["A", "Low", "Slow"], { cells: ["B", "Medium", "Fast"], highlight: true }]} />\n</Slide>',
    keywords: ['table', 'comparison', 'matrix', 'options', 'criteria', 'grid'],
    useCases: ['Feature grid with a recommendation'],
  },
  toolbar: [{ prop: 'accent', type: 'select', options: ['yellow', 'red', 'teal', 'navy', 'gray'] }],
})
