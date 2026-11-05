import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType } from 'react'
import { motion } from 'motion/react'
import type { DeckRef, PresentationInfo, VaultInfo } from '@shared/decks.ts'
import { appPath } from '../basePath'
import { GlobalCommandPalette, type CommandItem } from '../components/editor/GlobalCommandPalette'
import { KeyboardShortcutsModal } from '../components/editor/KeyboardShortcutsModal'
import { displayName, filterDecks, filtersFromSearch, searchFromFilters, type DeckFilters, type DeckSort } from './filterDecks'
import { PlusIcon } from './icons'
import { PresentationCard } from './PresentationCard'
import { VaultSwitcher } from './VaultSwitcher'

export interface HomePageProps {
  /** The vault shown; `decks` are its decks only. */
  vault: VaultInfo
  vaults: VaultInfo[]
  decks: PresentationInfo[]
  /** Hides "Create New" (static builds, read-only vault). */
  canCreate: boolean
  /** Static builds: no editor or chat. */
  isStatic: boolean
  error?: string
  defaultSource?: string
  loadDeck(deck: DeckRef): Promise<ComponentType>
  onPresent(deck: DeckRef, dev: boolean): void
  onEdit(deck: DeckRef): void
  onChat(deck?: DeckRef): void
  onGallery(): void
  onSwitchVault(id: string): void
  onSettings(): void
}

const SORTS: { value: DeckSort; label: string }[] = [
  { value: 'updated', label: 'Update date' },
  { value: 'created', label: 'Creation date' },
  { value: 'alphabetical', label: 'Alphabetical' },
]

