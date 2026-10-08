import { defineComponent } from './defineComponent'

export interface DividerProps {
  orientation?: 'vertical' | 'horizontal'
  variant?: 'solid' | 'dotted' | 'dashed'
  /** Any CSS colour. */
  color?: string
  length?: number
  thickness?: number
  spacing?: number
}

function DividerComponent({ orientation = 'vertical', variant = 'dotted', color = '#8a8f98', length = 400, thickness = 2, spacing = 8 }: DividerProps) {
  const vertical = orientation === 'vertical'
  const width = vertical ? thickness : length
  const height = vertical ? length : thickness
  if (variant === 'solid') return <div aria-hidden style={{ width, height, background: color, flexShrink: 0 }} />
  const dash = variant === 'dotted' ? `${thickness},${spacing}` : `${spacing * 2},${spacing}`
  return (
    <svg aria-hidden width={width} height={height} style={{ flexShrink: 0, overflow: 'visible' }}>
      <line
        x1={vertical ? thickness / 2 : 0}
        y1={vertical ? 0 : thickness / 2}
        x2={vertical ? thickness / 2 : length}
        y2={vertical ? length : thickness / 2}
        stroke={color}
        strokeWidth={thickness}
        strokeLinecap="round"
        strokeDasharray={dash}
      />
    </svg>
  )
}

export const Divider = defineComponent<DividerProps>({
  Component: DividerComponent,
  registry: {
    id: 'divider',
    name: 'Divider',
    category: 'component',
    description: 'A solid, dotted or dashed separator line.',
    props: [
      { name: 'orientation', type: '"vertical" | "horizontal"', default: '"vertical"', description: 'Direction of the line' },
      { name: 'variant', type: '"solid" | "dotted" | "dashed"', default: '"dotted"', description: 'Line style' },
      { name: 'color', type: 'string', default: '"#8a8f98"', description: 'Any CSS colour' },
      { name: 'length', type: 'number', default: '400', description: 'Length in px' },
      { name: 'thickness', type: 'number', default: '2', description: 'Thickness in px' },
      { name: 'spacing', type: 'number', default: '8', description: 'Gap between dots or dashes in px' },
    ],
    snippet: '<Divider orientation="horizontal" length={800} />',
    previewCode: '<Slide theme="dark">\n  <Divider orientation="horizontal" length={800} />\n</Slide>',
    keywords: ['line', 'separator', 'dotted', 'vertical', 'horizontal'],
    useCases: ['Separate two groups', 'A quiet rule between sections'],
  },
  toolbar: [
    { prop: 'orientation', type: 'select', options: ['vertical', 'horizontal'] },
    { prop: 'variant', type: 'select', options: ['solid', 'dotted', 'dashed'] },
    { prop: 'length', type: 'number', min: 50, max: 800, step: 50 },
  ],
})
