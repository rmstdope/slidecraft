import { useEffect, useMemo, useState, type ComponentType, type ReactNode } from 'react'
import { AnimatePresence, motion, MotionConfig } from 'motion/react'
import { BUILT_IN_SOURCE_ID } from '@shared/decks.ts'
import { StepContext } from '../animations/stepContext'
import { SlideThumbnail } from '../components/editor/SlideThumbnail'
import { PreviewErrorBoundary } from '../components/ErrorBoundary'
import { SLIDE_ACCENTS } from '../components/slides/accents'
import { getAllComponents, getAllTemplates, getParts, getTopLevelComponents, ownerName, type RegistryConfig, type RegistryProp } from '../components/slides/defineComponent'
import { DESIGN_HEIGHT, DESIGN_WIDTH } from '../components/slides/Slide'
import { StageScaleContext } from '../components/slides/thumbnailContext'
import { useInView } from '../hooks/useInView'
import { BUILTIN_SOURCE, listAllThemes, resolveTheme, type ResolvedTheme, type ThemeSummary } from '../themes/registry'
import { ThemeContext, useThemesVersion } from '../themes/ThemeContext'
import {
  applyProps,
  applySettings,
  controlInput,
  controlValue,
  DEFAULT_SETTINGS,
  propControls,
  readProps,
  sameSettings,
  type GallerySettings,
  type PropControl,
  type PropValues,
} from './previewSettings'
import { countPreviewSteps } from './previewSteps'
import { searchItems } from './search'
import { useLazyPreview } from './useLazyPreview'

type Tab = 'all' | 'component' | 'template'

const TABS: { value: Tab; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'component', label: 'Components' },
  { value: 'template', label: 'Templates' },
]

// v2: previews start dark; settings saved before that carry the old default and are dropped.
const SETTINGS_KEY = 'slidecraft.gallery.preview.v2'

/** One card per top-level component and template; parts (SignalNode…) live in their parent's card. */
const allItems = (): RegistryConfig[] => [...getTopLevelComponents().map((c) => c.registry), ...getAllTemplates()]
const allParts = (): RegistryConfig[] => getAllComponents().map((c) => c.registry).filter((r) => r.parent)
const toolbarOf = (name: string) => getAllComponents().find((c) => c.registry.name === name)?.toolbar
const OWN = "Example's own"
const OWN_TIP = 'Use what each example was written with'
const title = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).replace(/-/g, ' ')

function loadSettings(): GallerySettings {
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}') }
  } catch {
    return DEFAULT_SETTINGS
  }
}

function saveSettings(settings: GallerySettings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  } catch {
    // Private windows may refuse storage; the gallery still works for this visit.
  }
}

const themeKey = (t: Pick<ThemeSummary, 'source' | 'id'>) => `${t.source}:${t.id}`

/** Theme groups by where they come from: the app, this repository's example content, a content folder. */
const sourceLabel = (source: string) => (source === BUILTIN_SOURCE ? 'Ships with Slidecraft' : source === BUILT_IN_SOURCE_ID ? 'Example content' : `Content: ${source}`)

/** The theme a "<source>:<id>" key names, if it is still registered. */
function chosenTheme(key: string, themes: ThemeSummary[]): ResolvedTheme | undefined {
  const summary = key ? themes.find((t) => themeKey(t) === key) : undefined
  return summary ? resolveTheme(summary.id, summary.source) : undefined
}

/** The chosen theme around a preview; examples keep their own theme when none is chosen. */
function Themed({ theme, children }: { theme?: ResolvedTheme; children: ReactNode }) {
  return theme ? <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider> : <>{children}</>
}

/** A registry preview compiled on demand (four at a time) and shown as a still. */
function PreviewFrame({ source, width, theme, eager = false }: { source: string; width: number; theme?: ResolvedTheme; eager?: boolean }) {
  const [ref, inView] = useInView<HTMLDivElement>()
  const { Component, error, isCompiling } = useLazyPreview(source, eager || inView)
  return (
    <div ref={ref} className="preview-frame" style={{ width, height: Math.round((width * DESIGN_HEIGHT) / DESIGN_WIDTH) }}>
      {Component ? (
        <Themed theme={theme}>
          <SlideThumbnail scale={width / DESIGN_WIDTH}>
            <Component />
          </SlideThumbnail>
        </Themed>
      ) : (
        <PreviewStatus error={error} isCompiling={isCompiling} />
      )}
    </div>
  )
}

