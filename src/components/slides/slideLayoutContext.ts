import { createContext, useContext } from 'react'
import { isAccent, type AccentColor } from './accents'

export type SlideLayout = 'centered' | 'document'
export type SlideChrome = 'none' | 'title' | 'section' | 'content'

/** Provided by Slide (Part 2 §1.8). Multi-item components resolve `accent ?? slideAccent`. */
export interface SlideLayoutContextValue {
  layout: SlideLayout
  devMode: boolean
  chrome: SlideChrome
  accent: AccentColor
}

export const SlideLayoutContext = createContext<SlideLayoutContextValue>({
  layout: 'centered',
  devMode: false,
  chrome: 'none',
  accent: 'yellow',
})

export const useSlideLayout = (): SlideLayoutContextValue => useContext(SlideLayoutContext)

/** The accent inheritance rule: an explicit valid accent, else the slide's accent. */
export function useAccent(accent?: unknown): AccentColor {
  const { accent: slideAccent } = useContext(SlideLayoutContext)
  return isAccent(accent) ? accent : slideAccent
}
