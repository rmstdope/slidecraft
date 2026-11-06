import { useEffect, useMemo, useRef, useState, type ComponentType, type ReactNode } from 'react'
import { AnimatePresence, MotionConfig } from 'motion/react'
import { AlertTriangle, ArrowLeft, Check, Copy, PencilLine, Plus, RotateCcw, Search } from 'lucide-react'
import type { ThreadTarget } from '@shared/agent.ts'
import type { CopyPlan, OriginInfo } from '@shared/builtinCopies.ts'
import { COMPONENT_NAME_RE } from '@shared/vaultComponents.ts'
import { TEMPLATE_ID_RE } from '@shared/vaultTemplates.ts'
import { copyBuiltinToVault, fetchCopyPlan, resetVaultEntry } from '../api'
import { IS_STATIC } from '../basePath'
import { EntryWorkspace } from './EntryWorkspace'
import { BUILT_IN_SOURCE_ID } from '@shared/decks.ts'
import { StepContext } from '../animations/stepContext'
import { SlideThumbnail } from '../components/editor/SlideThumbnail'
import { PreviewErrorBoundary } from '../components/ErrorBoundary'
import { SLIDE_ACCENTS } from '../components/slides/accents'
import {
  BUILTIN_SOURCE as BUILTIN_COMPONENTS,
  getAllComponents,
  getAllTemplates,
  getBuiltinComponent,
  getParts,
  getSourceProblems,
  getTopLevelComponents,
  ownerName,
  sourceOfEntry,
  type ComponentProblem,
  type RegistryConfig,
  type RegistryProp,
} from '../components/slides/defineComponent'
import { setComponentTrust, useVaultComponents } from '../vault-api/vaultComponents'
import { DESIGN_HEIGHT, DESIGN_WIDTH } from '../components/slides/Slide'
import { StageScaleContext } from '../components/slides/thumbnailContext'
import { useInView } from '../hooks/useInView'
import { useRegistryVersion } from '../hooks/useRegistryVersion'
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
import { Badge, Button, cn, Dialog, Field, Input, Menu, NativeSelect, SegmentedControl, Sheet } from '../ui'

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
const allItems = (vault?: string): RegistryConfig[] => [...getTopLevelComponents(vault).map((c) => c.registry), ...getAllTemplates(vault)]
const allParts = (vault?: string): RegistryConfig[] => getAllComponents(vault).map((c) => c.registry).filter((r) => r.parent)
const toolbarOf = (name: string, vault?: string) => getAllComponents(vault).find((c) => c.registry.name === name)?.toolbar

type SourceFilter = 'any' | 'vault'

const SOURCE_FILTERS: { value: SourceFilter; label: string }[] = [
  { value: 'any', label: 'Any source' },
  { value: 'vault', label: 'This vault' },
]

const isVaultEntry = (item: RegistryConfig) => sourceOfEntry(item) !== BUILTIN_COMPONENTS
/** A vault entry with a built-in's name replaces it in this vault. */
const overridesBuiltin = (item: RegistryConfig) =>
  isVaultEntry(item) && (item.category === 'component' ? !!getBuiltinComponent(item.name) : getAllTemplates(null).some((t) => t.name === item.name))

/** The built-in a vault entry replaces, to compare the copy with. */
const builtinOf = (item: RegistryConfig): RegistryConfig | undefined =>
  item.category === 'component' ? getBuiltinComponent(item.name)?.registry : getAllTemplates(null).find((t) => t.name === item.name)

/** The folder a vault entry lives in, as a conversation target. */
const targetOf = (item: RegistryConfig): ThreadTarget =>
  item.category === 'component' ? { kind: 'component', name: item.name } : { kind: 'template', name: item.id.replace(/^template-/, '') }

