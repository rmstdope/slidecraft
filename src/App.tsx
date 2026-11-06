import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type ComponentType } from 'react'
import { MDXProvider } from '@mdx-js/react'
import type { MDXComponents } from 'mdx/types'
import { BUILT_IN_SOURCE_ID, BUILT_IN_VAULT_NAME, deckName, sameDeck, type DeckRef, type PresentationInfo, type VaultInfo } from '@shared/decks.ts'
import { fetchPresentations, fetchVaults, openVault } from './api'
import { IS_STATIC, routePath } from './basePath'
import { ErrorBoundary, PresentationErrorUI } from './components/ErrorBoundary'
import { getMdxScope } from './components/mdxScope'
import { useRegistryVersion } from './hooks/useRegistryVersion'
import { assetResolverFor, DeckContext } from './components/slides/deckContext'
import { bundledDeckNames, DeckNotFoundError, deckModuleLoader } from './deckLoading'
import { subscribeServerEvents, useSSE } from './hooks/useSSE'
import { HomePage } from './home/HomePage'
import {
  canonicalUrl,
  editorUrl,
  galleryUrl,
  homeUrl,
  isSameDeckView,
  parseRoute,
  presentationUrl,
  routeVault,
  settingsUrl,
  type Route,
  type ViewState,
} from './router'
import { startContentThemes } from './themes/contentThemes'
import { activateVault } from './vault-api/vaultComponents'
import { TrustPrompt } from './settings/TrustPrompt'
import { LoadingScreen } from './ui'

/** Monaco is large: the editor loads only when someone opens it. */
const EditorPage = lazy(() => import('./editor/EditorPage'))
/** The gallery compiles previews in the browser, so it also loads on demand. */
const GalleryPage = lazy(() => import('./gallery/GalleryPage'))

/** Vault management loads on demand. */
const SettingsPage = lazy(() => import('./settings/SettingsPage'))

const currentRoute = (defaultVault: string): Route => parseRoute(routePath(), window.location.search, defaultVault)

const bundledInfo = (): PresentationInfo[] =>
  bundledDeckNames().map((name) => ({ source: BUILT_IN_SOURCE_ID, path: name, name, createdAt: 0, updatedAt: 0, readOnly: true, builtIn: true }))

interface ContentContext {
  /** Where `/` goes: the last vault opened, or the server's default. */
  defaultVault: string
  /** The examples vault; its assets are served from /content/ (and bundled by Vite). */
  builtInSource: string
  vaults: VaultInfo[]
}

const EXAMPLES_VAULT: VaultInfo = { id: BUILT_IN_SOURCE_ID, name: BUILT_IN_VAULT_NAME, path: '', include: [], readOnly: true, builtIn: true, temporary: false, components: 'trusted' }
const OFFLINE_CONTENT: ContentContext = { defaultVault: BUILT_IN_SOURCE_ID, builtInSource: BUILT_IN_SOURCE_ID, vaults: [EXAMPLES_VAULT] }

