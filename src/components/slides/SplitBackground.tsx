import type { ReactNode } from 'react'
import { defineComponent } from './defineComponent'

export interface SplitBackgroundProps {
  topColor?: string
  bottomColor?: string
  topHeight?: number
  children?: ReactNode
}

/** A gentle wave across 1920 px: quadratic bumps of 240 px period between y=0 and y=40. */
export function wavePath(width = 1920, period = 240, height = 40): string {
  const mid = height / 2
  let d = `M0,${mid}`
  for (let x = 0, up = true; x < width; x += period / 2, up = !up) {
    d += ` Q${x + period / 4},${up ? 0 : height} ${x + period / 2},${mid}`
  }
  return `${d} L${width},${height} L0,${height} Z`
}

export const SplitBackground = defineComponent<SplitBackgroundProps>({
  Component: ({ topColor = '#ffffff', bottomColor = '#faf6ee', topHeight = 400, children }) => (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: topHeight, background: topColor }} />
      <div style={{ position: 'absolute', top: topHeight, left: 0, right: 0, bottom: 0, background: bottomColor }} />
      <svg viewBox="0 0 1920 40" preserveAspectRatio="none" style={{ position: 'absolute', left: 0, top: topHeight - 20, width: '100%', height: 40 }} aria-hidden>
        <path d={wavePath()} fill={bottomColor} />
      </svg>
      {children}
    </div>
  ),
  registry: {
    id: 'split-background',
    name: 'SplitBackground',
    category: 'component',
    description: 'Two-tone full-slide background with a wavy seam; use with background="transparent" on the Slide.',
    props: [
      { name: 'topColor', type: 'string', default: '"#ffffff"', description: 'Top band colour' },
      { name: 'bottomColor', type: 'string', default: '"#faf6ee"', description: 'Bottom band colour' },
      { name: 'topHeight', type: 'number', default: '400', description: 'Height of the top band in px' },
    ],
    snippet: '<SplitBackground topHeight={400} />',
    previewCode: '<Slide scheme="light" background="transparent">\n  <SplitBackground />\n  <Title>Two zones</Title>\n</Slide>',
    keywords: ['background', 'split', 'two-tone', 'zones'],
    useCases: ['A header zone above a content zone'],
  },
  toolbar: [{ prop: 'topHeight', type: 'number', min: 200, max: 800, step: 50 }],
})
