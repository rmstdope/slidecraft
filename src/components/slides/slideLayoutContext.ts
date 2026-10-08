import { createContext, useContext } from 'react'
import type { AccentColor } from './accents'

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
