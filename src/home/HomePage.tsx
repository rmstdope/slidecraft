import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType, type ReactNode } from 'react'
import { FolderPlus, LayoutGrid, Monitor, Moon, Plus, Presentation, Search, Settings, Sun } from 'lucide-react'
import type { AgentBackendInfo } from '@shared/agent.ts'
import type { DeckRef, PresentationInfo, VaultInfo } from '@shared/decks.ts'
import { GlobalCommandPalette, type CommandItem } from '../components/editor/GlobalCommandPalette'
import { KeyboardShortcutsModal } from '../components/editor/KeyboardShortcutsModal'
import { displayName, filterDecks, filtersFromSearch, searchFromFilters, type DeckFilters, type DeckSort } from './filterDecks'
import { PresentationCard } from './PresentationCard'
import { AgentChat } from '../agent/AgentChat'
import { fetchAgentSettings, fetchBackends } from '../agent/api'
import { createPresentation } from '../api'
import type { ThemeChoice } from '../appearance/appearance'
import { useAppearance } from '../appearance/useAppearance'
import { Button, cn, Dialog, Field, Input, Kbd, Logo, SegmentedControl, Select, StatusDot } from '../ui'

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
  onPresent(deck: DeckRef): void
  onEdit(deck: DeckRef): void
  onGallery(): void
  onSwitchVault(id: string): void
  /** Opens settings, at a section when given (`vaults`). */
  onSettings(section?: 'vaults'): void
}

const SORTS: { value: DeckSort; label: string }[] = [
  { value: 'updated', label: 'Recently updated' },
  { value: 'created', label: 'Recently created' },
  { value: 'alphabetical', label: 'Alphabetical' },
]