export function App() {
  const [view, setView] = useState<ViewState>({ type: 'loading' })
  const [content, setContentState] = useState<ContentContext | null>(IS_STATIC ? OFFLINE_CONTENT : null)
  // The latest vaults, also for navigation that happens before React re-renders (a vault just added).
  const contentRef = useRef(content)
  const setContent = useCallback((next: ContentContext) => {
    contentRef.current = next
    setContentState(next)
  }, [])
  const [decks, setDecks] = useState<PresentationInfo[]>(bundledInfo)
  const [loadError, setLoadError] = useState<string>()
  const viewRef = useRef(view)
  useEffect(() => {
    viewRef.current = view
  }, [view])

  // Content sources, themes and the deck list come from the server (not in static builds).
  useEffect(() => {
    if (IS_STATIC) {
      void startContentThemes() // registers the bundled theme folders
      return
    }
    void (async () => {
      const [vaults] = await Promise.all([fetchVaults(), startContentThemes()])
      if (!vaults.data) {
        setLoadError(`Could not reach the Slidecraft server (${vaults.error}).`)
        setContent(OFFLINE_CONTENT)
        return
      }
      setContent(contentFrom(vaults.data))
      const list = await fetchPresentations()
      if (list.data) setDecks(list.data)
    })()
  }, [])

  /** After the settings page changed the vaults. */
  const reloadVaults = useCallback(async () => {
    const [vaults, list] = await Promise.all([fetchVaults(), fetchPresentations()])
    if (vaults.data) setContent(contentFrom(vaults.data))
    if (list.data) setDecks(list.data)
  }, [setContent])

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
      const loader = deckModuleLoader(deck, { builtInSourceId: content?.builtInSource, defaultSource: content?.builtInSource, runtime })
      return (await loader()).default
    },
    [content],
  )

  const lastOpened = useRef<string | undefined>(undefined)
  const show = useCallback(
    async (route: Route) => {
      const content = contentRef.current
      if (!content) return
      // `/` opens the last vault; older URL shapes become their /v/<vault>/ form.
      if (route.type === 'root') {
        void activateVault(content.defaultVault)
        window.history.replaceState(null, '', homeUrl(content.defaultVault))
        return setView({ type: 'home', vault: content.defaultVault })
      }
      const vault = routeVault(route)
      if (vault !== undefined && !content.vaults.some((v) => v.id === vault)) {
        window.history.replaceState(null, '', homeUrl(content.defaultVault))
        return setView({ type: 'home', vault: content.defaultVault })
      }
      // The vault on screen: its own components join the registry's default view.
      if (vault) void activateVault(vault)
      const canonical = canonicalUrl(route, window.location.search, window.location.hash)
      if (canonical) window.history.replaceState(null, '', canonical)
      if (vault && !IS_STATIC && lastOpened.current !== vault) {
        lastOpened.current = vault
        void openVault(vault)
      }
      switch (route.type) {
        case 'settings':
          return setView({ type: 'settings' })
        case 'home':
          return setView({ type: 'home', vault: route.vault })
        case 'gallery':
          return setView({ type: 'gallery', vault: route.vault })
        case 'chat':
          // The conversation lives in the deck workspace, or at the top of the vault's home page.
          window.history.replaceState(null, '', route.deck ? editorUrl(route.deck) : homeUrl(route.vault))
          return setView(route.deck ? { type: 'editor', deck: route.deck } : { type: 'home', vault: route.vault })
        case 'editor':
          return setView({ type: 'editor', deck: route.deck })
        case 'presentation': {
          const deck = route.deck
          setView({ type: 'loading' })
          try {
            const loaded = await loadContent(deck)
            setView(route.presenter ? { type: 'presenter', deck, content: loaded } : { type: 'presentation', deck, content: loaded })
          } catch (error) {
            if (error instanceof DeckNotFoundError) {
              window.history.replaceState(null, '', homeUrl(deck.source))
              return setView({ type: 'home', vault: deck.source })
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
    void show(currentRoute(content.defaultVault))
    const onPopState = () => {
      const route = currentRoute(content.defaultVault)
      if (isSameDeckView(viewRef.current, route)) return
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
      const current = contentRef.current
      if (current) void show(currentRoute(current.defaultVault))
    },
    [show],
  )
  const viewVault = 'vault' in view ? view.vault : 'deck' in view && view.deck ? view.deck.source : content?.defaultVault
  const goHome = useCallback(() => go(homeUrl(viewVault)), [go, viewVault])
  /** Editing needs the server and a writable deck. */
  const editable = (deck: DeckRef) => !IS_STATIC && !decks.find((d) => sameDeck(d, deck))?.readOnly
  const assetSource = content?.builtInSource

  switch (view.type) {
    case 'loading':
      return <LoadingScreen />
    case 'settings':
      return (
        <Suspense fallback={<LoadingScreen label="Loading settings" />}>
          <SettingsPage vaults={content?.vaults ?? []} onChanged={reloadVaults} onOpenVault={(id) => go(homeUrl(id))} onExit={goHome} />
        </Suspense>
      )
    case 'home': {
      const vault = content?.vaults.find((v) => v.id === view.vault) ?? EXAMPLES_VAULT
      return (
        <>
        <TrustPrompt vault={vault} />
        <HomePage
          key={vault.id}
          vault={vault}
          vaults={content?.vaults ?? []}
          decks={decks.filter((d) => d.source === vault.id)}
          canCreate={!IS_STATIC && !!content && !vault.readOnly}
          isStatic={IS_STATIC}
          error={loadError}
          defaultSource={assetSource}
          loadDeck={loadContent}
          onPresent={(deck) => go(presentationUrl(deck))}
          onEdit={(deck) => go(editorUrl(deck))}
          onGallery={() => go(galleryUrl(vault.id))}
          onSwitchVault={(id) => go(homeUrl(id))}
          onSettings={(section) => go(settingsUrl(section))}
        />
        </>
      )
    }
    case 'gallery':
      return (
        <Suspense fallback={<LoadingScreen label="Loading gallery" />}>
          <TrustPrompt vault={content?.vaults.find((v) => v.id === view.vault)} />
          <GalleryPage vault={view.vault} vaultName={content?.vaults.find((v) => v.id === view.vault)?.name} onExit={goHome} />
        </Suspense>
      )
    case 'editor':
      return (
        <Suspense fallback={<LoadingScreen label="Loading editor" />}>
          <TrustPrompt vault={content?.vaults.find((v) => v.id === view.deck.source)} />
          <EditorPage key={`${view.deck.source}:${view.deck.path}`} deck={view.deck} defaultSource={assetSource} onExit={goHome} />
        </Suspense>
      )
    case 'presentation-error':
      return <PresentationErrorUI errorMessage={view.error} presentationName={deckName(view.deck)} onGoHome={goHome} onGoToEditor={editable(view.deck) ? () => go(editorUrl(view.deck)) : undefined} />
    case 'presentation':
      return (
        <>
          <ErrorBoundary key={`${view.deck.source}:${view.deck.path}`} presentationName={deckName(view.deck)} onGoHome={goHome} onGoToEditor={editable(view.deck) ? () => go(editorUrl(view.deck)) : undefined}>
            <DeckView deck={view.deck} content={view.content} defaultSource={assetSource} />
          </ErrorBoundary>
          <button type="button" className="presentation-view-button deck-home-button" onClick={goHome}>
            Home
          </button>
        </>
      )
    case 'presenter':
      return <DeckView deck={view.deck} content={view.content} defaultSource={assetSource} />
  }
}

function contentFrom(state: { vaults: VaultInfo[]; defaultVault: string }): ContentContext {
  return {
    defaultVault: state.defaultVault,
    builtInSource: state.vaults.find((v) => v.builtIn)?.id ?? BUILT_IN_SOURCE_ID,
    vaults: state.vaults,
  }
}

/** A compiled deck with its component scope and asset resolver. */
function DeckView({ deck, content: Content, defaultSource }: { deck: DeckRef; content: ComponentType; defaultSource?: string }) {
  const deckContext = useMemo(() => ({ deck, resolveAsset: assetResolverFor(deck, defaultSource) }), [deck, defaultSource])
  useRegistryVersion()
  return (
    <DeckContext.Provider value={deckContext}>
      <MDXProvider components={getMdxScope(deck.source) as MDXComponents}>
        <Content />
      </MDXProvider>
    </DeckContext.Provider>
  )
}
