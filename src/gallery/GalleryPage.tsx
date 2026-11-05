import { useEffect, useMemo, useState, type ComponentType, type ReactNode } from 'react'
import { AnimatePresence, MotionConfig } from 'motion/react'
import { ArrowLeft, Copy, RotateCcw, Search } from 'lucide-react'
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
import { Badge, Button, cn, NativeSelect, SegmentedControl, Sheet } from '../ui'

/** A preview's frame: black behind the slide, rounded, a hairline in either theme. */
const frameClass = 'tw:relative tw:shrink-0 tw:overflow-hidden tw:rounded-md tw:bg-black tw:shadow-hairline'
const h3Class = 'tw:text-[13px] tw:font-semibold tw:tracking-wide tw:text-muted tw:uppercase'

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
const sourceLabel = (source: string) => (source === BUILTIN_SOURCE ? 'Ships with Slidecraft' : source === BUILT_IN_SOURCE_ID ? 'Example content' : 'This vault')

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
    <div ref={ref} className={frameClass} style={{ width, height: Math.round((width * DESIGN_HEIGHT) / DESIGN_WIDTH) }}>
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
    <span className={cn('tw:absolute tw:inset-0 tw:grid tw:place-items-center tw:text-[12px]', error ? 'tw:text-removed' : 'tw:text-white/60')} title={error ?? undefined}>
      {error ? 'Preview error' : isCompiling ? 'Rendering…' : ''}
    </span>
  )
}

