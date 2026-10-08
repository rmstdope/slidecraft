import { createContext, useContext } from 'react'
import { contentAssetUrl, sourceContentAssetUrl } from '@shared/mdxImports.ts'
import { BUILT_IN_SOURCE_ID, type DeckRef } from '@shared/decks.ts'
import { appPath } from '../../basePath'

/**
 * Which deck is rendering and how its relative asset paths become URLs. Components never
 * build /content/ URLs themselves; the single-file exporter swaps the resolver for data URLs.
 */
export interface DeckContextValue {
  deck?: DeckRef
  resolveAsset: (src: string) => string
}

const isAbsolute = (src: string) => /^(data:|blob:|https?:|\/\/)/i.test(src)

export function assetResolverFor(deck?: DeckRef, defaultSource = BUILT_IN_SOURCE_ID): (src: string) => string {
  return (src) => {
    if (!src || isAbsolute(src)) return src
    if (src.startsWith('/')) return appPath(src)
    if (!deck) return src
    const url = deck.source === defaultSource ? contentAssetUrl(deck.path, src) : sourceContentAssetUrl(deck.source, deck.path, src)
    return appPath(url)
  }
}

export const DeckContext = createContext<DeckContextValue>({ resolveAsset: assetResolverFor() })

export const useDeck = (): DeckContextValue => useContext(DeckContext)
export const useAsset = (src: string | undefined): string | undefined => {
  const { resolveAsset } = useDeck()
  return src === undefined ? undefined : resolveAsset(src)
}
