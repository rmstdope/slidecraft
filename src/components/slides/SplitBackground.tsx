import type { ReactNode } from 'react'
import type { Scheme } from '@shared/themes.ts'
import { defineComponent } from './defineComponent'
import { useSlideLayout } from './slideLayoutContext'

export interface SplitBackgroundProps {
  /** Defaults to the slide background. */
  topColor?: string
  /** Defaults to the slide background tinted with the accent. */
  bottomColor?: string
  topHeight?: number
  children?: ReactNode
}

/** The lower zone of the split layouts: the slide background with a touch of the accent. */
export const accentZone = (scheme: Scheme): string => `color-mix(in srgb, var(--accent) ${scheme === 'dark' ? 12 : 10}%, var(--bg))`

/** A card or tab that stands out from the accent zone: the background itself on light slides, a lifted surface on dark. */
export const raisedSurface = (scheme: Scheme): string => (scheme === 'dark' ? 'color-mix(in srgb, var(--text) 7%, var(--bg))' : 'var(--bg)')

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
  Component: function SplitBackgroundComponent({ topColor, bottomColor: bottomProp, topHeight = 400, children }) {
    const { scheme } = useSlideLayout()
    const top = topColor ?? 'var(--bg)'
    const bottomColor = bottomProp ?? accentZone(scheme)
    return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: -1 }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: topHeight, background: top }} />
      <div style={{ position: 'absolute', top: topHeight, left: 0, right: 0, bottom: 0, background: bottomColor }} />
      <svg viewBox="0 0 1920 40" preserveAspectRatio="none" style={{ position: 'absolute', left: 0, top: topHeight - 20, width: '100%', height: 40 }} aria-hidden>
        <path d={wavePath()} fill={bottomColor} />
      </svg>
      {children}
    </div>
    )
  },
  registry: {
    id: 'split-background',
    name: 'SplitBackground',
    category: 'component',
    description: 'Two-tone full-slide background with a wavy seam; use with background="transparent" on the Slide.',
    props: [
      { name: 'topColor', type: 'string', description: 'Top band colour; defaults to the slide background' },
      { name: 'bottomColor', type: 'string', description: 'Bottom band colour; defaults to the slide background tinted with the accent' },
      { name: 'topHeight', type: 'number', default: '400', description: 'Height of the top band in px' },
    ],
    snippet: '<SplitBackground topHeight={400} />',
    previewCode: '<Slide scheme="light" background="transparent">\n  <SplitBackground />\n  <Title>Two zones</Title>\n</Slide>',
    keywords: ['background', 'split', 'two-tone', 'zones'],
    useCases: ['A header zone above a content zone'],
  },
  toolbar: [{ prop: 'topHeight', type: 'number', min: 200, max: 800, step: 50 }],
})
