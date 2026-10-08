import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type ComponentType } from 'react'
import { MDXProvider } from '@mdx-js/react'
import type { MDXComponents } from 'mdx/types'
import { BUILT_IN_SOURCE_ID, deckName, sameDeck, type ContentSourceInfo, type DeckRef, type PresentationInfo } from '@shared/decks.ts'
import { fetchContents, fetchPresentations } from './api'
import { IS_STATIC, routePath } from './basePath'
import { ErrorBoundary, PresentationErrorUI } from './components/ErrorBoundary'
import { mdxComponentScope } from './components/mdxScope'
import { assetResolverFor, DeckContext } from './components/slides/deckContext'
import { bundledDeckNames, DeckNotFoundError, deckModuleLoader } from './deckLoading'
import { subscribeServerEvents, useSSE } from './hooks/useSSE'
import { HomePage } from './home/HomePage'
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
import { startContentThemes } from './themes/contentThemes'
import { Placeholder } from './views/Placeholder'

/** Monaco is large: the editor loads only when someone opens it. */
const EditorPage = lazy(() => import('./editor/EditorPage'))
/** The gallery compiles previews in the browser, so it also loads on demand. */
const GalleryPage = lazy(() => import('./gallery/GalleryPage'))

const currentRoute = (): Route => parseRoute(routePath(), window.location.search)

const bundledInfo = (): PresentationInfo[] =>
  bundledDeckNames().map((name) => ({ source: BUILT_IN_SOURCE_ID, path: name, name, createdAt: 0, updatedAt: 0, readOnly: true, builtIn: true }))

interface ContentContext {
  defaultSource: string
  builtInSource: string
  sources: ContentSourceInfo[]
  /** The current content folder is read-only: no "Create New". */
  readOnly: boolean
}

const OFFLINE_CONTENT: ContentContext = { defaultSource: BUILT_IN_SOURCE_ID, builtInSource: BUILT_IN_SOURCE_ID, sources: [], readOnly: true }