function PreviewStatus({ error, isCompiling }: { error: string | null; isCompiling: boolean }) {
  return (
    <span className={error ? 'preview-frame__error' : 'preview-frame__wait'} title={error ?? undefined}>
      {error ? 'Preview error' : isCompiling ? 'Rendering…' : ''}
    </span>
  )
}

/** A preview running as on a real slide: motion plays, build steps are walked with the buttons. */
function LiveStage({ Component, width, theme, step, total, replay }: { Component: ComponentType; width: number; theme?: ResolvedTheme; step: number; total: number; replay: number }) {
  const scale = width / DESIGN_WIDTH
  return (
    <div className="preview-frame" style={{ width, height: Math.round(DESIGN_HEIGHT * scale) }}>
      <div style={{ position: 'absolute', left: 0, top: 0, width: DESIGN_WIDTH, height: DESIGN_HEIGHT, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
        <Themed theme={theme}>
          <StageScaleContext.Provider value={1}>
            <MotionConfig reducedMotion="user">
              <StepContext.Provider value={{ step, total }}>
                <PreviewErrorBoundary key={replay}>
                  <Component />
                </PreviewErrorBoundary>
              </StepContext.Provider>
            </MotionConfig>
          </StageScaleContext.Provider>
        </Themed>
      </div>
    </div>
  )
}

function GalleryCard({ item, settings, theme, onOpen }: { item: RegistryConfig; settings: GallerySettings; theme?: ResolvedTheme; onOpen(): void }) {
  const source = useMemo(() => applySettings(item.previewCode, settings), [item.previewCode, settings])
  return (
    <button type="button" className="gallery-card" onClick={onOpen}>
      <PreviewFrame source={source} width={360} theme={theme} />
      <span className="gallery-card__caption">
        <span className="gallery-card__name">{item.name}</span>
        <span className="gallery-card__category">{item.category}</span>
        <span className="gallery-card__description">{item.description}</span>
      </span>
    </button>
  )
}

/** Commits on blur or Enter, so a half-typed value never recompiles the preview. */
function CommitInput({ value, type, min, max, step, placeholder, onCommit }: { value: string; type: 'text' | 'number'; min?: number; max?: number; step?: number; placeholder?: string; onCommit(v: string): void }) {
  const [local, setLocal] = useState(value)
  useEffect(() => setLocal(value), [value])
  return (
    <input
      className="gallery-prop__input"
      type={type}
      value={local}
      min={min}
      max={max}
      step={step}
      placeholder={placeholder}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => local !== value && onCommit(local)}
      onKeyDown={(e) => {
        e.stopPropagation()
        if (e.key === 'Enter') onCommit(local)
      }}
    />
  )
}

function PropField({ control, value, onChange }: { control: PropControl; value: ReturnType<typeof controlInput>; onChange(input: string | boolean): void }) {
  const { prop } = control
  const label = (
    <span className="gallery-prop__name" title={prop.description}>
      {prop.name}
    </span>
  )
  if (control.kind === 'boolean') {
    return (
      <div className="gallery-prop">
        {label}
        <button type="button" className={`gallery-toggle${value ? ' is-on' : ''}`} aria-pressed={value === true} onClick={() => onChange(!value)}>
          {value ? 'On' : 'Off'}
        </button>
      </div>
    )
  }
  if (control.kind === 'select') {
    return (
      <label className="gallery-prop">
        {label}
        <select className="gallery-prop__input" value={String(value)} onChange={(e) => onChange(e.target.value)}>
          <option value="">{prop.default ? `Default (${prop.default.replace(/"/g, '')})` : '—'}</option>
          {control.options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </label>
    )
  }
  return (
    <label className="gallery-prop">
      {label}
      <CommitInput
        type={control.kind === 'number' ? 'number' : 'text'}
        value={String(value)}
        min={control.kind === 'number' ? control.min : undefined}
        max={control.kind === 'number' ? control.max : undefined}
        step={control.kind === 'number' ? control.step : undefined}
        placeholder={prop.default ? prop.default.replace(/"/g, '') : ''}
        onCommit={onChange}
      />
    </label>
  )
}

function PropsTable({ props }: { props: RegistryProp[] }) {
  if (props.length === 0) return <p className="muted">No props.</p>
  return (
    <table className="gallery-detail__props">
      <thead>
        <tr>
          <th>Prop</th>
          <th>Type</th>
          <th>Default</th>
        </tr>
      </thead>
      <tbody>
        {props.map((p) => (
          <tr key={p.name} title={p.description}>
            <td>
              <code>{p.name}</code>
            </td>
            <td>
              <code>{p.type}</code>
            </td>
            <td>{p.default ? <code>{p.default}</code> : '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function DetailPanel({ item, settings, theme, onClose }: { item: RegistryConfig; settings: GallerySettings; theme?: ResolvedTheme; onClose(): void }) {
  const [copied, setCopied] = useState(false)
  // Settings per component: the item itself and each of its parts.
  const [values, setValues] = useState<Record<string, PropValues>>({})
  const [step, setStep] = useState(0)
  const [replay, setReplay] = useState(0)
  const isComponent = item.category === 'component'
  const groups = useMemo(
    () =>
      isComponent
        ? [item, ...getParts(item.name).map((p) => p.registry)]
            .map((r) => ({ registry: r, controls: propControls(r, toolbarOf(r.name)), written: readProps(item.previewCode, r.name) }))
            .filter((g) => g.controls.length > 0)
        : [],
    [item, isComponent],
  )
  const withValues = (code: string) => Object.entries(values).reduce((text, [name, v]) => applyProps(text, name, v), code)
  const source = useMemo(() => applySettings(withValues(item.previewCode), settings), [item, values, settings])
  const snippet = useMemo(() => applySettings(withValues(item.snippet), settings), [item, values, settings])
  const { Component, error, isCompiling } = useLazyPreview(source, true)
  const total = useMemo(() => (Component ? countPreviewSteps(Component) : 0), [Component])

  // A new preview starts again from its first beat.
  useEffect(() => setStep(0), [source])

  useEffect(() => {
    if (!copied) return
    const t = setTimeout(() => setCopied(false), 1500)
    return () => clearTimeout(t)
  }, [copied])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return
      if (e.key === 'ArrowRight' && step < total) setStep(step + 1)
      else if (e.key === 'ArrowLeft' && step > 0) setStep(step - 1)
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [step, total])

  const copy = () => {
    void navigator.clipboard?.writeText(snippet).then(() => setCopied(true))
  }
  const restart = () => {
    setStep(0)
    setReplay((n) => n + 1)
  }
  const changed = Object.values(values).some((v) => Object.keys(v).length > 0)

  return (
    <motion.div className="tool-scrim" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
      <motion.section
        className="gallery-detail"
        role="dialog"
        aria-label={item.name}
        onClick={(e) => e.stopPropagation()}
        initial={{ scale: 0.97 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0.97 }}
        transition={{ duration: 0.15 }}
      >
        <header className="gallery-detail__header">
          <div>
            <h2>{item.name}</h2>
            <p>{item.description}</p>
          </div>
          <button type="button" className="tool-button" onClick={onClose}>
            Close (Esc)
          </button>
        </header>
        {Component ? (
          <LiveStage Component={Component} width={760} theme={theme} step={step} total={total} replay={replay} />
        ) : (
          <div className="preview-frame" style={{ width: 760, height: Math.round((760 * DESIGN_HEIGHT) / DESIGN_WIDTH) }}>
            <PreviewStatus error={error} isCompiling={isCompiling} />
          </div>
        )}
        <div className="gallery-stage-bar">
          <button type="button" className="tool-button" onClick={restart}>
            Replay
          </button>
          {total > 0 && (
            <div className="gallery-steps" role="group" aria-label="Build steps">
              <button type="button" className="tool-button" disabled={step === 0} onClick={() => setStep(step - 1)} aria-label="Previous step">
                ←
              </button>
              <span>
                Step {step} of {total}
              </span>
              <button type="button" className="tool-button" disabled={step >= total} onClick={() => setStep(step + 1)} aria-label="Next step">
                →
              </button>
            </div>
          )}
          {error && Component && <span className="preview-frame__error-inline">{error}</span>}
        </div>
        {groups.length > 0 && (
          <>
            <div className="gallery-detail__snippet-head">
              <h3>Settings</h3>
              <button type="button" className="tool-button" disabled={!changed} onClick={() => setValues({})}>
                Reset
              </button>
            </div>
            {groups.map(({ registry, controls, written }) => {
              const own = values[registry.name] ?? {}
              return (
                <div key={registry.name} className="gallery-props-group">
                  {/* A part's settings change its first element in the example. */}
                  {registry.parent && <h4 className="gallery-props-group__name">{registry.name} (first in the example)</h4>}
                  <div className="gallery-props">
                    {controls.map((control) => {
                      const name = control.prop.name
                      const current = name in own ? (own[name] ?? undefined) : written[name]
                      return (
                        <PropField
                          key={name}
                          control={control}
                          value={controlInput(control, current)}
                          onChange={(input) => setValues((v) => ({ ...v, [registry.name]: { ...(v[registry.name] ?? {}), [name]: controlValue(control, input) } }))}
                        />
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </>
        )}
        {item.useCases && item.useCases.length > 0 && (
          <>
            <h3>Use it for</h3>
            <ul className="gallery-detail__uses">
              {item.useCases.map((u) => (
                <li key={u}>{u}</li>
              ))}
            </ul>
          </>
        )}
        {isComponent && (
          <>
            <h3>Props</h3>
            <PropsTable props={item.props} />
            {getParts(item.name).map(({ registry: part }) => (
              <div key={part.id} className="gallery-part">
                <h3>
                  Part: <code>{part.name}</code>
                </h3>
                <p className="gallery-part__description">{part.description}</p>
                <PropsTable props={part.props} />
              </div>
            ))}
          </>
        )}
        <div className="gallery-detail__snippet-head">
          <h3>Snippet</h3>
          <button type="button" className="tool-button" onClick={copy}>
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
        <pre className="gallery-detail__snippet">{snippet}</pre>
      </motion.section>
    </motion.div>
  )
}

/** Theme, scheme, accent and frame for every preview in the gallery. */
function SettingsBar({ settings, themes, theme, onChange }: { settings: GallerySettings; themes: ThemeSummary[]; theme?: ResolvedTheme; onChange(next: GallerySettings): void }) {
  const spec = (theme ?? resolveTheme()).spec
  const allowed = spec.constraints?.schemes
  const frames = theme ? Object.keys(spec.frames ?? {}) : []
  const accents = spec.tokens?.accents ?? {}
  const swatch = (accent: (typeof SLIDE_ACCENTS)[number]) => (accent === 'navy' && settings.scheme !== 'light' ? (accents.navyOnDark ?? accents.navy) : accents[accent])
  const sources = [...new Set(themes.map((t) => t.source))]
  const set = (patch: Partial<GallerySettings>) => onChange({ ...settings, ...patch })
  const changed = !sameSettings(settings, DEFAULT_SETTINGS)
  return (
    <div className="gallery-settings" role="group" aria-label="Preview settings">
      <label className="gallery-settings__field">
        <span>Theme</span>
        <select
          value={settings.theme}
          onChange={(e) => {
            const next = chosenTheme(e.target.value, themes)
            const schemes = next?.spec.constraints?.schemes
            // Keep only what the new theme supports: its schemes (else its first) and its frames.
            set({
              theme: e.target.value,
              scheme: settings.scheme && schemes?.length && !schemes.includes(settings.scheme) ? schemes[0] : settings.scheme,
              frame: settings.frame && settings.frame !== 'none' && !next?.spec.frames?.[settings.frame] ? '' : settings.frame,
            })
          }}
        >
          <option value="" title={OWN_TIP}>
            {OWN}
          </option>
          {sources.map((source) => (
            <optgroup key={source} label={sourceLabel(source)}>
              {themes
                .filter((t) => t.source === source)
                .map((t) => (
                  <option key={themeKey(t)} value={themeKey(t)}>
                    {t.name}
                  </option>
                ))}
            </optgroup>
          ))}
        </select>
      </label>
      <div className="gallery-settings__field">
        <span>Scheme</span>
        <div className="gallery-seg">
          {(['', 'dark', 'light'] as const).map((s) => (
            <button
              key={s || 'own'}
              type="button"
              aria-pressed={settings.scheme === s}
              title={s ? undefined : OWN_TIP}
              disabled={!!s && !!allowed?.length && !allowed.includes(s)}
              onClick={() => set({ scheme: s })}
            >
              {s ? title(s) : OWN}
            </button>
          ))}
        </div>
        {theme && allowed?.length === 1 && (
          <span className="gallery-settings__note">
            {spec.name} is {allowed[0]} only
          </span>
        )}
      </div>
      <div className="gallery-settings__field">
        <span>Accent</span>
        <div className="gallery-seg">
          <button type="button" aria-pressed={settings.accent === ''} title={OWN_TIP} onClick={() => set({ accent: '' })}>
            {OWN}
          </button>
          {SLIDE_ACCENTS.map((a) => (
            <button key={a} type="button" aria-pressed={settings.accent === a} onClick={() => set({ accent: a })} title={a}>
              <i className="gallery-chip" style={{ background: swatch(a) }} aria-hidden />
              {title(a)}
            </button>
          ))}
        </div>
      </div>
      {frames.length > 0 && (
        <label className="gallery-settings__field">
          <span>Frame</span>
          <select value={settings.frame} onChange={(e) => set({ frame: e.target.value })}>
            <option value="" title={OWN_TIP}>
              {OWN}
            </option>
            <option value="none">None</option>
            {frames.map((f) => (
              <option key={f} value={f}>
                {title(f)}
              </option>
            ))}
          </select>
        </label>
      )}
      <button type="button" className="tool-button gallery-settings__reset" disabled={!changed} onClick={() => onChange(DEFAULT_SETTINGS)}>
        Reset
      </button>
    </div>
  )
}

/** Every component and template with a live preview (Part 3 §7). */
export default function GalleryPage({ onExit }: { onExit(): void }) {
  const [query, setQuery] = useState('')
  const [tab, setTab] = useState<Tab>('all')
  const [open, setOpen] = useState<RegistryConfig | null>(null)
  const [settings, setSettings] = useState<GallerySettings>(loadSettings)
  const version = useThemesVersion()
  // Content-folder themes register after load; the version re-lists them.
  const themes = useMemo(() => (version >= 0 ? listAllThemes() : []), [version])
  const theme = chosenTheme(settings.theme, themes)
  // A theme that has gone (a content folder changed) falls back to each example's own.
  const effective = useMemo(() => (settings.theme && !theme ? { ...settings, theme: '', frame: '' } : settings), [settings, theme])
  const items = useMemo(allItems, [])
  const parts = useMemo(allParts, [])
  const visible = useMemo(() => {
    // A search that finds a part (SignalNode) shows its parent's card.
    const owners = new Set(searchItems(parts, query).map(ownerName))
    const found = new Set(searchItems(items, query).map((i) => i.name))
    return items.filter((i) => (found.has(i.name) || owners.has(i.name)) && (tab === 'all' || i.category === tab)).sort((a, b) => a.name.localeCompare(b.name))
  }, [items, parts, query, tab])
  const groups = [
    { label: 'Components', items: visible.filter((i) => i.category === 'component') },
    { label: 'Templates', items: visible.filter((i) => i.category === 'template') },
  ].filter((g) => g.items.length > 0)

  const changeSettings = (next: GallerySettings) => {
    setSettings(next)
    saveSettings(next)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (open) setOpen(null)
      else if (!(e.target instanceof HTMLInputElement && e.target.value)) onExit()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onExit])

  return (
    <div className="gallery">
      <header className="gallery-header">
        <button type="button" className="tool-button" onClick={onExit}>
          ← Home
        </button>
        <h1>Component Gallery</h1>
        <input className="gallery-header__search" type="search" placeholder="Search components and templates…" value={query} autoFocus onChange={(e) => setQuery(e.target.value)} />
        <nav className="gallery-tabs">
          {TABS.map((t) => (
            <button key={t.value} type="button" className={tab === t.value ? 'is-active' : ''} onClick={() => setTab(t.value)}>
              {t.label}
            </button>
          ))}
        </nav>
        <span className="gallery-header__count">
          {visible.length} of {items.length}
        </span>
        <SettingsBar settings={effective} themes={themes} theme={theme} onChange={changeSettings} />
      </header>
      <main className="gallery-main">
        {groups.length === 0 && <p className="home-empty">Nothing matches “{query}”.</p>}
        {groups.map((g) => (
          <section key={g.label}>
            <h2 className="gallery-section">
              {g.label} ({g.items.length})
            </h2>
            <div className="gallery-grid">
              {g.items.map((item) => (
                <GalleryCard key={item.id} item={item} settings={effective} theme={theme} onOpen={() => setOpen(item)} />
              ))}
            </div>
          </section>
        ))}
      </main>
      <AnimatePresence>{open && <DetailPanel key={open.id} item={open} settings={effective} theme={theme} onClose={() => setOpen(null)} />}</AnimatePresence>
    </div>
  )
}
