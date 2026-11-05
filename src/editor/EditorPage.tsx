import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ArrowLeft, CircleHelp, PanelRightOpen, Play, Sparkles, WandSparkles } from 'lucide-react'
import { deckKey, deckName, type DeckRef } from '@shared/decks.ts'
import { importBlock } from '@shared/deckModel.ts'
import { KeyboardShortcutsModal } from '../components/editor/KeyboardShortcutsModal'
import { SLIDE_ACCENTS } from '../components/slides/accents'
import { assetResolverFor, DeckContext } from '../components/slides/deckContext'
import { useSSE } from '../hooks/useSSE'
import { registryLanguageService } from '../language-service'
import type { LanguageService } from '../language-service/service'
import { AgentChat } from '../agent/AgentChat'
import { presentationUrl } from '../router'
import { listThemes, resolveTheme } from '../themes/registry'
import { DeckLookContext, useThemesVersion } from '../themes/ThemeContext'
import { ACCEPTED_IMAGE_TYPES, uploadImage } from './api'
import type { CompileTarget } from './compileSlide'
import { ContextualToolbar } from './components/ContextualToolbar'
import { HelpPanel } from './components/HelpPanel'
import { ImagePickerModal } from './components/ImagePickerModal'
import { InsertPalette } from './components/InsertPalette'
import { SelectionToolbar } from './components/SelectionToolbar'
import { SlideEditor, type SelectionInfo, type SlideEditorHandle } from './components/SlideEditor'
import { SlidePreview } from './components/SlidePreview'
import { SlideSidebar } from './components/SlideSidebar'
import { getCursorContext, type CursorContext } from './cursorContext'
import { deleteElementAt, formatMdx, setPropAt } from './sourceEdits'
import { usePresentation } from './usePresentation'
import { StillPlaceholder } from './components/SlideStill'
import { Badge, Button, cn, Field, NativeSelect, Popover, SegmentedControl } from '../ui'

export interface EditorPageProps {
  deck: DeckRef
  defaultSource?: string
  onExit(): void
}

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v))

/** What the work area shows: the slide, the code, or both side by side. */
export type WorkspaceView = 'preview' | 'code' | 'split'
const VIEWS: { value: WorkspaceView; label: string }[] = [
  { value: 'preview', label: 'Preview' },
  { value: 'split', label: 'Split' },
  { value: 'code', label: 'Code' },
]
const VIEW_KEY = 'slidecraft-workspace-view'
const CHAT_KEY = 'slidecraft-workspace-chat'
function stored<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  try {
    const value = localStorage.getItem(key)
    return allowed.includes(value as T) ? (value as T) : fallback
  } catch {
    return fallback
  }
}
function store(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* storage unavailable */
  }
}
/** Inside Monaco, including its floating widgets (quick-fix menu, suggest list, hovers), which render outside the editor. */
const inMonaco = (el: EventTarget | null) =>
  el instanceof Element && !!el.closest('.monaco-editor, .context-view, .action-widget, .monaco-hover, .overflowingContentWidgets, .monaco-menu-container')
