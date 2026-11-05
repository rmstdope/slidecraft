import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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

export interface EditorPageProps {
  deck: DeckRef
  defaultSource?: string
  onExit(): void
}

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v))

/** What the work area shows: the slide, the code, or both side by side. */
export type WorkspaceView = 'preview' | 'code' | 'split'
const VIEWS: { id: WorkspaceView; label: string }[] = [
  { id: 'preview', label: 'Preview' },
  { id: 'code', label: 'Code' },
  { id: 'split', label: 'Split' },
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
const inField = (el: EventTarget | null) => el instanceof HTMLElement && (['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) || el.isContentEditable)

/**
 * The deck workspace (UX overhaul U3; the editor of Part 3 §2): the agent conversation, the slide
 * rail, and a work area showing the preview, the code or both. While the agent works the code is
 * read-only, and unsaved edits are saved before a message goes out.
 */
export default function EditorPage({ deck, defaultSource, onExit }: EditorPageProps) {
  const { state, actions, selected, selectedIndex, deckTheme, deckLook } = usePresentation(deck)
  const editorRef = useRef<SlideEditorHandle>(null)
  const containerRef = useRef<HTMLDivElement>(null)
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
    const onMove = (e: MouseEvent) => {
      const box = containerRef.current?.getBoundingClientRect()
      if (!resizing.current || !box) return
      const chat = chatShown ? chatWidth + 6 : 0
      if (resizing.current === 'chat') setChatWidth(clamp(e.clientX - box.left, 300, 640))
      else if (resizing.current === 'sidebar') setSidebarWidth(clamp(e.clientX - box.left - chat, 120, 400))
      else setEditorRatio(clamp((e.clientX - box.left - chat - sidebarWidth - 16) / (box.width - chat - sidebarWidth - 32 - (helpOpen ? 320 : 0)), 0.2, 0.8))
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
  }, [sidebarWidth, helpOpen, chatWidth, chatShown])
  const startResize = (which: 'sidebar' | 'editor' | 'chat') => () => {
    resizing.current = which
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }

  const deckContext = useMemo(() => ({ deck, resolveAsset: assetResolverFor(deck, defaultSource) }), [deck, defaultSource])

  if (state.isLoading && !state.model && !state.raw) return <div className="spinner" role="status" aria-label="Loading" />
  if (!state.model && !state.raw) {
    return (
      <div className="placeholder">
        <h1>Could not open {deckName(deck)}</h1>
        <pre className="error-text">{state.error}</pre>
        <button type="button" className="pill-button" onClick={onExit}>
          Go back
        </button>
      </div>
    )
  }

  return (
    <DeckContext.Provider value={deckContext}>
      {/* Every preview in the editor renders single slides, so the deck's defaults come from here. */}
      <DeckLookContext.Provider value={deckLook}>
        <div className="editor">
          <header className="editor-toolbar">
            <button type="button" className="editor-button" onClick={exit}>
              ← Exit
            </button>
            <span className="editor-toolbar__name">{deckName(deck)}</span>
            {state.isDirty && <span className="editor-chip is-accent">Unsaved</span>}
            {deckReadOnly && <span className="editor-chip">Read-only</span>}
            {agentRunning && <span className="editor-chip is-accent">Agent is editing</span>}
            {state.error && <span className="editor-chip is-danger" title={state.error}>Save failed</span>}
            <span className="editor-toolbar__spacer" />
            {state.model && (
              <label className="editor-toolbar__theme">
                Theme
                <select value={deckTheme ?? ''} disabled={readOnly} onChange={(e) => actions.setDeckTheme(e.target.value)}>
                  <option value="">Default (slidecraft)</option>
                  {themes
                    .filter((t) => t.id !== 'slidecraft')
                    .map((t) => (
                      <option key={`${t.source}:${t.id}`} value={t.id}>
                        {t.name}
                        {t.source !== 'builtin' ? ' (this folder)' : ''}
                      </option>
                    ))}
                </select>
              </label>
            )}
            {state.model && (
              <label className="editor-toolbar__theme" title="For slides that do not set their own scheme">
                Scheme
                <select value={deckLook.scheme ?? ''} disabled={readOnly} onChange={(e) => actions.setDeckDefault('scheme', e.target.value)}>
                  <option value="">Theme default ({theme.spec.defaults?.scheme ?? 'dark'})</option>
                  {(theme.spec.constraints?.schemes ?? ['dark', 'light']).map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {state.model && (
              <label className="editor-toolbar__theme" title="For slides that do not set their own accent">
                Accent
                <select value={deckLook.accent ?? ''} disabled={readOnly} onChange={(e) => actions.setDeckDefault('accent', e.target.value)}>
                  <option value="">Theme default ({theme.spec.defaults?.accent ?? 'yellow'})</option>
                  {SLIDE_ACCENTS.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <button type="button" className="editor-button" onClick={() => void present()}>
              ▶ Present
            </button>
            <div className="workspace-views" role="radiogroup" aria-label="Show">
              {VIEWS.map((v) => (
                <button key={v.id} type="button" role="radio" aria-checked={view === v.id} className={view === v.id ? 'is-active' : ''} onClick={() => chooseView(v.id)}>
                  {v.label}
                </button>
              ))}
            </div>
            {!readOnly && selected && (
              <button type="button" className="editor-button" onClick={() => applyText(formatMdx(text))}>
                Format
              </button>
            )}
            <button type="button" className={`editor-button${helpOpen ? ' is-active' : ''}`} onClick={() => setHelpOpen((h) => !h)}>
              Help
            </button>
            {!deckReadOnly && (
              <button type="button" className="editor-button is-primary" disabled={!state.isDirty || state.isSaving || agentRunning} onClick={() => void actions.save()}>
                {state.isSaving ? 'Saving…' : 'Save (⌘S)'}
              </button>
            )}
          </header>

          <div className="workspace-body" ref={containerRef}>
          {chatShown ? (
            <>
              <div className="workspace-chat" style={{ width: chatWidth }}>
                <AgentChat
                  vault={deck.source}
                  deck={deck}
                  context={{ slide: selectedIndex >= 0 ? selectedIndex : undefined, selection: selection?.text }}
                  beforeSend={beforeSend}
                  onCollapse={() => toggleChat(false)}
                  onRunningChange={setAgentRunning}
                />
              </div>
              <div className="editor-handle" onMouseDown={startResize('chat')} />
            </>
          ) : (
            !deckReadOnly && (
              <button type="button" className="workspace-chat-tab" onClick={() => toggleChat(true)} aria-label="Show the conversation">
                Agent ⟩
              </button>
            )
          )}
          {state.raw ? (
            <div className="editor-raw">
              <div className="editor-raw__banner" role="alert">
                <strong>This file does not parse</strong> ({state.raw.error}). Edit it as one text; switch back to slides once it parses.
                <button type="button" className="editor-button" onClick={actions.tryStructured}>
                  Back to slides
                </button>
              </div>
              <div className="editor-raw__code">
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
            </div>
          ) : (
            <div className="editor-body">
              <div style={{ width: sidebarWidth, flex: '0 0 auto', display: 'flex' }}>
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
              <div className="editor-handle" onMouseDown={startResize('sidebar')} />
              <div
                className="editor-work"
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
              >
                {view !== 'preview' && (
                <div className="editor-code" style={{ flex: view === 'split' ? editorRatio : 1 }}>
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
                  <div className="editor-code__monaco">
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
                      <div className="editor-still__placeholder">Select a slide to edit</div>
                    )}
                  </div>
                </div>
                )}
                {view === 'split' && <div className="editor-handle" onMouseDown={startResize('editor')} />}
                {view !== 'code' && (
                  <div className="editor-preview" style={{ flex: view === 'split' ? 1 - editorRatio : 1 }}>
                    {selected ? <SlidePreview source={selected.text} target={target} theme={deckTheme} /> : <div className="editor-still__placeholder">No slide selected</div>}
                  </div>
                )}
                {dragging && <div className="editor-overlay is-drop">Drop image here</div>}
                {uploading && <div className="editor-overlay">Uploading image…</div>}
              </div>
              {helpOpen && <HelpPanel />}
            </div>
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