/** Asks for the new component's or template's folder name, then opens its workspace. */
function NewEntryDialog({ kind, taken, onCancel, onStart }: { kind: ThreadTarget['kind']; taken: (name: string) => boolean; onCancel(): void; onStart(target: ThreadTarget): void }) {
  const [name, setName] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const component = kind === 'component'
  const valid = component ? COMPONENT_NAME_RE.test(name) : TEMPLATE_ID_RE.test(name)
  const clash = valid && taken(name)
  const start = () => valid && !clash && onStart({ kind, name })
  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onCancel()}
      // The name field, not the close button, gets the focus.
      onOpenAutoFocus={(e) => {
        e.preventDefault()
        inputRef.current?.focus()
      }}
      title={component ? 'New component' : 'New template'}
      description={component ? 'The agent writes it in components/<Name>/ in this vault, and you describe it in the conversation.' : 'The agent writes it in templates/<name>/ in this vault, and you describe it in the conversation.'}
    >
      <form
        className="tw:flex tw:flex-col tw:gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          start()
        }}
      >
        <Field label={component ? 'Name (PascalCase, the tag decks use)' : 'Folder name (lower-case words joined by dashes)'}>
          <Input ref={inputRef} value={name} placeholder={component ? 'FunnelBars' : 'pricing-slide'} onChange={(e) => setName(component ? e.target.value.replace(/\s+/g, '') : e.target.value.toLowerCase().replace(/\s+/g, '-'))} />
        </Field>
        {name && !valid && <p className="tw:m-0 tw:text-[13px] tw:text-removed">{component ? 'Start with a capital letter; letters and digits only.' : 'Lower-case letters, digits and dashes only.'}</p>}
        {clash && <p className="tw:m-0 tw:text-[13px] tw:text-removed">This vault already has one with that name; open it from the gallery to change it.</p>}
        <div className="tw:flex tw:justify-end tw:gap-2">
          <Button type="button" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={!valid || clash}>
            Start with the agent
          </Button>
        </div>
      </form>
    </Dialog>
  )
}

const code = (text: string) => <code className="tw:rounded tw:bg-field tw:px-1 tw:font-mono tw:text-[12.5px]">{text}</code>

/** What a reset or copy acts on: the built-in's name, and the vault folder of the copy. */
interface EntryRef {
  kind: ThreadTarget['kind']
  name: string
  folder: string
}

/**
 * Board 3: a built-in cannot be changed, so editing one copies it into the vault first, and the
 * copy replaces it there. A built-in that cannot be copied says why.
 */
function CopyDialog({ vault, vaultName, item, onCancel, onCopied }: { vault: string; vaultName: string; item: RegistryConfig; onCancel(): void; onCopied(target: ThreadTarget): void }) {
  const kind: ThreadTarget['kind'] = item.category === 'component' ? 'component' : 'template'
  const [plan, setPlan] = useState<CopyPlan | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const state = useVaultComponents(vault)
  useEffect(() => {
    let live = true
    void fetchCopyPlan(vault, kind, item.name).then((r) => live && (r.data ? setPlan(r.data) : setError(r.error ?? 'Could not ask the server')))
    return () => {
      live = false
    }
  }, [vault, kind, item.name])
  const copy = async () => {
    setBusy(true)
    const result = await copyBuiltinToVault(vault, kind, item.name)
    setBusy(false)
    if (!result.data) return setError(result.error ?? 'The copy failed')
    onCopied({ kind, name: result.data.folder.split('/')[1] })
  }
  const blocked = plan?.copyable === false
  const what = kind === 'component' ? item.name : `the ${item.name} template`
  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onCancel()}
      raised
      className="tw:w-[min(560px,calc(100vw-32px))]"
      title={blocked ? `Can’t copy ${item.name} yet` : `Copy ${item.name} to the ${vaultName} vault?`}
      description={blocked ? undefined : `Built-in ${kind === 'component' ? 'components' : 'templates'} can’t be changed. The agent works on a copy in this vault, and that copy replaces the built-in for this vault’s decks.`}
    >
      {!plan && !error && <p className="tw:m-0 tw:text-muted">Checking…</p>}
      {blocked && (
        <p className="tw:m-0 tw:text-fg-2">
          {plan.reason} You can still ask the agent for a new {kind} in its style.
        </p>
      )}
      {plan && !blocked && (
        <ul className="tw:m-0 tw:flex tw:list-none tw:flex-col tw:gap-2.5 tw:p-0 tw:text-fg-2">
          <li className="tw:flex tw:items-start tw:gap-2.5">
            <Check className="tw:mt-0.5 tw:size-4 tw:shrink-0 tw:text-added" aria-hidden />
            <span>
              Writes {code(`${plan.folder}/${kind === 'component' ? 'index.tsx' : 'index.mdx'}`)}
              {plan.parts.length > 0 && <> with {plan.parts.length === 1 ? 'its part' : 'its parts'} {plan.parts.map((p, i) => <span key={p}>{i > 0 && ', '}{code(p)}</span>)}</>}
              {kind === 'component' && <>, importing from {code('slidecraft')}</>}
            </span>
          </li>
          <li className="tw:flex tw:items-start tw:gap-2.5">
            <Check className="tw:mt-0.5 tw:size-4 tw:shrink-0 tw:text-added" aria-hidden />
            <span>
              {kind === 'template'
                ? `Add slide in ${vaultName} offers the copy in place of the built-in. Other vaults keep the built-in.`
                : plan.decks > 0
                  ? `${plan.decks === 1 ? 'One deck' : `${plan.decks} decks`} in ${vaultName} ${plan.decks === 1 ? 'uses' : 'use'} ${item.name} and will use the copy. Other vaults keep the built-in.`
                  : `No deck in ${vaultName} uses ${item.name} yet. Other vaults keep the built-in.`}
            </span>
          </li>
          <li className="tw:flex tw:items-start tw:gap-2.5">
            <AlertTriangle className="tw:mt-0.5 tw:size-4 tw:shrink-0 tw:text-fg-2" aria-hidden />
            <span>The copy stops getting Slidecraft’s fixes to {what}. You can compare it with the built-in, or reset to the built-in, at any time.</span>
          </li>
          {kind === 'component' && state && state.trust !== 'trusted' && (
            <li className="tw:flex tw:items-start tw:gap-2.5">
              <AlertTriangle className="tw:mt-0.5 tw:size-4 tw:shrink-0 tw:text-fg-2" aria-hidden />
              <span>This vault’s components are not allowed to run, so decks keep the built-in until you allow them.</span>
            </li>
          )}
        </ul>
      )}
      {plan?.conflict && !blocked && <p className="tw:m-0 tw:text-[13px] tw:text-removed">{plan.conflict}</p>}
      {error && <p className="tw:m-0 tw:text-[13px] tw:text-removed">{error}</p>}
      <div className="tw:flex tw:justify-end tw:gap-2">
        <Button onClick={onCancel}>{blocked ? 'Close' : 'Cancel'}</Button>
        {!blocked && (
          <Button variant="primary" disabled={!plan || !!plan.conflict || busy} onClick={() => void copy()}>
            Copy and edit with agent
          </Button>
        )}
      </div>
    </Dialog>
  )
}

