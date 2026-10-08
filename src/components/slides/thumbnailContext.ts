import { createContext, useContext } from 'react'

/** True inside a SlideThumbnail: the thumbnail owns scaling and motion is frozen. */
export const ThumbnailContext = createContext(false)

export const useInThumbnail = (): boolean => useContext(ThumbnailContext)
