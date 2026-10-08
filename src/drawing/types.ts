/** Annotations live in slide design coordinates (1920×1080), so they scale with the slide. */
export interface Point {
  x: number
  y: number
}

interface Base {
  id: string
  color: string
  strokeWidth: number
  opacity: number
}

/** One union for what is drawn, stored and synced (Part 5 §C.2, with the type mismatch resolved). */
export type Annotation =
  | (Base & { type: 'path'; points: Point[] })
  | (Base & { type: 'arrow' | 'rectangle'; start: Point; end: Point })
  | (Base & { type: 'text'; start: Point; text: string })

export type DrawingTool = 'pen' | 'highlighter' | 'arrow' | 'rectangle' | 'text' | 'eraser' | 'laser'

/** Toolbar order; keys 1–7 pick them in this order. */
export const TOOLS: { tool: DrawingTool; label: string }[] = [
  { tool: 'pen', label: 'Pen' },
  { tool: 'highlighter', label: 'Highlighter' },
  { tool: 'arrow', label: 'Arrow' },
  { tool: 'rectangle', label: 'Rectangle' },
  { tool: 'text', label: 'Text' },
  { tool: 'eraser', label: 'Eraser' },
  { tool: 'laser', label: 'Laser Pointer' },
]

export const DESIGN_WIDTH = 1920
export const DESIGN_HEIGHT = 1080