const isTyping = (el: EventTarget | null) => el instanceof HTMLElement && (['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) || el.isContentEditable)

function Logo({ size }: { size: number }) {
  return (
    <span className="home-logo" style={{ width: size, height: size }}>
      <img src={appPath('/logo-on-dark.svg')} alt="" width={size} height={size} />
      <motion.span className="home-logo__dot" animate={{ scale: [1, 1.4, 1], opacity: [0.7, 1, 0.7] }} transition={{ duration: 2, repeat: Infinity }} />
    </span>
  )
}

/** The deck browser (Part 3 §1.5). */
export function HomePage(props: HomePageProps) {
  const { vault, vaults, decks, canCreate, isStatic, error, defaultSource, loadDeck, onPresent, onEdit, onChat, onGallery, onSwitchVault, onSettings } = props
  const [filters, setFilters] = useState<DeckFilters>(() => filtersFromSearch(window.location.search))
  const [scrollTop, setScrollTop] = useState(0)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  // The filters live in the URL so a reload or a shared link keeps them.
  useEffect(() => {
    const url = `${window.location.pathname}${searchFromFilters(filters)}`
    if (url !== `${window.location.pathname}${window.location.search}`) window.history.replaceState(null, '', url)
  }, [filters])

  const visible = useMemo(() => filterDecks(decks, filters), [decks, filters])
  const set = <K extends keyof DeckFilters>(key: K, value: DeckFilters[K]) => setFilters((f) => ({ ...f, [key]: value }))

  const commands = useMemo<CommandItem[]>(
    () => [
      { id: 'shortcuts', name: 'Keyboard Shortcuts', category: 'action', shortcut: ['?'], action: () => setShortcutsOpen(true) },
      ...(isStatic ? [] : [{ id: 'chat', name: 'Chat', description: 'Create or change decks with an AI assistant', category: 'action' as const, action: () => onChat() }]),
      { id: 'gallery', name: 'Component Gallery', description: 'Every component and template with a live preview', category: 'action', action: onGallery },
      ...(isStatic ? [] : [{ id: 'settings', name: 'Manage Vaults', description: 'Add, rename or remove vaults', category: 'action' as const, action: onSettings }]),
      ...vaults
        .filter((v) => v.id !== vault.id)
        .map((v): CommandItem => ({ id: `vault:${v.id}`, name: `Switch to Vault: ${v.name}`, description: v.path, category: 'navigation', action: () => onSwitchVault(v.id) })),
      ...decks.flatMap((d): CommandItem[] => [
        { id: `present:${d.source}:${d.path}`, name: `Present: ${displayName(d.path)}`, description: d.path, category: 'navigation', action: () => onPresent(d, false) },
        { id: `dev:${d.source}:${d.path}`, name: `Dev Mode: ${displayName(d.path)}`, description: d.path, category: 'navigation', action: () => onPresent(d, true) },
        ...(d.readOnly || isStatic
          ? []
          : [{ id: `edit:${d.source}:${d.path}`, name: `Edit: ${displayName(d.path)}`, description: d.path, category: 'navigation' as const, action: () => onEdit(d) }]),
      ]),
    ],
    [decks, isStatic, onChat, onGallery, onPresent, onEdit, onSettings, onSwitchVault, vault.id, vaults],
  )

  const keyHandler = useRef<(e: KeyboardEvent) => void>(() => {})
  keyHandler.current = (e) => {
    if (paletteOpen || shortcutsOpen || isTyping(e.target)) return
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault()
      setPaletteOpen(true)
    } else if (e.key === '?') {
      setShortcutsOpen(true)
    }
  }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => keyHandler.current(e)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const loaders = useRef(new Map<string, () => Promise<ComponentType>>())
  const loaderFor = useCallback((deck: PresentationInfo) => {
    const key = `${deck.source}:${deck.path}`
    let loader = loaders.current.get(key)
    if (!loader) {
      loader = () => loadDeck(deck)
      loaders.current.set(key, loader)
    }
    return loader
  }, [loadDeck])

  const showFilters = decks.length > 0
  const ownVaults = vaults.filter((v) => !v.builtIn && !v.temporary)

  return (
    <div ref={rootRef} className="home" onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}>
      <motion.nav className="home-nav" initial={false} animate={{ y: scrollTop > 200 ? 0 : -72 }} transition={{ duration: 0.25 }} aria-hidden={scrollTop <= 200}>
        <Logo size={28} />
        <span className="home-nav__name">Slidecraft</span>
      </motion.nav>

      <header className="home-hero">
        <motion.div
          className="home-hero__art"
          style={{ backgroundImage: `url(${appPath('/hero.svg')})`, backgroundPosition: `center ${scrollTop * 0.3}px` }}
          initial={{ opacity: 0, scale: 1.1 }}
          animate={{ opacity: 0.3, scale: 1 }}
          transition={{ duration: 1.2 }}
        />
        <div className="home-hero__shade" />
        <div className="home-topbar">
          <VaultSwitcher vault={vault} vaults={vaults} onSwitch={onSwitchVault} />
          {!isStatic && (
            <button type="button" className="tool-button" onClick={onSettings}>
              Vaults…
            </button>
          )}
        </div>
        <div className="home-hero__content">
          <Logo size={64} />
          <h1 className="home-hero__name">Slidecraft</h1>
          <p className="home-hero__tagline">Decks as MDX, rendered with React and motion.</p>
          <p className="home-hero__hint">Select a presentation to begin</p>
          <button type="button" className="tool-pill" onClick={onGallery}>
            Browse component gallery →
          </button>
        </div>
      </header>

      <main className="home-main">
        {error && <p className="home-error" role="alert">{error}</p>}
        {!isStatic && !error && ownVaults.length === 0 && (
          <div className="home-notice">
            <div>
              <strong>Keep your presentations in a vault</strong>
              <span>
                {vault.temporary
                  ? `This folder is open for this run only. Save it as a vault to find it again, or add vaults for work and private decks.`
                  : 'A vault is a folder of your own presentations, kept apart from the others: one for work, one for private talks.'}
              </span>
            </div>
            <button type="button" className="tool-button is-primary" onClick={onSettings}>
              {vault.temporary ? 'Save as a vault' : 'Create a vault'}
            </button>
          </div>
        )}
        {showFilters && (
          <div className="home-filters">
            <label className="tool-field">
              <span>Path</span>
              <input value={filters.path} placeholder="presentations/" onChange={(e) => set('path', e.target.value)} />
            </label>
            <label className="tool-field is-grow">
              <span>Filter</span>
              <input value={filters.q} placeholder="Name or path" onChange={(e) => set('q', e.target.value)} />
            </label>
            <label className="tool-field">
              <span>Sort</span>
              <select value={filters.sort} onChange={(e) => set('sort', e.target.value as DeckSort)}>
                {SORTS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
            <span className="home-filters__count">
              {visible.length} of {decks.length} presentations
            </span>
          </div>
        )}

        {decks.length === 0 && (
          <p className="home-empty">
            No presentations in {vault.name} yet.{vault.path ? <> Each one is a folder in <code>{vault.path}</code> with an <code>index.mdx</code> file.</> : null}
          </p>
        )}
        {(canCreate || decks.length > 0) && (
          <div className="home-grid">
            {canCreate && (
              <button type="button" className="deck-card deck-card--create" onClick={() => onChat()}>
                <span className="deck-card__plus">
                  <PlusIcon size={28} />
                </span>
                <strong>Create New</strong>
                <span>Start with AI assistant</span>
              </button>
            )}
            {decks.length > 0 && visible.length === 0 && (
              <div className="deck-card deck-card--empty">
                <strong>No matches</strong>
                <span>Try a different filter.</span>
              </div>
            )}
            {visible.map((deck, i) => (
              <PresentationCard
                key={`${deck.source}:${deck.path}`}
                deck={deck}
                index={i}
                defaultSource={defaultSource}
                load={loaderFor(deck)}
                onPresent={() => onPresent(deck, false)}
                onDev={() => onPresent(deck, true)}
                onEdit={deck.readOnly || isStatic ? undefined : () => onEdit(deck)}
                onChat={deck.readOnly || isStatic ? undefined : () => onChat(deck)}
                canExport={!isStatic}
              />
            ))}
          </div>
        )}
      </main>

      <footer className="home-footer">
        <span className="home-footer__inner">
          Powered by <img src={appPath('/logo-on-dark.svg')} alt="" width={14} height={14} /> Slidecraft
        </span>
      </footer>

      <GlobalCommandPalette isOpen={paletteOpen} onClose={() => setPaletteOpen(false)} mode="Home" commands={commands} />
      <KeyboardShortcutsModal isOpen={shortcutsOpen} onClose={() => setShortcutsOpen(false)} mode="home" />
    </div>
  )
}