/** A preview running as on a real slide: motion plays, build steps are walked with the buttons. */
function LiveStage({ Component, width, theme, step, total, replay }: { Component: ComponentType; width: number; theme?: ResolvedTheme; step: number; total: number; replay: number }) {
  const scale = width / DESIGN_WIDTH
  return (
    <div className={cn(frameClass, 'tw:self-center')} style={{ width, height: Math.round(DESIGN_HEIGHT * scale) }}>
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
    <button type="button" className="tw:group tw:flex tw:w-[380px] tw:max-w-full tw:flex-col tw:gap-2.5 tw:rounded-xl tw:bg-field tw:p-2.5 tw:text-left tw:transition-shadow tw:hover:shadow-[0_0_0_2px_var(--sc-focus)]" onClick={onOpen}>
      <PreviewFrame source={source} width={360} theme={theme} />
      <span className="tw:flex tw:flex-col tw:gap-0.5 tw:px-1 tw:pb-1">
        <span className="tw:flex tw:items-center tw:gap-2">
          <span className="tw:font-semibold">{item.name}</span>
          <Badge className="tw:h-5 tw:bg-panel">{item.category}</Badge>
        </span>
        <span className="tw:line-clamp-2 tw:text-[13px] tw:text-muted">{item.description}</span>
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
      className="tw:h-8 tw:w-full tw:min-w-0 tw:rounded-md tw:border-0 tw:bg-field tw:px-2.5 tw:text-[13px] tw:text-fg tw:outline-none tw:placeholder:text-muted tw:focus-visible:shadow-[0_0_0_2px_var(--sc-focus)]"
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
    <span className="tw:truncate tw:font-mono tw:text-[12px] tw:text-fg-2" title={prop.description}>
      {prop.name}
    </span>
  )
  if (control.kind === 'boolean') {
    return (
      <div className="tw:flex tw:flex-col tw:gap-1">
        {label}
        <button
          type="button"
          className={cn('tw:h-8 tw:rounded-md tw:text-[13px] tw:font-medium', value ? 'tw:bg-primary tw:text-on-primary' : 'tw:bg-field tw:text-fg-2')}
          aria-pressed={value === true}
          onClick={() => onChange(!value)}
        >
          {value ? 'On' : 'Off'}
        </button>
      </div>
    )
  }
  if (control.kind === 'select') {
    return (
      <label className="tw:flex tw:flex-col tw:gap-1">
        {label}
        <NativeSelect className="tw:w-full" value={String(value)} onChange={(e) => onChange(e.target.value)}>
          <option value="">{prop.default ? `Default (${prop.default.replace(/"/g, '')})` : '—'}</option>
          {control.options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </NativeSelect>
      </label>
    )
  }
  return (
    <label className="tw:flex tw:flex-col tw:gap-1">
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
  if (props.length === 0) return <p className="tw:text-muted">No props.</p>
  return (
    <table className="tw:w-full tw:border-collapse tw:text-left tw:text-[13px] tw:[&_td]:border-t tw:[&_td]:border-line tw:[&_td]:py-1.5 tw:[&_td]:pr-3 tw:[&_td]:align-top tw:[&_code]:font-mono tw:[&_code]:text-[12px]">
      <thead className="tw:text-[12px] tw:text-muted">
        <tr>
          <th className="tw:py-1.5 tw:font-medium">Prop</th>
          <th className="tw:py-1.5 tw:font-medium">Type</th>
          <th className="tw:py-1.5 tw:font-medium">Default</th>
        </tr>
      </thead>
      <tbody>
        {props.map((p) => (
          <tr key={p.name} title={p.description}>
            <td>
              <code className="tw:text-fg">{p.name}</code>
            </td>
            <td>
              <code className="tw:break-all tw:text-fg-2">{p.type}</code>
            </td>
            <td className="tw:text-fg-2">{p.default ? <code>{p.default}</code> : '—'}</td>
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
    <Sheet label={item.name} onClose={onClose} className="tw:max-w-[840px] tw:gap-5 tw:p-6">
      <header className="tw:flex tw:items-start tw:gap-4">
        <div className="tw:flex tw:flex-1 tw:flex-col tw:gap-1">
          <h2 className="tw:font-display tw:text-[28px] tw:leading-tight tw:font-semibold">{item.name}</h2>
          <p className="tw:text-fg-2">{item.description}</p>
        </div>
        <Button size="sm" onClick={onClose}>
          Close (Esc)
        </Button>
      </header>
      {Component ? (
        <LiveStage Component={Component} width={760} theme={theme} step={step} total={total} replay={replay} />
      ) : (
        <div className={cn(frameClass, 'tw:self-center')} style={{ width: 760, maxWidth: '100%', height: Math.round((760 * DESIGN_HEIGHT) / DESIGN_WIDTH) }}>
          <PreviewStatus error={error} isCompiling={isCompiling} />
        </div>
      )}
      <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-3">
        <Button size="sm" onClick={restart}>
          <RotateCcw aria-hidden />
          Replay
        </Button>
        {total > 0 && (
          <div className="tw:flex tw:items-center tw:gap-2" role="group" aria-label="Build steps">
            <Button size="icon-sm" disabled={step === 0} onClick={() => setStep(step - 1)} aria-label="Previous step">
              ←
            </Button>
            <span className="tw:text-[13px] tw:text-fg-2">
              Step {step} of {total}
            </span>
            <Button size="icon-sm" disabled={step >= total} onClick={() => setStep(step + 1)} aria-label="Next step">
              →
            </Button>
          </div>
        )}
        {error && Component && <span className="tw:text-[12px] tw:text-removed">{error}</span>}
      </div>
      {groups.length > 0 && (
        <section className="tw:flex tw:flex-col tw:gap-3">
          <div className="tw:flex tw:items-center tw:justify-between">
            <h3 className={h3Class}>Settings</h3>
            <Button size="sm" variant="ghost" disabled={!changed} onClick={() => setValues({})}>
              Reset
            </Button>
          </div>
          {groups.map(({ registry, controls, written }) => {
            const own = values[registry.name] ?? {}
            return (
              <div key={registry.name} className="tw:flex tw:flex-col tw:gap-2">
                {/* A part's settings change its first element in the example. */}
                {registry.parent && <h4 className="tw:text-[13px] tw:font-semibold">{registry.name} (first in the example)</h4>}
                <div className="tw:grid tw:grid-cols-[repeat(auto-fill,minmax(160px,1fr))] tw:gap-3">
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
        </section>
      )}
      {item.useCases && item.useCases.length > 0 && (
        <section className="tw:flex tw:flex-col tw:gap-2">
          <h3 className={h3Class}>Use it for</h3>
          <ul className="tw:list-disc tw:pl-5 tw:text-fg-2">
            {item.useCases.map((u) => (
              <li key={u}>{u}</li>
            ))}
          </ul>
        </section>
      )}
      {isComponent && (
        <section className="tw:flex tw:flex-col tw:gap-2">
          <h3 className={h3Class}>Props</h3>
          <PropsTable props={item.props} />
          {getParts(item.name).map(({ registry: part }) => (
            <div key={part.id} className="tw:mt-3 tw:flex tw:flex-col tw:gap-2">
              <h3 className="tw:font-semibold">
                Part: <code className="tw:font-mono">{part.name}</code>
              </h3>
              <p className="tw:text-[13px] tw:text-muted">{part.description}</p>
              <PropsTable props={part.props} />
            </div>
          ))}
        </section>
      )}
      <section className="tw:flex tw:flex-col tw:gap-2">
        <div className="tw:flex tw:items-center tw:justify-between">
          <h3 className={h3Class}>Snippet</h3>
          <Button size="sm" variant="ghost" onClick={copy}>
            <Copy aria-hidden />
            {copied ? 'Copied' : 'Copy'}
          </Button>
        </div>
        <pre className="tw:m-0 tw:overflow-x-auto tw:rounded-lg tw:bg-field tw:p-3.5 tw:font-mono tw:text-[12.5px] tw:whitespace-pre-wrap tw:text-fg-2">{snippet}</pre>
      </section>
    </Sheet>
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
  const seg = (on: boolean) => cn('tw:inline-flex tw:h-7 tw:items-center tw:gap-1.5 tw:rounded-md tw:px-2.5 tw:text-[12px] tw:font-medium tw:text-fg-2 tw:disabled:opacity-40', on && 'tw:bg-panel tw:text-fg tw:shadow-hairline')
  const fieldClass = 'tw:flex tw:items-center tw:gap-2 tw:text-[12px] tw:text-muted'
  return (
    <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-x-5 tw:gap-y-2.5" role="group" aria-label="Preview settings">
      <label className={fieldClass}>
        <span>Theme</span>
        <NativeSelect
          size="sm"
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
        </NativeSelect>
      </label>
      <div className={fieldClass}>
        <span>Scheme</span>
        <div className="tw:inline-flex tw:rounded-lg tw:bg-field tw:p-0.5">
          {(['', 'dark', 'light'] as const).map((sch) => (
            <button
              key={sch || 'own'}
              type="button"
              className={seg(settings.scheme === sch)}
              aria-pressed={settings.scheme === sch}
              title={sch ? undefined : OWN_TIP}
              disabled={!!sch && !!allowed?.length && !allowed.includes(sch)}
              onClick={() => set({ scheme: sch })}
            >
              {sch ? title(sch) : OWN}
            </button>
          ))}
        </div>
        {theme && allowed?.length === 1 && (
          <span>
            {spec.name} is {allowed[0]} only
          </span>
        )}
      </div>
      <div className={fieldClass}>
        <span>Accent</span>
        <div className="tw:inline-flex tw:flex-wrap tw:rounded-lg tw:bg-field tw:p-0.5">
          <button type="button" className={seg(settings.accent === '')} aria-pressed={settings.accent === ''} title={OWN_TIP} onClick={() => set({ accent: '' })}>
            {OWN}
          </button>
          {SLIDE_ACCENTS.map((a) => (
            <button key={a} type="button" className={seg(settings.accent === a)} aria-pressed={settings.accent === a} onClick={() => set({ accent: a })} title={a}>
              <i className="tw:size-2.5 tw:rounded-full" style={{ background: swatch(a) }} aria-hidden />
              {title(a)}
            </button>
          ))}
        </div>
      </div>
      {frames.length > 0 && (
        <label className={fieldClass}>
          <span>Frame</span>
          <NativeSelect size="sm" value={settings.frame} onChange={(e) => set({ frame: e.target.value })}>
            <option value="" title={OWN_TIP}>
              {OWN}
            </option>
            <option value="none">None</option>
            {frames.map((f) => (
              <option key={f} value={f}>
                {title(f)}
              </option>
            ))}
          </NativeSelect>
        </label>
      )}
      <Button size="sm" variant="ghost" disabled={!changed} onClick={() => onChange(DEFAULT_SETTINGS)}>
        Reset
      </Button>
    </div>
  )
}

/** Every component and template with a live preview (Part 3 §7). */
/** The component gallery of one vault: built-in themes plus the vault's own. */
export default function GalleryPage({ vault, onExit }: { vault?: string; onExit(): void }) {
  const [query, setQuery] = useState('')
  const [tab, setTab] = useState<Tab>('all')
  const [open, setOpen] = useState<RegistryConfig | null>(null)
  const [settings, setSettings] = useState<GallerySettings>(loadSettings)
  const version = useThemesVersion()
  // Content-folder themes register after load; the version re-lists them.
  const themes = useMemo(() => (version >= 0 ? listAllThemes().filter((t) => !vault || t.source === BUILTIN_SOURCE || t.source === vault) : []), [version, vault])
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
    <div className="sc-app tw:h-full tw:overflow-y-auto tw:bg-ground">
      <header className="tw:sticky tw:top-0 tw:z-10 tw:flex tw:flex-col tw:gap-3 tw:border-b tw:border-line tw:bg-ground/90 tw:px-6 tw:py-4 tw:backdrop-blur-md">
        <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-3">
          <Button size="icon" onClick={onExit} aria-label="Back to presentations" title="Back to presentations">
            <ArrowLeft aria-hidden />
          </Button>
          <h1 className="tw:font-display tw:text-[28px] tw:leading-none tw:font-semibold">Component Gallery</h1>
          <span className="tw:flex-1" />
          <label className="tw:flex tw:h-9 tw:w-[300px] tw:max-w-full tw:items-center tw:gap-2 tw:rounded-[9px] tw:bg-field tw:px-2.5 tw:focus-within:shadow-[0_0_0_2px_var(--sc-focus)]">
            <Search className="tw:size-4 tw:shrink-0 tw:text-muted" aria-hidden />
            <input
              className="tw:min-w-0 tw:flex-1 tw:border-0 tw:bg-transparent tw:text-fg tw:outline-none tw:placeholder:text-muted"
              type="search"
              aria-label="Search components and templates"
              placeholder="Search components and templates…"
              value={query}
              autoFocus
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <SegmentedControl aria-label="Show" value={tab} onValueChange={setTab} items={TABS} />
          <span className="tw:text-[13px] tw:text-muted">
            {visible.length} of {items.length}
          </span>
        </div>
        <SettingsBar settings={effective} themes={themes} theme={theme} onChange={changeSettings} />
      </header>
      <main className="tw:flex tw:flex-col tw:gap-8 tw:px-6 tw:py-6">
        {groups.length === 0 && <p className="tw:py-10 tw:text-center tw:text-muted">Nothing matches “{query}”.</p>}
        {groups.map((g) => (
          <section key={g.label} className="tw:flex tw:flex-col tw:gap-4">
            <h2 className="tw:font-display tw:text-[22px] tw:font-semibold">
              {g.label} <span className="tw:font-sans tw:text-[15px] tw:font-normal tw:text-muted">{g.items.length}</span>
            </h2>
            <div className="tw:flex tw:flex-wrap tw:gap-5">
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