export function App() {
  const [view, setView] = useState<ViewState>({ type: 'loading' })
  const [content, setContent] = useState<ContentContext | null>(IS_STATIC ? OFFLINE_CONTENT : null)
  const [decks, setDecks] = useState<PresentationInfo[]>(bundledInfo)
  const [loadError, setLoadError] = useState<string>()
  const viewRef = useRef(view)
  useEffect(() => {
    viewRef.current = view
  }, [view])

  // Content sources, themes and the deck list come from the server (not in static builds).
  useEffect(() => {
    if (IS_STATIC) return
    void (async () => {
      const [contents] = await Promise.all([fetchContents(), startContentThemes()])
      if (!contents.data) {
        setLoadError(`Could not reach the Slidecraft server (${contents.error}).`)
        setContent(OFFLINE_CONTENT)
        return
      }
      const builtIn = contents.data.sources.find((s) => s.builtIn)?.id ?? BUILT_IN_SOURCE_ID
      setContent({ defaultSource: contents.data.current.id, builtInSource: builtIn, sources: contents.data.sources, readOnly: contents.data.current.readOnly })
      const list = await fetchPresentations()
      if (list.data) setDecks(list.data)
    })()
  }, [])

  // New or changed decks (from any editor or agent) refresh the home list.
  useEffect(() => {
    if (IS_STATIC) return
    let timer: ReturnType<typeof setTimeout> | undefined
    const unsubscribe = subscribeServerEvents((message) => {
      if (message.type !== 'presentation-created' && message.type !== 'presentation-updated') return
      clearTimeout(timer)
      timer = setTimeout(() => void fetchPresentations().then((list) => list.data && setDecks(list.data)), 300)
    })
    return () => {
      clearTimeout(timer)
      unsubscribe()
    }
  }, [])

  const loadContent = useCallback(
    async (deck: DeckRef, runtime = false): Promise<ComponentType> => {
      const loader = deckModuleLoader(deck, { builtInSourceId: content?.builtInSource, defaultSource: content?.defaultSource, runtime })
      return (await loader()).default
    },
    [content],
  )

  const show = useCallback(
    async (route: Route) => {
      if (!content) return
      const search = window.location.search
      const resolve = (name: string) => resolveRouteDeck(name, search, content.defaultSource)
      switch (route.type) {
        case 'home':
          return setView({ type: 'home' })
        case 'gallery':
          return setView({ type: 'gallery' })
        case 'chat':
          return setView({ type: 'chat', deck: route.name ? resolve(route.name) : undefined })
        case 'editor':
          return setView({ type: 'editor', deck: resolve(route.name) })
        case 'presentation': {
          const deck = resolve(route.name)
          setView({ type: 'loading' })
          try {
            const loaded = await loadContent(deck)
            setView(route.presenter ? { type: 'presenter', deck, content: loaded } : { type: 'presentation', deck, content: loaded })
          } catch (error) {
            if (error instanceof DeckNotFoundError) {
              window.history.replaceState(null, '', homeUrl())
              return setView({ type: 'home' })
            }
            setView({ type: 'presentation-error', deck, error: error instanceof Error ? error.message : String(error) })
          }
        }
      }
    },
    [content, loadContent],
  )

  useEffect(() => {
    if (!content) return
    void show(currentRoute())
    const onPopState = () => {
      const route = currentRoute()
      const deck = route.type === 'presentation' ? resolveRouteDeck(route.name, window.location.search, content.defaultSource) : undefined
      if (isSameDeckView(viewRef.current, route, deck)) return
      void show(route)
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [content, show])

  // Live reload: the deck's file changed on disk; recompile and swap it in, keeping the position.
  const shownDeck = view.type === 'presentation' || view.type === 'presenter' ? view.deck : undefined
  useSSE(shownDeck, () => {
    if (!shownDeck) return
    loadContent(shownDeck, true)
      .then((loaded) => setView((v) => (v.type === 'presentation' || v.type === 'presenter') && v.deck === shownDeck ? { ...v, content: loaded } : v))
      .catch((error) => console.warn('Live reload failed; keeping the current version.', error))
  })

  const go = useCallback(
    (url: string) => {
      window.history.pushState(null, '', url)
      void show(currentRoute())
    },
    [show],
  )
  const goHome = useCallback(() => go(homeUrl()), [go])
  /** Editing needs the server and a writable deck. */
  const editable = (deck: DeckRef) => !IS_STATIC && !decks.find((d) => sameDeck(d, deck))?.readOnly

  switch (view.type) {
    case 'loading':
      return <div className="spinner" role="status" aria-label="Loading" />
    case 'home':
      return (
        <HomePage
          decks={decks}
          sources={content?.sources ?? []}
          canCreate={!IS_STATIC && !!content && !content.readOnly}
          isStatic={IS_STATIC}
          error={loadError}
          defaultSource={content?.defaultSource}
          loadDeck={loadContent}
          onPresent={(deck, dev) => go(presentationUrl(deck, { dev }))}
          onEdit={(deck) => go(editorUrl(deck))}
          onChat={(deck) => go(chatUrl(deck))}
          onGallery={() => go(galleryUrl())}
        />
      )
    case 'gallery':
      return (
        <Suspense fallback={<div className="spinner" role="status" aria-label="Loading gallery" />}>
          <GalleryPage onExit={goHome} />
        </Suspense>
      )
    case 'chat':
      return (
        <Placeholder title={view.deck ? `Chat: ${deckName(view.deck)}` : 'Chat'} onHome={goHome}>
          Arrives in Phase 10.
        </Placeholder>
      )
    case 'editor':
      return (
        <Suspense fallback={<div className="spinner" role="status" aria-label="Loading editor" />}>
          <EditorPage key={`${view.deck.source}:${view.deck.path}`} deck={view.deck} defaultSource={content?.defaultSource} onExit={goHome} />
        </Suspense>
      )
    case 'presentation-error':
      return <PresentationErrorUI errorMessage={view.error} presentationName={deckName(view.deck)} onGoHome={goHome} onGoToEditor={editable(view.deck) ? () => go(editorUrl(view.deck)) : undefined} />
    case 'presentation':
      return (
        <>
          <ErrorBoundary key={`${view.deck.source}:${view.deck.path}`} presentationName={deckName(view.deck)} onGoHome={goHome} onGoToEditor={editable(view.deck) ? () => go(editorUrl(view.deck)) : undefined}>
            <DeckView deck={view.deck} content={view.content} defaultSource={content?.defaultSource} />
          </ErrorBoundary>
          <button type="button" className="presentation-view-button deck-home-button" onClick={goHome}>
            Home
          </button>
        </>
      )
    case 'presenter':
      return <DeckView deck={view.deck} content={view.content} defaultSource={content?.defaultSource} />
  }
}

const scope = mdxComponentScope as MDXComponents

/** A compiled deck with its component scope and asset resolver. */
function DeckView({ deck, content: Content, defaultSource }: { deck: DeckRef; content: ComponentType; defaultSource?: string }) {
  const deckContext = useMemo(() => ({ deck, resolveAsset: assetResolverFor(deck, defaultSource) }), [deck, defaultSource])
  return (
    <DeckContext.Provider value={deckContext}>
      <MDXProvider components={scope}>
        <Content />
      </MDXProvider>
    </DeckContext.Provider>
  )
}