const isTyping = (el: EventTarget | null) =>
  el instanceof HTMLElement &&
  (['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) || el.isContentEditable || !!el.closest('[role=combobox],[role=listbox],[role=option],[role=menu],[role=menuitem]'))

const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)

/** The deck browser (Part 3 §1.5), in the redesigned chrome (ui-redesign-plan R3). */
export function HomePage(props: HomePageProps) {
  const { vault, vaults, decks, canCreate, isStatic, error, defaultSource, loadDeck, onPresent, onEdit, onGallery, onSwitchVault, onSettings } = props
  const [filters, setFilters] = useState<DeckFilters>(() => filtersFromSearch(window.location.search))
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [naming, setNaming] = useState(false)

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
      { id: 'gallery', name: 'Component Gallery', description: 'Every component and template with a live preview', category: 'action', action: onGallery },
      ...(isStatic ? [] : [{ id: 'settings', name: 'Manage Vaults', description: 'Add, rename or remove vaults', category: 'action' as const, action: () => onSettings('vaults') }]),
      ...vaults
        .filter((v) => v.id !== vault.id)
        .map((v): CommandItem => ({ id: `vault:${v.id}`, name: `Switch to Vault: ${v.name}`, description: v.path, category: 'navigation', action: () => onSwitchVault(v.id) })),
      ...decks.flatMap((d): CommandItem[] => [
        { id: `present:${d.source}:${d.path}`, name: `Present: ${displayName(d.path)}`, description: d.path, category: 'navigation', action: () => onPresent(d) },
        ...(d.readOnly || isStatic
          ? []
          : [{ id: `edit:${d.source}:${d.path}`, name: `Edit: ${displayName(d.path)}`, description: d.path, category: 'navigation' as const, action: () => onEdit(d) }]),
      ]),
    ],
    [decks, isStatic, onGallery, onPresent, onEdit, onSettings, onSwitchVault, vault.id, vaults],
  )

  const keyHandler = useRef<(e: KeyboardEvent) => void>(() => {})
  keyHandler.current = (e) => {
    if (paletteOpen || shortcutsOpen || naming || isTyping(e.target)) return
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
  const loaderFor = useCallback(
    (deck: PresentationInfo) => {
      const key = `${deck.source}:${deck.path}`
      let loader = loaders.current.get(key)
      if (!loader) {
        loader = () => loadDeck(deck)
        loaders.current.set(key, loader)
      }
      return loader
    },
    [loadDeck],
  )

  const ownVaults = vaults.filter((v) => !v.builtIn && !v.temporary)

  return (
    <div className="sc-app tw:flex tw:h-full tw:flex-wrap tw:overflow-y-auto tw:bg-ground tw:lg:flex-nowrap tw:lg:overflow-hidden">
      <Sidebar vault={vault} vaults={vaults} deckCount={decks.length} isStatic={isStatic} onGallery={onGallery} onSwitchVault={onSwitchVault} onSettings={onSettings} />

      <main className="tw:m-2.5 tw:flex tw:min-w-0 tw:flex-[999_1_480px] tw:flex-col tw:rounded-2xl tw:bg-panel tw:shadow-[0_0_0_1px_var(--sc-line),var(--sc-elev)] tw:lg:overflow-y-auto">
        <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-3 tw:border-b tw:border-line tw:px-5 tw:py-3.5">
          <span className="tw:text-muted">{vault.name}</span>
          <span className="tw:text-muted" aria-hidden>
            /
          </span>
          <span className="tw:font-medium">Presentations</span>
          <span className="tw:flex-1" />
          {decks.length > 0 && (
            <div className="tw:flex tw:h-9 tw:w-[280px] tw:max-w-full tw:items-center tw:gap-2 tw:rounded-[9px] tw:bg-field tw:px-2.5 tw:focus-within:shadow-[0_0_0_2px_var(--sc-focus)]">
              <Search className="tw:size-4 tw:shrink-0 tw:text-muted" aria-hidden />
              <input
                value={filters.q}
                onChange={(e) => set('q', e.target.value)}
                placeholder="Filter by name or path"
                aria-label="Filter presentations"
                className="tw:min-w-0 tw:flex-1 tw:border-0 tw:bg-transparent tw:text-fg tw:outline-none tw:placeholder:text-muted"
              />
              <button type="button" onClick={() => setPaletteOpen(true)} aria-label="Open the command palette" title="Command palette">
                <Kbd>{IS_MAC ? '⌘K' : 'Ctrl K'}</Kbd>
              </button>
            </div>
          )}
          {canCreate && (
            <Button variant="primary" onClick={() => setNaming(true)}>
              <Plus aria-hidden />
              New deck
            </Button>
          )}
        </div>

        <div className="tw:flex tw:flex-col tw:items-center tw:gap-5 tw:px-6 tw:pt-10 tw:pb-7 tw:md:px-10">
          {canCreate ? (
            <>
              <h1 className="tw:text-center tw:font-display tw:text-[44px] tw:leading-[1.05] tw:font-semibold tw:tracking-[-0.015em]">
                What are you presenting<span className="tw:text-accent">?</span>
              </h1>
              <div className="tw:w-full tw:max-w-[680px]">
                <AgentChat compact vault={vault.id} onDeckWritten={onEdit} />
              </div>
            </>
          ) : (
            <div className="tw:flex tw:flex-col tw:items-center tw:gap-2 tw:text-center">
              <h1 className="tw:font-display tw:text-[44px] tw:leading-[1.05] tw:font-semibold tw:tracking-[-0.015em]">{vault.name}</h1>
              <p className="tw:text-muted">{vault.readOnly && !isStatic ? 'A read-only vault: present or open a deck to look at it.' : 'Select a presentation to begin.'}</p>
            </div>
          )}
        </div>

        <div className="tw:flex tw:flex-col tw:gap-4 tw:px-6 tw:pb-10 tw:md:px-10">
          {error && (
            <p role="alert" className="tw:rounded-xl tw:bg-field tw:px-4 tw:py-3 tw:text-removed">
              {error}
            </p>
          )}
          {!isStatic && !error && ownVaults.length === 0 && (
            <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-4 tw:rounded-xl tw:bg-accent-tint tw:px-4 tw:py-3.5">
              <div className="tw:flex tw:min-w-[240px] tw:flex-1 tw:flex-col tw:gap-0.5 tw:text-on-accent-tint">
                <strong className="tw:font-semibold">Keep your presentations in a vault</strong>
                <span>
                  {vault.temporary
                    ? `This folder is open for this run only. Save it as a vault to find it again, or add vaults for work and private decks.`
                    : 'A vault is a folder of your own presentations, kept apart from the others: one for work, one for private talks.'}
                </span>
              </div>
              <Button variant="primary" onClick={() => onSettings('vaults')}>
                {vault.temporary ? 'Save as a vault' : 'Create a vault'}
              </Button>
            </div>
          )}

          {decks.length > 0 && (
            <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-3">
              <h2 className="tw:text-[15px] tw:font-semibold">Presentations</h2>
              <span className="tw:text-[13px] tw:text-muted">
                {visible.length === decks.length ? decks.length : `${visible.length} of ${decks.length}`}
              </span>
              <span className="tw:flex-1" />
              <Input
                value={filters.path}
                onChange={(e) => set('path', e.target.value)}
                placeholder="Folder, e.g. talks/"
                aria-label="Folder"
                className="tw:h-8 tw:w-44 tw:text-[13px]"
              />
              <Select aria-label="Sort" className="tw:h-8 tw:text-[13px]" value={filters.sort} onValueChange={(v) => set('sort', v)} options={SORTS} />
            </div>
          )}

          {decks.length === 0 && (
            <p className="tw:rounded-xl tw:bg-field tw:px-4 tw:py-6 tw:text-center tw:text-muted">
              No presentations in {vault.name} yet.
              {vault.path ? (
                <>
                  {' '}
                  Each one is a folder in <code className="tw:font-mono tw:text-[13px] tw:text-fg-2">{vault.path}</code> with an{' '}
                  <code className="tw:font-mono tw:text-[13px] tw:text-fg-2">index.mdx</code> file.
                </>
              ) : null}
            </p>
          )}
          {decks.length > 0 && visible.length === 0 && (
            <p className="tw:rounded-xl tw:bg-field tw:px-4 tw:py-6 tw:text-center tw:text-muted">
              <strong className="tw:text-fg">No matches.</strong> Try a different filter.
            </p>
          )}
          {visible.length > 0 && (
            <div className="tw:grid tw:grid-cols-[repeat(auto-fill,minmax(240px,1fr))] tw:gap-x-[18px] tw:gap-y-6">
              {visible.map((deck, i) => (
                <PresentationCard
                  key={`${deck.source}:${deck.path}`}
                  deck={deck}
                  index={i}
                  defaultSource={defaultSource}
                  load={loaderFor(deck)}
                  onPresent={() => onPresent(deck)}
                  onEdit={deck.readOnly || isStatic ? undefined : () => onEdit(deck)}
                  canExport={!isStatic}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      {canCreate && <NewDeckDialog open={naming} onOpenChange={setNaming} vault={vault.id} onCreated={onEdit} />}
      <GlobalCommandPalette isOpen={paletteOpen} onClose={() => setPaletteOpen(false)} mode="Home" commands={commands} />
      <KeyboardShortcutsModal isOpen={shortcutsOpen} onClose={() => setShortcutsOpen(false)} mode="home" />
    </div>
  )
}

// ---------------------------------------------------------------------------------------------

function NavItem({ icon, label, active, onClick }: { icon: ReactNode; label: ReactNode; active?: boolean; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'tw:flex tw:h-9 tw:w-full tw:items-center tw:gap-2.5 tw:rounded-lg tw:px-2.5 tw:text-left tw:font-medium tw:[&_svg]:size-4 tw:[&_svg]:shrink-0',
        active ? 'tw:bg-panel tw:text-fg tw:shadow-hairline' : 'tw:text-fg-2 tw:hover:bg-field',
      )}
    >
      {icon}
      <span className="tw:min-w-0 tw:flex-1 tw:truncate">{label}</span>
    </button>
  )
}

const THEME_SEGMENTS: { value: ThemeChoice; label: ReactNode; title: string }[] = [
  { value: 'light', label: <Sun className="tw:size-3.5" aria-label="Light" />, title: 'Light' },
  { value: 'dark', label: <Moon className="tw:size-3.5" aria-label="Dark" />, title: 'Dark' },
  { value: 'system', label: <Monitor className="tw:size-3.5" aria-label="System" />, title: 'Follow the system' },
]

function Sidebar({
  vault,
  vaults,
  deckCount,
  isStatic,
  onGallery,
  onSwitchVault,
  onSettings,
}: {
  vault: VaultInfo
  vaults: VaultInfo[]
  deckCount: number
  isStatic: boolean
  onGallery(): void
  onSwitchVault(id: string): void
  onSettings(section?: 'vaults'): void
}) {
  const { appearance, update } = useAppearance()
  return (
    <aside className="tw:flex tw:w-full tw:shrink-0 tw:flex-col tw:gap-5 tw:px-3.5 tw:py-5 tw:lg:h-full tw:lg:w-60 tw:lg:overflow-y-auto">
      <Logo withName className="tw:px-2" />
      <nav aria-label="Main" className="tw:flex tw:flex-col tw:gap-0.5">
        <NavItem icon={<Presentation aria-hidden />} label="Presentations" active />
        <NavItem icon={<LayoutGrid aria-hidden />} label="Component gallery" onClick={onGallery} />
        {!isStatic && <NavItem icon={<Settings aria-hidden />} label="Settings" onClick={() => onSettings()} />}
      </nav>
      {vaults.length > 1 || !isStatic ? (
        <nav aria-label="Vaults" className="tw:flex tw:flex-col tw:gap-0.5">
          <span className="tw:px-2.5 tw:pb-1.5 tw:text-[12px] tw:font-medium tw:text-muted">Vaults</span>
          {vaults.map((v) => (
            <NavItem
              key={v.id}
              active={v.id === vault.id}
              onClick={v.id === vault.id ? undefined : () => onSwitchVault(v.id)}
              icon={<span aria-hidden className={cn('tw:size-2 tw:rounded-[3px]', v.builtIn ? 'tw:bg-brand' : v.temporary ? 'tw:bg-muted' : 'tw:bg-agent')} />}
              label={
                <span className="tw:flex tw:items-center tw:gap-2">
                  <span className="tw:min-w-0 tw:flex-1 tw:truncate" title={v.readOnly || v.temporary ? `${v.name} (${v.temporary ? 'this run only' : 'read-only'})` : undefined}>
                    {v.name}
                    {(v.readOnly || v.temporary) && <span className="tw:ml-1.5 tw:text-[11px] tw:font-normal tw:text-muted">{v.temporary ? 'this run' : 'read-only'}</span>}
                  </span>
                  {v.id === vault.id && <span className="tw:font-mono tw:text-[12px] tw:font-normal tw:text-muted">{deckCount}</span>}
                </span>
              }
            />
          ))}
          {!isStatic && <NavItem icon={<FolderPlus aria-hidden />} label="Add vault" onClick={() => onSettings('vaults')} />}
        </nav>
      ) : null}
      <span className="tw:hidden tw:flex-1 tw:lg:block" />
      <SegmentedControl aria-label="Appearance" size="sm" className="tw:self-start" value={appearance.theme} onValueChange={(v) => update({ theme: v })} items={THEME_SEGMENTS} />
      {!isStatic && <AgentStatus onSettings={onSettings} />}
    </aside>
  )
}

/** Which agent new conversations use and whether it is ready. */
function AgentStatus({ onSettings }: { onSettings(): void }) {
  const [backend, setBackend] = useState<AgentBackendInfo | null>(null)
  useEffect(() => {
    let live = true
    void Promise.all([fetchBackends(), fetchAgentSettings()]).then(([b, s]) => {
      if (!live || !b.data) return
      setBackend(b.data.find((x) => x.id === s.data?.backend) ?? b.data.find((x) => x.available) ?? b.data[0] ?? null)
    })
    return () => {
      live = false
    }
  }, [])
  if (!backend) return null
  return (
    <button
      type="button"
      onClick={() => onSettings()}
      title="Agent settings"
      className="tw:flex tw:items-center tw:gap-2.5 tw:rounded-xl tw:bg-panel tw:p-2.5 tw:text-left tw:shadow-hairline tw:hover:bg-panel-alt"
    >
      <StatusDot tone={backend.available ? 'agent' : 'muted'} className="tw:ml-0.5" />
      <span className="tw:flex tw:min-w-0 tw:flex-1 tw:flex-col">
        <span className="tw:truncate tw:text-[13px] tw:font-medium">{backend.name}</span>
        <span className="tw:text-[12px] tw:text-muted">{backend.available ? 'Ready' : 'Not available'}</span>
      </span>
    </button>
  )
}

// ---------------------------------------------------------------------------------------------

const DECK_NAME = /^[a-z0-9][a-z0-9-]*$/

/** "New deck" for working by hand: a folder name, then the workspace. */
function NewDeckDialog({ open, onOpenChange, vault, onCreated }: { open: boolean; onOpenChange(open: boolean): void; vault: string; onCreated(deck: DeckRef): void }) {
  const [name, setName] = useState('')
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState(false)
  const valid = DECK_NAME.test(name)
  const create = async () => {
    if (!valid || busy) return
    setBusy(true)
    const result = await createPresentation(vault, name)
    setBusy(false)
    if (result.data) onCreated(result.data)
    else setError(result.error)
  }
  const change = (o: boolean) => {
    onOpenChange(o)
    if (!o) setError(undefined)
  }
  return (
    <Dialog
      open={open}
      onOpenChange={change}
      title="New deck"
      description="Starts from a title slide that you write yourself. To have the agent write it, describe the talk on the home page instead."
    >
      <form
        className="tw:flex tw:flex-col tw:gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          void create()
        }}
      >
        <Field label="Folder name" hint="Lower-case words joined by dashes" error={error}>
          <Input autoFocus value={name} placeholder="q4-review" onChange={(e) => setName(e.target.value.toLowerCase().replace(/\s+/g, '-'))} />
        </Field>
        <div className="tw:flex tw:justify-end tw:gap-2">
          <Button onClick={() => change(false)}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={!valid || busy}>
            Create
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
