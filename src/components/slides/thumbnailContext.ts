import { createContext, useContext } from 'react'

/** True inside a SlideThumbnail: the thumbnail owns scaling and motion is frozen. */
export const ThumbnailContext = createContext(false)

export const useInThumbnail = (): boolean => useContext(ThumbnailContext)

/**
 * A fixed stage scale for a slide rendered live outside the player (the gallery's live preview):
 * the container scales the 1920×1080 stage, so the slide must not scale to the window as well.
 */
export const StageScaleContext = createContext<number | undefined>(undefined)