/** A form control, including Radix selects and menus (a button trigger and role=option items), which need the arrow keys and Enter. */
const inField = (el: EventTarget | null) =>
  el instanceof HTMLElement &&
  (['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) || el.isContentEditable || !!el.closest('[role=combobox],[role=listbox],[role=option],[role=menu],[role=menuitem]'))

/**
 * The deck workspace (UX overhaul U3; the editor of Part 3 §2): the agent conversation, the slide
 * rail, and a work area showing the preview, the code or both. While the agent works the code is
 * read-only, and unsaved edits are saved before a message goes out.
 */
export default function EditorPage({ deck, defaultSource, onExit }: EditorPageProps) {
  const { state, actions, selected, selectedIndex, deckTheme, deckLook } = usePresentation(deck)
  const editorRef = useRef<SlideEditorHandle>(null)
  const railRef = useRef<HTMLDivElement>(null)
  const workRef = useRef<HTMLDivElement>(null)
  const chatRef = useRef<HTMLDivElement>(null)
  const navigatingAway = useRef(false)
  const [cursorOffset, setCursorOffset] = useState(0)
  const [selection, setSelection] = useState<SelectionInfo | null>(null)
  const [palette, setPalette] = useState<'insert' | 'add-slide' | null>(null)
  const [helpOpen, setHelpOpen] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [imageProp, setImageProp] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [sidebarWidth, setSidebarWidth] = useState(200)
  const [editorRatio, setEditorRatio] = useState(0.5)
  const [chatWidth, setChatWidth] = useState(400)
  const [view, setView] = useState<WorkspaceView>(() => stored(VIEW_KEY, ['preview', 'code', 'split'], 'preview'))
  const [chatOpen, setChatOpen] = useState(() => stored(CHAT_KEY, ['open', 'closed'], 'open') === 'open')
  const [agentRunning, setAgentRunning] = useState(false)
  const resizing = useRef<'sidebar' | 'editor' | 'chat' | null>(null)
  const chooseView = (next: WorkspaceView) => {
    setView(next)
    store(VIEW_KEY, next)
  }
  const toggleChat = (open: boolean) => {
    setChatOpen(open)
    store(CHAT_KEY, open ? 'open' : 'closed')
  }
  useThemesVersion()

  const deckReadOnly = state.readOnly
  // Locked while the agent edits the file, so the two never write over each other.
  const readOnly = deckReadOnly || agentRunning
  const chatShown = chatOpen && !deckReadOnly
  const text = selected?.text ?? ''
  const theme = resolveTheme(deckTheme, deck.source)
  const frames = Object.keys(theme.spec.frames ?? {})
  const themes = listThemes(deck.source)
  const target: CompileTarget = useMemo(() => ({ deck, defaultSource, imports: state.model ? importBlock(state.model) : '' }), [deck, defaultSource, state.model?.head])

  // The language service sees the deck's themes and frames.
  const lsData = useRef({ themes: [] as string[], frames: [] as string[] })
  lsData.current = { themes: themes.map((t) => t.id), frames }
  const service = useMemo<LanguageService>(
    () =>
      registryLanguageService((component, prop) => {
        if (prop === 'theme' && (component === 'Presentation' || component === 'Slide')) return lsData.current.themes
        if (component === 'Slide' && prop === 'frame') return ['none', ...lsData.current.frames]
        return undefined
      }),
    [],
  )

  const context: CursorContext = useMemo(() => {
    const ctx = getCursorContext(text, cursorOffset)
    if (ctx.type === 'none' && selected) return getCursorContext(text, 1) // the Slide tag
    return ctx
  }, [text, cursorOffset, selected])

  const applyText = useCallback(
    (next: string) => {
      if (editorRef.current) editorRef.current.applyText(next)
      else actions.updateSelectedSlide(next)
    },
    [actions],
  )

  const present = useCallback(async () => {
    if (state.isDirty) await actions.save()
    navigatingAway.current = true
    window.location.href = presentationUrl(deck, { slide: Math.max(1, selectedIndex + 1) })
  }, [state.isDirty, actions, deck, selectedIndex])

  /** Before a message goes to the agent: save, so it works on what is on screen. */
  const beforeSend = useCallback(async () => (state.isDirty ? actions.save() : true), [state.isDirty, actions])

  const exit = () => {
    if (state.isDirty && !window.confirm('You have unsaved changes. Leave anyway?')) return
    navigatingAway.current = true
    onExit()
  }

  // Keyboard (Part 3 §2.5): capture phase, so these run before Monaco.
  const keyHandler = useRef<(e: KeyboardEvent) => void>(() => {})
  keyHandler.current = (e) => {
    const mod = e.metaKey || e.ctrlKey
    if (palette || imageProp || shortcutsOpen) return
    if (mod && e.key.toLowerCase() === 's') {
      e.preventDefault()
      e.stopPropagation() // e.g. ⌘K would otherwise start a Monaco chord
      if (!readOnly) void actions.save()
      return
    }
    if (mod && e.key.toLowerCase() === 'k') {
      e.preventDefault()
      e.stopPropagation() // e.g. ⌘K would otherwise start a Monaco chord
      if (!readOnly) setPalette('insert')
      return
    }
    if (mod && e.shiftKey && e.key === 'Enter') {
      e.preventDefault()
      e.stopPropagation() // e.g. ⌘K would otherwise start a Monaco chord
      void present()
      return
    }
    if (e.key === '?' && !mod && !inMonaco(e.target) && !inField(e.target)) {
      setShortcutsOpen(true)
      return
    }
    if (e.key === 'PageUp' || e.key === 'PageDown') {
      e.preventDefault()
      actions.selectByOffset(e.key === 'PageUp' ? -1 : 1)
      return
    }
    if (e.key === 'Escape' && inMonaco(e.target)) {
      ;(document.activeElement as HTMLElement | null)?.blur()
      return
    }
    if (e.key === 'Enter' && !inMonaco(e.target) && !inField(e.target) && selected) {
      e.preventDefault()
      editorRef.current?.focus()
      return
    }
    if (inMonaco(e.target) || inField(e.target)) return
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault()
      const delta = e.key === 'ArrowUp' ? -1 : 1
      if (e.altKey && !readOnly && selectedIndex >= 0) actions.moveSlide(selectedIndex, selectedIndex + delta)
      else actions.selectByOffset(delta)
    }
  }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => keyHandler.current(e)
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [])

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (state.isDirty && !navigatingAway.current) e.preventDefault()
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [state.isDirty])

  // External edits reload the deck unless there are unsaved changes here.
  useSSE(deck, () => {
    if (!state.isDirty && !state.isSaving) void actions.reload()
  })

  // Images: paste or drop into the editor area uploads into the deck and inserts a ContentImage.
  const insertImage = useCallback(
    async (file: File) => {
      if (readOnly || !ACCEPTED_IMAGE_TYPES.includes(file.type)) return
      setUploading(true)
      const result = await uploadImage(file, 'presentation', deck)
      setUploading(false)
      if (result.data) editorRef.current?.insertAtCursor(`<ContentImage src="${result.data.path}" alt="" />`)
      else console.warn('Image upload failed:', result.error)
    },
    [deck, readOnly],
  )
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      // A paste into the conversation is an attachment for the agent, not an image for the slide.
      if (e.target instanceof Element && e.target.closest('.agent-chat')) return
      const item = [...(e.clipboardData?.items ?? [])].find((i) => i.type.startsWith('image/'))
      const file = item?.getAsFile()
      if (!file) return
      e.preventDefault()
      void insertImage(file)
    }
    document.addEventListener('paste', onPaste)
    return () => document.removeEventListener('paste', onPaste)
  }, [insertImage])

  // Resizable rail and editor/preview split.
  useEffect(() => {
    // Each handle sizes the pane beside it, measured from that pane's own edge.
    const onMove = (e: MouseEvent) => {
      if (!resizing.current) return
      if (resizing.current === 'chat') {
        const box = chatRef.current?.getBoundingClientRect()
        if (box) setChatWidth(clamp(box.right - e.clientX, 300, 640))
      } else if (resizing.current === 'sidebar') {
        const box = railRef.current?.getBoundingClientRect()
        if (box) setSidebarWidth(clamp(e.clientX - box.left, 120, 400))
      } else {
        const box = workRef.current?.getBoundingClientRect()
        if (box && box.width > 0) setEditorRatio(clamp((e.clientX - box.left) / box.width, 0.2, 0.8))
      }
    }
    const onUp = () => {
      resizing.current = null
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [])
  const startResize = (which: 'sidebar' | 'editor' | 'chat') => () => {
    resizing.current = which
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }

  const deckContext = useMemo(() => ({ deck, resolveAsset: assetResolverFor(deck, defaultSource) }), [deck, defaultSource])

  if (state.isLoading && !state.model && !state.raw) return <div className="spinner" role="status" aria-label="Loading" />
  if (!state.model && !state.raw) {
    return (
      <div className="sc-app tw:flex tw:h-full tw:flex-col tw:items-center tw:justify-center tw:gap-4 tw:bg-ground tw:p-8 tw:text-center">
        <h1 className="tw:font-display tw:text-[32px] tw:font-semibold">Could not open {deckName(deck)}</h1>
        <pre className="tw:max-w-[640px] tw:font-mono tw:text-[13px] tw:whitespace-pre-wrap tw:text-removed">{state.error}</pre>
        <Button onClick={onExit}>Go back</Button>
      </div>
    )
  }

  const status = deckReadOnly ? 'Read-only' : state.error ? 'Save failed' : state.isSaving ? 'Saving…' : state.isDirty ? 'Unsaved changes' : 'Saved'

  return (
    <DeckContext.Provider value={deckContext}>
      {/* Every preview in the editor renders single slides, so the deck's defaults come from here. */}
      <DeckLookContext.Provider value={deckLook}>
        <div className="sc-app tw:flex tw:h-full tw:flex-col tw:bg-ground">
          <header className="tw:flex tw:flex-wrap tw:items-center tw:gap-2.5 tw:px-3.5 tw:py-2.5">
            <Button size="icon" onClick={exit} aria-label="Back to presentations" title="Back to presentations">
              <ArrowLeft aria-hidden />
            </Button>
            <div className="tw:flex tw:min-w-0 tw:flex-col">
              <span className="tw:truncate tw:text-[15px] tw:font-semibold">{deckName(deck)}</span>
              <span className="tw:truncate tw:text-[12px] tw:text-muted">
                {deck.source} / {deck.path} ·{' '}
                <span className={cn(state.error ? 'tw:text-removed' : state.isDirty ? 'tw:text-on-accent-tint' : !deckReadOnly && 'tw:text-agent')} title={state.error ?? undefined}>
                  {status}
                </span>
              </span>
            </div>
            {agentRunning && (
              <Badge tone="agent" role="status">
                <span className="tw:size-1.5 tw:animate-pulse tw:rounded-full tw:bg-agent" aria-hidden />
                Agent is editing
              </Badge>
            )}
            <span className="tw:flex-1" />
            <SegmentedControl aria-label="Show" value={view} onValueChange={chooseView} items={VIEWS} />
            {state.model && (
              <Popover
                trigger={
                  <Button title="The deck's theme, scheme and accent">
                    <span className="tw:max-w-40 tw:truncate">
                      {(deckTheme && themes.find((t) => t.id === deckTheme)?.name) || 'Slidecraft'} · {deckLook.scheme ?? theme.spec.defaults?.scheme ?? 'dark'}
                    </span>
                  </Button>
                }
              >
                <div className="tw:flex tw:flex-col tw:gap-3.5">
                  <Field label="Theme">
                    <NativeSelect value={deckTheme ?? ''} disabled={readOnly} onChange={(e) => actions.setDeckTheme(e.target.value)}>
                      <option value="">Default (slidecraft)</option>
                      {themes
                        .filter((t) => t.id !== 'slidecraft')
                        .map((t) => (
                          <option key={`${t.source}:${t.id}`} value={t.id}>
                            {t.name}
                            {t.source !== 'builtin' ? ' (this folder)' : ''}
                          </option>
                        ))}
                    </NativeSelect>
                  </Field>
                  <Field label="Scheme" hint="For slides that do not set their own">
                    <NativeSelect value={deckLook.scheme ?? ''} disabled={readOnly} onChange={(e) => actions.setDeckDefault('scheme', e.target.value)}>
                      <option value="">Theme default ({theme.spec.defaults?.scheme ?? 'dark'})</option>
                      {(theme.spec.constraints?.schemes ?? ['dark', 'light']).map((sch) => (
                        <option key={sch} value={sch}>
                          {sch}
                        </option>
                      ))}
                    </NativeSelect>
                  </Field>
                  <Field label="Accent" hint="For slides that do not set their own">
                    <NativeSelect value={deckLook.accent ?? ''} disabled={readOnly} onChange={(e) => actions.setDeckDefault('accent', e.target.value)}>
                      <option value="">Theme default ({theme.spec.defaults?.accent ?? 'yellow'})</option>
                      {SLIDE_ACCENTS.map((a) => (
                        <option key={a} value={a}>
                          {a}
                        </option>
                      ))}
                    </NativeSelect>
                  </Field>
                </div>
              </Popover>
            )}
            {!readOnly && selected && view !== 'preview' && (
              <Button variant="ghost" onClick={() => applyText(formatMdx(text))} title="Format this slide's MDX">
                <WandSparkles aria-hidden />
                Format
              </Button>
            )}
            <Button size="icon" variant={helpOpen ? 'quiet' : 'ghost'} aria-pressed={helpOpen} onClick={() => setHelpOpen((h) => !h)} aria-label="Help" title="Component reference and shortcuts">
              <CircleHelp aria-hidden />
            </Button>
            {!deckReadOnly && (
              <Button disabled={!state.isDirty || state.isSaving || agentRunning} onClick={() => void actions.save()} title="Save (⌘S)">
                {state.isSaving ? 'Saving…' : 'Save'}
              </Button>
            )}
            <Button variant="primary" onClick={() => void present()} title="Present from this slide (⌘⇧Enter)">
              <Play className="tw:size-3! tw:fill-current" aria-hidden />
              Present
            </Button>
          </header>

          <div className="tw:flex tw:min-h-0 tw:flex-1 tw:px-2.5 tw:pb-2.5">
            {state.raw ? (
              <Pane className="tw:flex-1">
                <div role="alert" className="tw:flex tw:flex-wrap tw:items-center tw:gap-3 tw:border-b tw:border-line tw:bg-accent-tint tw:px-4 tw:py-2.5 tw:text-on-accent-tint">
                  <span className="tw:flex-1">
                    <strong className="tw:font-semibold">This file does not parse</strong> ({state.raw.error}). Edit it as one text; switch back to slides once it parses.
                  </span>
                  <Button size="sm" onClick={actions.tryStructured}>
                    Back to slides
                  </Button>
                </div>
                <div className="tw:relative tw:min-h-0 tw:flex-1">
                  <SlideEditor
                    path={`${deckKey(deck)}/index.mdx`}
                    value={state.raw.text}
                    readOnly={readOnly}
                    service={() => service}
                    onChange={actions.updateRaw}
                    onSave={() => void actions.save()}
                    onCursor={() => {}}
                    onSelection={() => {}}
                  />
                </div>
              </Pane>
            ) : (
              <>
                <div ref={railRef} className="tw:flex tw:shrink-0" style={{ width: sidebarWidth }}>
                  <SlideSidebar
                    slides={state.model!.slides}
                    selectedId={state.selectedId}
                    readOnly={readOnly}
                    target={target}
                    theme={deckTheme}
                    onSelect={actions.selectSlide}
                    onDelete={actions.deleteSlide}
                    onMove={actions.moveSlide}
                    onToggleHidden={actions.toggleHidden}
                    onAddSlide={() => setPalette('add-slide')}
                  />
                </div>
                <Handle label="Resize the slide list" onStart={startResize('sidebar')} />
                <Pane
                  className="tw:min-w-0 tw:flex-1"
                  innerRef={workRef}
                  onDragOver={(e) => {
                    if ([...e.dataTransfer.items].some((i) => i.type.startsWith('image/'))) {
                      e.preventDefault()
                      setDragging(true)
                    }
                  }}
                  onDragLeave={(e) => {
                    if (!(e.relatedTarget instanceof Node && e.currentTarget.contains(e.relatedTarget))) setDragging(false)
                  }}
                  onDrop={(e) => {
                    const file = [...e.dataTransfer.files].find((f) => f.type.startsWith('image/'))
                    setDragging(false)
                    if (!file) return
                    e.preventDefault()
                    void insertImage(file)
                  }}
                  row
                >
                  {view !== 'preview' && (
                    <div className="tw:flex tw:min-w-0 tw:flex-col tw:bg-panel" style={{ flex: view === 'split' ? editorRatio : 1 }}>
                      {!readOnly && selected && (
                        <ContextualToolbar
                          context={context}
                          frames={frames}
                          onSlideProp={(prop, value) => applyText(setPropAt(text, 0, prop, value))}
                          onComponentProp={(prop, value) => context.type === 'component' && applyText(setPropAt(text, context.tagStart, prop, value))}
                          onInsert={(snippet) => editorRef.current?.insertAtCursor(snippet)}
                          onOpenPalette={() => setPalette('insert')}
                          onDeleteComponent={() => context.type === 'component' && applyText(deleteElementAt(text, context.tagStart))}
                          onPickImage={setImageProp}
                        />
                      )}
                      <div className="tw:relative tw:min-h-0 tw:flex-1">
                        {selected ? (
                          <SlideEditor
                            ref={editorRef}
                            path={`${deckKey(deck)}/${selected.id}.mdx`}
                            value={selected.text}
                            readOnly={readOnly}
                            service={() => service}
                            onChange={actions.updateSelectedSlide}
                            onSave={() => void actions.save()}
                            onCursor={setCursorOffset}
                            onSelection={setSelection}
                          />
                        ) : (
                          <StillPlaceholder>Select a slide to edit</StillPlaceholder>
                        )}
                      </div>
                    </div>
                  )}
                  {view === 'split' && (
                    <button
                      type="button"
                      aria-label="Resize the code and the preview"
                      onMouseDown={startResize('editor')}
                      className="tw:w-1 tw:shrink-0 tw:cursor-col-resize tw:bg-line tw:transition-colors tw:hover:bg-focus"
                    />
                  )}
                  {view !== 'code' && (
                    <div
                      className="tw:relative tw:min-w-0 tw:bg-canvas tw:[background-image:radial-gradient(var(--sc-canvas-dot)_1px,transparent_1px)] tw:[background-size:18px_18px]"
                      style={{ flex: view === 'split' ? 1 - editorRatio : 1 }}
                    >
                      {selected ? <SlidePreview source={selected.text} target={target} theme={deckTheme} /> : <StillPlaceholder>No slide selected</StillPlaceholder>}
                    </div>
                  )}
                  {(dragging || uploading) && (
                    <div className="tw:pointer-events-none tw:absolute tw:inset-2 tw:z-10 tw:grid tw:place-items-center tw:rounded-xl tw:bg-accent-tint/80 tw:font-semibold tw:text-on-accent-tint tw:shadow-[inset_0_0_0_2px_var(--sc-focus)]">
                      {uploading ? 'Uploading image…' : 'Drop the image here'}
                    </div>
                  )}
                </Pane>
                {helpOpen && (
                  <>
                    <span className="tw:w-2.5 tw:shrink-0" />
                    <HelpPanel />
                  </>
                )}
              </>
            )}

            {chatShown ? (
              <>
                <Handle label="Resize the conversation" onStart={startResize('chat')} />
                <div ref={chatRef} className="tw:flex tw:shrink-0 tw:flex-col tw:overflow-hidden tw:rounded-[14px] tw:bg-panel tw:shadow-hairline" style={{ width: chatWidth }}>
                  <AgentChat
                    vault={deck.source}
                    deck={deck}
                    context={{ slide: selectedIndex >= 0 ? selectedIndex : undefined, selection: selection?.text }}
                    beforeSend={beforeSend}
                    onCollapse={() => toggleChat(false)}
                    onRunningChange={setAgentRunning}
                  />
                </div>
              </>
            ) : (
              !deckReadOnly && (
                <>
                  <span className="tw:w-2.5 tw:shrink-0" />
                  <button
                    type="button"
                    onClick={() => toggleChat(true)}
                    aria-label="Show the conversation"
                    title="Show the conversation"
                    className="tw:flex tw:w-11 tw:shrink-0 tw:flex-col tw:items-center tw:gap-3 tw:rounded-[14px] tw:bg-panel tw:py-3.5 tw:text-fg-2 tw:shadow-hairline tw:hover:text-fg tw:[&_svg]:size-4"
                  >
                    <PanelRightOpen aria-hidden />
                    <Sparkles aria-hidden className="tw:text-agent" />
                    <span className="tw:text-[12px] tw:font-medium tw:[writing-mode:vertical-rl]">Agent</span>
                  </button>
                </>
              )
            )}
          </div>

          {selection && !readOnly && (
            <SelectionToolbar
              selection={selection}
              onWrap={(color) => {
                editorRef.current?.wrapSelection(`<Accent color="${color}">`, '</Accent>')
                setSelection(null)
              }}
            />
          )}
          <InsertPalette
            isOpen={palette !== null}
            filter={palette === 'add-slide' ? 'templates' : 'all'}
            target={target}
            theme={deckTheme}
            onClose={() => setPalette(null)}
            onInsert={(snippet) => (palette === 'add-slide' ? actions.addSlide(snippet) : editorRef.current?.insertAtCursor(snippet))}
          />
          <ImagePickerModal
            isOpen={imageProp !== null}
            deck={deck}
            defaultSource={defaultSource}
            onClose={() => setImageProp(null)}
            onSelect={(path) => imageProp && context.type === 'component' && applyText(setPropAt(text, context.tagStart, imageProp, path))}
          />
          <KeyboardShortcutsModal isOpen={shortcutsOpen} onClose={() => setShortcutsOpen(false)} mode="editor" />
        </div>
      </DeckLookContext.Provider>
    </DeckContext.Provider>
  )
}

/** A rounded panel of the workspace (the code and preview, the raw editor). */
function Pane({
  className,
  innerRef,
  row,
  children,
  ...events
}: {
  className?: string
  innerRef?: React.Ref<HTMLDivElement>
  row?: boolean
  children: ReactNode
} & Pick<React.HTMLAttributes<HTMLDivElement>, 'onDragOver' | 'onDragLeave' | 'onDrop'>) {
  return (
    <div ref={innerRef} className={cn('tw:relative tw:flex tw:overflow-hidden tw:rounded-[14px] tw:bg-panel tw:shadow-hairline', row ? 'tw:flex-row' : 'tw:flex-col', className)} {...events}>
      {children}
    </div>
  )
}

/** The gap between two panes, which drags to resize the one beside it. */
function Handle({ label, onStart }: { label: string; onStart(): void }) {
  return (
    <button type="button" aria-label={label} onMouseDown={onStart} className="tw:group tw:flex tw:w-2.5 tw:shrink-0 tw:cursor-col-resize tw:justify-center">
      <span className="tw:my-6 tw:w-0.5 tw:rounded-full tw:bg-transparent tw:transition-colors tw:group-hover:bg-focus" />
    </button>
  )
}
