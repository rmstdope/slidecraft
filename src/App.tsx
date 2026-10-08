import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType } from 'react'
import { MDXProvider } from '@mdx-js/react'
import type { MDXComponents } from 'mdx/types'
import { BUILT_IN_SOURCE_ID, deckName, type DeckRef } from '@shared/decks.ts'
import { routePath } from './basePath'
import { mdxComponentScope } from './components/mdxScope'
import { assetResolverFor, DeckContext } from './components/slides/deckContext'
import { DeckNotFoundError, deckModuleLoader } from './deckLoading'
import {
  chatUrl,
  editorUrl,
  galleryUrl,
  homeUrl,
  isSameDeckView,
  parseRoute,
  presentationUrl,
  resolveRouteDeck,
  type Route,
  type ViewState,
} from './router'
import { HomeStub } from './views/HomeStub'
import { Placeholder } from './views/Placeholder'

/** Until the content API exists (Phase 5), every deck resolves against the built-in source. */
const DEFAULT_SOURCE = BUILT_IN_SOURCE_ID

const currentRoute = (): Route => parseRoute(routePath(), window.location.search)

export function App() {
  const [view, setView] = useState<ViewState>({ type: 'loading' })
  const viewRef = useRef(view)
  useEffect(() => {
    viewRef.current = view
  }, [view])

  const show = useCallback(async (route: Route) => {
    const search = window.location.search
    switch (route.type) {
      case 'home':
        return setView({ type: 'home' })
      case 'gallery':
        return setView({ type: 'gallery' })
      case 'chat':
        return setView({ type: 'chat', deck: route.name ? resolveRouteDeck(route.name, search, DEFAULT_SOURCE) : undefined })
      case 'editor':
        return setView({ type: 'editor', deck: resolveRouteDeck(route.name, search, DEFAULT_SOURCE) })
      case 'presentation': {
        const deck = resolveRouteDeck(route.name, search, DEFAULT_SOURCE)
        setView({ type: 'loading' })
        try {
          const { default: content } = await deckModuleLoader(deck)()
          setView(route.presenter ? { type: 'presenter', deck, content } : { type: 'presentation', deck, content })
        } catch (error) {
          if (error instanceof DeckNotFoundError) {
            window.history.replaceState(null, '', homeUrl())
            return setView({ type: 'home' })
          }
          setView({ type: 'presentation-error', deck, error: error instanceof Error ? error.message : String(error) })
        }
      }
    }
  }, [])

  useEffect(() => {
    void show(currentRoute())
    const onPopState = () => {
      const route = currentRoute()
      const deck = route.type === 'presentation' ? resolveRouteDeck(route.name, window.location.search, DEFAULT_SOURCE) : undefined
      if (isSameDeckView(viewRef.current, route, deck)) return
      void show(route)
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [show])

  const go = useCallback(
    (url: string) => {
      window.history.pushState(null, '', url)
      void show(currentRoute())
    },
    [show],
  )
  const goHome = useCallback(() => go(homeUrl()), [go])
  const deckFromName = (name: string): DeckRef => ({ source: DEFAULT_SOURCE, path: name })

  switch (view.type) {
    case 'loading':
      return <div className="spinner" role="status" aria-label="Loading" />
    case 'home':
      return (
        <HomeStub
          onPresent={(name) => go(presentationUrl(deckFromName(name)))}
          onGallery={() => go(galleryUrl())}
          onChat={() => go(chatUrl())}
        />
      )
    case 'gallery':
      return <Placeholder title="Component gallery" onHome={goHome}>Arrives in Phase 7.</Placeholder>
    case 'chat':
      return (
        <Placeholder title={view.deck ? `Chat: ${deckName(view.deck)}` : 'Chat'} onHome={goHome}>
          Arrives in Phase 10.
        </Placeholder>
      )
    case 'editor':
      return (
        <Placeholder title={`Edit: ${deckName(view.deck)}`} onHome={goHome}>
          Arrives in Phase 6. <a href={editorUrl(view.deck)}>Permalink</a>
        </Placeholder>
      )
    case 'presentation-error':
      return (
        <Placeholder title="Presentation error" onHome={goHome}>
          <pre className="error-text">{view.error}</pre>
        </Placeholder>
      )
    case 'presentation':
    case 'presenter':
      return <DeckView deck={view.deck} content={view.content} />
  }
}

const scope = mdxComponentScope as MDXComponents

/** A compiled deck with its component scope and asset resolver. */
function DeckView({ deck, content: Content }: { deck: DeckRef; content: ComponentType }) {
  const deckContext = useMemo(() => ({ deck, resolveAsset: assetResolverFor(deck, DEFAULT_SOURCE) }), [deck])
  return (
    <DeckContext.Provider value={deckContext}>
      <MDXProvider components={scope}>
        <Content />
      </MDXProvider>
    </DeckContext.Provider>
  )
}