/** Reset to built-in: the vault's copy is deleted, so the built-in is in use again. */
function ResetDialog({ vault, entry, onCancel, onDone }: { vault: string; entry: EntryRef; onCancel(): void; onDone(): void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const dir = `${entry.kind === 'component' ? 'components' : 'templates'}/${entry.folder}/`
  const reset = async () => {
    setBusy(true)
    const result = await resetVaultEntry(vault, entry.kind, entry.folder)
    setBusy(false)
    if (!result.data) return setError(result.error ?? 'The reset failed')
    onDone()
  }
  return (
    <Dialog open raised onOpenChange={(open) => !open && onCancel()} title={`Reset ${entry.name} to the built-in?`} description={<>This deletes {code(dir)} from the vault, with every change made to it. The vault’s decks use the built-in {entry.name} again.</>}>
      {error && <p className="tw:m-0 tw:text-[13px] tw:text-removed">{error}</p>}
      <div className="tw:flex tw:justify-end tw:gap-2">
        <Button onClick={onCancel}>Cancel</Button>
        <Button variant="danger" disabled={busy} onClick={() => void reset()}>
          Delete the copy
        </Button>
      </div>
    </Dialog>
  )
}

/** Where an entry comes from: Built-in, or the vault's name (and whether it replaces a built-in). */
function SourceBadge({ item, vaultName }: { item: RegistryConfig; vaultName: string }) {
  if (!isVaultEntry(item)) return <Badge className="tw:h-5 tw:bg-panel">Built-in</Badge>
  return (
    <Badge tone="accent" className="tw:h-5" title={overridesBuiltin(item) ? `Replaces the built-in ${item.name} in this vault` : 'This vault’s own'}>
      {vaultName}
      {overridesBuiltin(item) ? ' · overrides built-in' : ''}
    </Badge>
  )
}
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

function GalleryCard({ item, vaultName, settings, theme, onOpen }: { item: RegistryConfig; vaultName: string; settings: GallerySettings; theme?: ResolvedTheme; onOpen(): void }) {
  const source = useMemo(() => applySettings(item.previewCode, settings), [item.previewCode, settings])
  return (
    <button type="button" className="tw:group tw:flex tw:w-[380px] tw:max-w-full tw:flex-col tw:gap-2.5 tw:rounded-xl tw:bg-field tw:p-2.5 tw:text-left tw:transition-shadow tw:hover:shadow-[0_0_0_2px_var(--sc-focus)]" onClick={onOpen}>
      <PreviewFrame source={source} width={360} theme={theme} />
      <span className="tw:flex tw:flex-col tw:gap-0.5 tw:px-1 tw:pb-1">
        <span className="tw:flex tw:items-center tw:gap-2">
          <span className="tw:font-semibold">{item.name}</span>
          <SourceBadge item={item} vaultName={vaultName} />
        </span>
        <span className="tw:line-clamp-2 tw:text-[13px] tw:text-muted">{item.description}</span>
      </span>
    </button>
  )
}

/** A vault component that is not in use: it failed to compile or load (board 5). */
function ProblemCard({ problem, vaultName, onFix, onReset }: { problem: ComponentProblem; vaultName: string; onFix?: () => void; onReset?: () => void }) {
  const fallback = problem.template ? getAllTemplates(null).find((t) => t.name === problem.name) : getBuiltinComponent(problem.name)
  const [first, ...rest] = problem.message.split('\n')
  return (
    <div className="tw:flex tw:w-[380px] tw:max-w-full tw:flex-col tw:gap-2.5 tw:rounded-xl tw:bg-field tw:p-2.5 tw:shadow-[inset_0_0_0_1px_var(--sc-removed)]" role="group" aria-label={`${problem.name}: not loaded`}>
      <div className={cn(frameClass, 'tw:flex tw:flex-col tw:justify-center tw:gap-1.5 tw:bg-panel-alt tw:p-4')} style={{ width: 360, height: Math.round((360 * DESIGN_HEIGHT) / DESIGN_WIDTH) }}>
        <strong className="tw:text-removed">Doesn’t load</strong>
        <code className="tw:line-clamp-4 tw:font-mono tw:text-[12px] tw:whitespace-pre-wrap tw:text-fg-2" title={problem.message}>
          {[first, ...rest].join('\n')}
        </code>
      </div>
      <span className="tw:flex tw:flex-col tw:gap-0.5 tw:px-1 tw:pb-1">
        <span className="tw:flex tw:items-center tw:gap-2">
          <span className="tw:font-semibold">{problem.name}</span>
          <Badge tone="accent" className="tw:h-5">
            {vaultName}
            {fallback ? ' · overrides built-in' : ''}
          </Badge>
        </span>
        <span className="tw:text-[13px] tw:text-muted">
          {problem.template
            ? `${fallback ? `The built-in ${problem.name} stays in use` : 'It is left out of Add slide and the palette'} until this is fixed. It is in templates/.`
            : `${fallback ? `Decks use the built-in ${problem.name}` : 'Slides that use it show a placeholder'} until this is fixed. The code is in components/${problem.name}/.`}
        </span>
      </span>
      {(onFix || (onReset && fallback)) && (
        <span className="tw:flex tw:gap-2 tw:px-1 tw:pb-1">
          {onFix && (
            <Button size="sm" variant="primary" onClick={onFix}>
              <PencilLine aria-hidden />
              Fix with agent
            </Button>
          )}
          {onReset && fallback && (
            <Button size="sm" onClick={onReset}>
              <RotateCcw aria-hidden />
              Reset to built-in
            </Button>
          )}
        </span>
      )}
    </div>
  )
}

/** The vault's components are blocked or not allowed yet: say so, and offer to allow them. */
function BlockedBanner({ vault, problems }: { vault: string; problems: readonly ComponentProblem[] }) {
  const [busy, setBusy] = useState(false)
  const state = useVaultComponents(vault)
  const count = problems.length === 1 ? 'one component' : `${problems.length} components`
  return (
    <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-3 tw:rounded-xl tw:bg-field tw:px-4 tw:py-3" role="status">
      <span className="tw:flex-1 tw:text-fg-2">
        This vault has {count} of its own ({problems.map((p) => p.name).join(', ')}), {state?.trust === 'blocked' ? 'blocked on Settings › Vaults' : 'not allowed to run yet'}. Components are code that runs
        with Slidecraft’s access; allow them only for a vault you trust.
      </span>
      <Button
        size="sm"
        disabled={busy}
        onClick={() => {
          setBusy(true)
          void setComponentTrust(vault, 'trusted').finally(() => setBusy(false))
        }}
      >
        Allow components
      </Button>
    </div>
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

function DetailPanel({
  item,
  vault,
  vaultName,
  settings,
  theme,
  origin,
  onClose,
  onEdit,
  onCopy,
  onReset,
}: {
  item: RegistryConfig
  vault?: string
  vaultName: string
  settings: GallerySettings
  theme?: ResolvedTheme
  /** The vault entry was copied from a built-in (V5). */
  origin?: OriginInfo
  onClose(): void
  onEdit?: () => void
  /** A built-in: copy it into the vault, then edit the copy. */
  onCopy?: () => void
  onReset?: () => void
}) {
  const [copied, setCopied] = useState(false)
  // Built-in / Vault copy: a vault entry that replaces a built-in can show either.
  const builtin = overridesBuiltin(item) ? builtinOf(item) : undefined
  const [showBuiltin, setShowBuiltin] = useState(false)
  const shown = showBuiltin && builtin ? builtin : item
  // Settings per component: the item itself and each of its parts.
  const [values, setValues] = useState<Record<string, PropValues>>({})
  const [step, setStep] = useState(0)
  const [replay, setReplay] = useState(0)
  const isComponent = item.category === 'component'
  const groups = useMemo(
    () =>
      isComponent
        ? [item, ...getParts(item.name, vault).map((p) => p.registry)]
            .map((r) => ({ registry: r, controls: propControls(r, toolbarOf(r.name, vault)), written: readProps(item.previewCode, r.name) }))
            .filter((g) => g.controls.length > 0)
        : [],
    [item, isComponent, vault],
  )
  const withValues = (code: string) => Object.entries(values).reduce((text, [name, v]) => applyProps(text, name, v), code)
  // The settings belong to the vault's entry; the built-in it is compared with shows its own example.
  const source = useMemo(() => applySettings(shown === item ? withValues(shown.previewCode) : shown.previewCode, settings), [shown, item, values, settings])
  const snippet = useMemo(() => applySettings(withValues(item.snippet), settings), [item, values, settings])
  const { Component, error, isCompiling } = useLazyPreview(source, true, shown !== item)
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
          <h2 className="tw:flex tw:items-center tw:gap-3 tw:font-display tw:text-[28px] tw:leading-tight tw:font-semibold">
            {item.name}
            <SourceBadge item={item} vaultName={vaultName} />
          </h2>
          <p className="tw:text-fg-2">{item.description}</p>
        </div>
        {onReset && builtin && (
          <Button size="sm" onClick={onReset}>
            <RotateCcw aria-hidden />
            Reset to built-in
          </Button>
        )}
        {((onEdit && isVaultEntry(item)) || (onCopy && !isVaultEntry(item))) && (
          <Button size="sm" variant="primary" onClick={isVaultEntry(item) ? onEdit : onCopy}>
            <PencilLine aria-hidden />
            Edit with agent
          </Button>
        )}
        <Button size="sm" onClick={onClose}>
          Close (Esc)
        </Button>
      </header>
      {origin?.changed && (
        <p className="tw:m-0 tw:flex tw:items-start tw:gap-2 tw:rounded-lg tw:bg-field tw:px-3 tw:py-2 tw:text-[13px] tw:text-fg-2" role="status">
          <AlertTriangle className="tw:mt-0.5 tw:size-4 tw:shrink-0" aria-hidden />
          <span>
            Slidecraft’s built-in {origin.builtin} has changed since this copy was made{origin.appVersion ? ` (app ${origin.appVersion})` : ''}. Compare them below, or reset to get the new one.
          </span>
        </p>
      )}
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
        {builtin && (
          <>
            <span className="tw:flex-1" />
            <SegmentedControl
              aria-label="Compare with the built-in"
              value={showBuiltin ? 'builtin' : 'vault'}
              onValueChange={(v) => {
                setShowBuiltin(v === 'builtin')
                setStep(0)
              }}
              items={[
                { value: 'vault', label: origin ? 'Vault copy' : vaultName },
                { value: 'builtin', label: 'Built-in' },
              ]}
            />
          </>
        )}
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
          {getParts(item.name, vault).map(({ registry: part }) => (
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
export default function GalleryPage({ vault, vaultName = vault ?? 'This vault', vaultReadOnly = false, onExit }: { vault?: string; vaultName?: string; vaultReadOnly?: boolean; onExit(): void }) {
  const [query, setQuery] = useState('')
  const [tab, setTab] = useState<Tab>('all')
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('any')
  // The agent works on vault entries only, in a writable vault with a server.
  const canEdit = !!vault && !vaultReadOnly && !IS_STATIC
  const [creating, setCreating] = useState<ThreadTarget['kind'] | null>(null)
  const [workspace, setWorkspace] = useState<{ target: ThreadTarget; isNew: boolean } | null>(null)
  // V5: copying a built-in into the vault, and resetting a copy.
  const [copying, setCopying] = useState<RegistryConfig | null>(null)
  const [resetting, setResetting] = useState<EntryRef | null>(null)
  const vaultState = useVaultComponents(vault)
  const originOf = (item: RegistryConfig): OriginInfo | undefined =>
    item.category === 'component' ? vaultState?.components.find((c) => c.name === item.name)?.origin : vaultState?.templates?.find((t) => `template-${t.id}` === item.id)?.origin
  // By name, so the panel shows the current entry after a vault component reloads.
  const [openName, setOpenName] = useState<{ name: string; category: RegistryConfig['category'] } | null>(null)
  const [settings, setSettings] = useState<GallerySettings>(loadSettings)
  const version = useThemesVersion()
  // Content-folder themes register after load; the version re-lists them.
  const themes = useMemo(() => (version >= 0 ? listAllThemes().filter((t) => !vault || t.source === BUILTIN_SOURCE || t.source === vault) : []), [version, vault])
  const theme = chosenTheme(settings.theme, themes)
  // A theme that has gone (a content folder changed) falls back to each example's own.
  const effective = useMemo(() => (settings.theme && !theme ? { ...settings, theme: '', frame: '' } : settings), [settings, theme])
  const registryVersion = useRegistryVersion()
  const items = useMemo(() => allItems(vault), [registryVersion, vault])
  const parts = useMemo(() => allParts(vault), [registryVersion, vault])
  const problems = useMemo(() => (vault ? getSourceProblems(vault) : []), [registryVersion, vault])
  const broken = problems.filter(
    (p) => !p.blocked && (tab === 'all' || (tab === 'template') === !!p.template) && (!query || p.name.toLowerCase().includes(query.toLowerCase())),
  )
  const blocked = problems.filter((p) => p.blocked)
  const hasOwn = items.some(isVaultEntry) || problems.length > 0
  const open = openName ? items.find((i) => i.name === openName.name && i.category === openName.category) ?? null : null
  const visible = useMemo(() => {
    // A search that finds a part (SignalNode) shows its parent's card.
    const owners = new Set(searchItems(parts, query).map(ownerName))
    const found = new Set(searchItems(items, query).map((i) => i.name))
    return items
      .filter((i) => (found.has(i.name) || owners.has(i.name)) && (tab === 'all' || i.category === tab) && (sourceFilter === 'any' || isVaultEntry(i)))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [items, parts, query, tab, sourceFilter])
  const ownCount = items.filter(isVaultEntry).length
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
      if (e.key !== 'Escape' || workspace || creating || copying || resetting) return
      if (open) setOpenName(null)
      else if (!(e.target instanceof HTMLInputElement && e.target.value)) onExit()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onExit, workspace, creating, copying, resetting])

  return (
    <div className="sc-app tw:h-full tw:overflow-y-auto tw:bg-ground">
      <header className="tw:sticky tw:top-0 tw:z-10 tw:flex tw:flex-col tw:gap-3 tw:border-b tw:border-line tw:bg-ground/90 tw:px-6 tw:py-4 tw:backdrop-blur-md">
        <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-3">
          <Button size="icon" onClick={onExit} aria-label="Back to presentations" title="Back to presentations">
            <ArrowLeft aria-hidden />
          </Button>
          <div className="tw:flex tw:flex-col tw:gap-1">
            <h1 className="tw:font-display tw:text-[28px] tw:leading-none tw:font-semibold">Component Gallery</h1>
            {hasOwn && (
              <span className="tw:text-[13px] tw:text-muted">
                {vaultName} vault · built-in components plus {ownCount} of the vault’s own
              </span>
            )}
          </div>
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
          {hasOwn && <SegmentedControl aria-label="Source" value={sourceFilter} onValueChange={setSourceFilter} items={SOURCE_FILTERS} />}
          {canEdit && (
            <Menu
              trigger={
                <Button variant="primary">
                  <Plus aria-hidden />
                  New
                </Button>
              }
              items={[
                { label: 'New component', onSelect: () => setCreating('component') },
                { label: 'New template', onSelect: () => setCreating('template') },
              ]}
            />
          )}
          <span className="tw:text-[13px] tw:text-muted">
            {visible.length} of {items.length}
          </span>
        </div>
        <SettingsBar settings={effective} themes={themes} theme={theme} onChange={changeSettings} />
      </header>
      <main className="tw:flex tw:flex-col tw:gap-8 tw:px-6 tw:py-6">
        {vault && blocked.length > 0 && <BlockedBanner vault={vault} problems={blocked} />}
        {broken.length > 0 && (
          <section className="tw:flex tw:flex-col tw:gap-4">
            <h2 className="tw:font-display tw:text-[22px] tw:font-semibold">
              Not loaded <span className="tw:font-sans tw:text-[15px] tw:font-normal tw:text-muted">{broken.length}</span>
            </h2>
            <div className="tw:flex tw:flex-wrap tw:gap-5">
              {broken.map((p) => (
                <ProblemCard
                  key={p.template ? `t:${p.folder ?? p.name}` : `c:${p.name}`}
                  problem={p}
                  vaultName={vaultName}
                  onFix={canEdit && (!p.template || p.folder) ? () => setWorkspace({ target: { kind: p.template ? 'template' : 'component', name: p.template ? p.folder! : p.name }, isNew: false }) : undefined}
                  onReset={canEdit && (!p.template || p.folder) ? () => setResetting({ kind: p.template ? 'template' : 'component', name: p.name, folder: p.template ? p.folder! : p.name }) : undefined}
                />
              ))}
            </div>
          </section>
        )}
        {groups.length === 0 && <p className="tw:py-10 tw:text-center tw:text-muted">{query ? `Nothing matches “${query}”.` : 'Nothing to show.'}</p>}
        {groups.map((g) => (
          <section key={g.label} className="tw:flex tw:flex-col tw:gap-4">
            <h2 className="tw:font-display tw:text-[22px] tw:font-semibold">
              {g.label} <span className="tw:font-sans tw:text-[15px] tw:font-normal tw:text-muted">{g.items.length}</span>
            </h2>
            <div className="tw:flex tw:flex-wrap tw:gap-5">
              {g.items.map((item) => (
                <GalleryCard key={`${sourceOfEntry(item)}:${item.id}`} item={item} vaultName={vaultName} settings={effective} theme={theme} onOpen={() => setOpenName({ name: item.name, category: item.category })} />
              ))}
            </div>
          </section>
        ))}
      </main>
      <AnimatePresence>
        {open && !workspace && (
          <DetailPanel
            key={`${open.category}:${open.name}`}
            item={open}
            vault={vault}
            vaultName={vaultName}
            settings={effective}
            theme={theme}
            onClose={() => setOpenName(null)}
            origin={originOf(open)}
            onEdit={canEdit ? () => setWorkspace({ target: targetOf(open), isNew: false }) : undefined}
            onCopy={canEdit ? () => setCopying(open) : undefined}
            onReset={canEdit ? () => setResetting({ kind: open.category === 'component' ? 'component' : 'template', name: open.name, folder: targetOf(open).name }) : undefined}
          />
        )}
      </AnimatePresence>
      {creating && vault && (
        <NewEntryDialog
          kind={creating}
          taken={(name) => (creating === 'component' ? items.some((i) => i.category === 'component' && isVaultEntry(i) && i.name === name) : items.some((i) => i.category === 'template' && isVaultEntry(i) && i.id === `template-${name}`))}
          onCancel={() => setCreating(null)}
          onStart={(target) => {
            setCreating(null)
            setWorkspace({ target, isNew: true })
          }}
        />
      )}
      {copying && vault && (
        <CopyDialog
          vault={vault}
          vaultName={vaultName}
          item={copying}
          onCancel={() => setCopying(null)}
          onCopied={(target) => {
            setCopying(null)
            setWorkspace({ target, isNew: false })
          }}
        />
      )}
      {resetting && vault && <ResetDialog vault={vault} entry={resetting} onCancel={() => setResetting(null)} onDone={() => setResetting(null)} />}
      {workspace && vault && <EntryWorkspace vault={vault} vaultName={vaultName} target={workspace.target} isNew={workspace.isNew} onClose={() => setWorkspace(null)} />}
    </div>
  )
}
