import { createContext, useContext } from 'react'
import type { FrameSpec } from '@shared/themes.ts'
import { isAccent, type AccentColor } from './accents'

export type SlideLayout = 'centered' | 'document'

/** Provided by Slide (Part 2 §1.8). Multi-item components resolve `accent ?? slideAccent`. */
export interface SlideLayoutContextValue {
  layout: SlideLayout
  devMode: boolean
  accent: AccentColor
  /** The theme frame the slide uses, if any: title and subtitle styling come from it. */
  frame?: FrameSpec
  /** Horizontal alignment of the content column. */
  align: 'left' | 'center'
}

export const SlideLayoutContext = createContext<SlideLayoutContextValue>({
  layout: 'centered',
  devMode: false,
  accent: 'yellow',
  align: 'center',
})

export const useSlideLayout = (): SlideLayoutContextValue => useContext(SlideLayoutContext)

/** The accent inheritance rule: an explicit valid accent, else the slide's accent. */
export function useAccent(accent?: unknown): AccentColor {
  const { accent: slideAccent } = useContext(SlideLayoutContext)
  return isAccent(accent) ? accent : slideAccent
}
