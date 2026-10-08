/**
 * In-browser compilation of single slides for previews and the rail (Part 3 §4.1). A slide is
 * compiled together with the deck's import block, so imported images resolve as in the deck.
 */
import { useEffect, useState, type ComponentType } from 'react'
import * as jsxRuntime from 'react/jsx-runtime'
import { compile, run } from '@mdx-js/mdx'
import { BUILT_IN_SOURCE_ID, deckName, type DeckRef } from '@shared/decks.ts'
import { contentAssetUrl, rewriteDeckImports, sourceContentAssetUrl } from '@shared/mdxImports.ts'
import { appPath } from '../basePath'
import { mdxComponentScope } from '../components/mdxScope'

export interface CompileTarget {
  deck?: DeckRef
  defaultSource?: string
  imports?: string
}

const cache = new Map<string, Promise<ComponentType>>()
const MAX_CACHE = 300

export function compileSlidePreview(slide: string, target: CompileTarget = {}): Promise<ComponentType> {
  const key = `${target.deck?.source}:${target.deck?.path}\n${target.imports ?? ''}\n${slide}`
  const cached = cache.get(key)
  if (cached) return cached
  const promise = (async () => {
    const deck = target.deck
    const compiled = await compile(`${target.imports ?? ''}\n\n${slide}`, {
      outputFormat: 'function-body',
      development: false,
      remarkPlugins: [
        [
          rewriteDeckImports,
          {
            deckName: deck ? deckName(deck) : 'preview',
            knownComponents: Object.keys(mdxComponentScope),
            unsupported: 'keep',
            resolveAsset: (_n: string, asset: string) =>
              deck ? appPath(deck.source === (target.defaultSource ?? BUILT_IN_SOURCE_ID) ? contentAssetUrl(deck.path, asset) : sourceContentAssetUrl(deck.source, deck.path, asset)) : asset,
          },
        ],
      ],
    })
    const { default: Raw } = await run(compiled, { ...(jsxRuntime as Parameters<typeof run>[1]), baseUrl: import.meta.url })
    const Component = () => <Raw components={mdxComponentScope} {...mdxComponentScope} />
    return Component
  })()
  cache.set(key, promise)
  promise.catch(() => cache.delete(key))
  if (cache.size > MAX_CACHE) cache.delete(cache.keys().next().value!)
  return promise
}

export interface CompileState {
  Component: ComponentType | null
  error: string | null
  isCompiling: boolean
}

/** Compile `content` 300 ms after it stops changing; stale results are dropped. */
export function useMdxCompiler(content: string | null, target: CompileTarget, delay = 300): CompileState {
  const [state, setState] = useState<CompileState>({ Component: null, error: null, isCompiling: content !== null })
  const targetKey = `${target.deck?.source}:${target.deck?.path}:${target.imports}`
  useEffect(() => {
    if (content === null) return
    let cancelled = false
    setState((s) => ({ ...s, isCompiling: true }))
    const timer = setTimeout(() => {
      compileSlidePreview(content, target)
        .then((Component) => !cancelled && setState({ Component, error: null, isCompiling: false }))
        .catch((error: Error) => !cancelled && setState((s) => ({ Component: s.Component, error: error.message, isCompiling: false })))
    }, delay)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [content, targetKey, delay])
  return state
}
