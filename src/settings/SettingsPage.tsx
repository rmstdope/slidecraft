import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { RadioGroup } from 'radix-ui'
import { Bot, ChevronLeft, FolderOpen, Palette } from 'lucide-react'
import type { AgentBackendInfo } from '@shared/agent.ts'
import type { VaultInfo } from '@shared/decks.ts'
import { fetchAgentSettings, fetchBackends, saveAgentSettings, type AgentSettings } from '../agent/api'
import { createVault, removeVault, updateVault, type ApiResult } from '../api'
import { DARK_ACCENTS, type DarkAccent, type ThemeChoice } from '../appearance/appearance'
import { useAppearance } from '../appearance/useAppearance'
import { Badge, Button, Card, cn, Dialog, Field, Input, Logo, StatusDot, Switch } from '../ui'

export type SettingsSection = 'appearance' | 'vaults' | 'agent'

interface Props {
  vaults: VaultInfo[]
  /** Reload the vault list and the decks after a change. */
  onChanged(): Promise<void>
  onOpenVault(id: string): void
  onExit(): void
}

const SECTIONS: { id: SettingsSection; label: string; icon: ReactNode }[] = [
  { id: 'appearance', label: 'Appearance', icon: <Palette aria-hidden /> },
  { id: 'vaults', label: 'Vaults', icon: <FolderOpen aria-hidden /> },
  { id: 'agent', label: 'Agent', icon: <Bot aria-hidden /> },
]

const isSection = (s: string): s is SettingsSection => SECTIONS.some((x) => x.id === s)

/** The section in the address (`/settings#vaults`), or vaults when a folder is waiting to be saved. */
function initialSection(vaults: VaultInfo[]): SettingsSection {
  const hash = window.location.hash.slice(1)
  if (isSection(hash)) return hash
  return vaults.some((v) => v.temporary) ? 'vaults' : 'appearance'
}

/** Settings (ui-redesign-plan R2): appearance, vaults (UX overhaul U1) and the agent. */
export default function SettingsPage({ vaults, onChanged, onOpenVault, onExit }: Props) {
  const [section, setSectionState] = useState<SettingsSection>(() => initialSection(vaults))
  const setSection = (next: SettingsSection) => {
    setSectionState(next)
    window.history.replaceState(window.history.state, '', `#${next}`)
  }

  return (
    <div className="sc-app tw:flex tw:h-full tw:flex-wrap tw:overflow-y-auto tw:bg-ground">
      <aside className="tw:flex tw:w-full tw:shrink-0 tw:flex-col tw:gap-5 tw:px-3.5 tw:py-5 tw:md:w-60">
        <Logo withName className="tw:px-2" />
        <Button variant="ghost" className="tw:justify-start tw:px-2.5" onClick={onExit}>
          <ChevronLeft aria-hidden />
          Back to presentations
        </Button>
        <nav aria-label="Settings" className="tw:flex tw:flex-col tw:gap-0.5">
          <span className="tw:px-2.5 tw:pb-1.5 tw:text-[12px] tw:font-medium tw:text-muted">Settings</span>
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              aria-current={section === s.id ? 'page' : undefined}
              onClick={() => setSection(s.id)}
              className={cn(
                'tw:flex tw:h-9 tw:items-center tw:gap-2.5 tw:rounded-lg tw:px-2.5 tw:text-left tw:font-medium tw:[&_svg]:size-4',
                section === s.id ? 'tw:bg-panel tw:text-fg tw:shadow-hairline' : 'tw:text-fg-2 tw:hover:bg-field',
              )}
            >
              {s.icon}
              {s.label}
            </button>
          ))}
        </nav>
      </aside>

      <main className="tw:m-2.5 tw:min-w-0 tw:flex-[999_1_560px] tw:rounded-2xl tw:bg-panel tw:px-6 tw:py-10 tw:shadow-[0_0_0_1px_var(--sc-line),var(--sc-elev)] tw:md:px-12">
        <div className="tw:flex tw:max-w-[760px] tw:flex-col tw:gap-9">
          {section === 'appearance' && <AppearanceSection />}
          {section === 'vaults' && <VaultsSection vaults={vaults} onChanged={onChanged} onOpenVault={onOpenVault} />}
          {section === 'agent' && <AgentSection />}
        </div>
      </main>
    </div>
  )
}

function SectionHeader({ title, intro }: { title: string; intro: ReactNode }) {
  return (
    <div className="tw:flex tw:flex-col tw:gap-1.5">
      <h1 className="tw:font-display tw:text-[40px] tw:leading-[1.05] tw:font-semibold tw:tracking-[-0.015em]">{title}</h1>
      <p className="tw:max-w-[620px] tw:text-muted">{intro}</p>
    </div>
  )
}

function Group({ title, hint, children, id }: { title: string; hint?: ReactNode; children: ReactNode; id?: string }) {
  return (
    <section aria-labelledby={id} className="tw:flex tw:flex-col tw:gap-3.5 tw:border-t tw:border-line tw:pt-7 tw:first:border-t-0 tw:first:pt-0">
      <div className="tw:flex tw:flex-col tw:gap-0.5">
        <h2 id={id} className="tw:text-[15px] tw:font-semibold">
          {title}
        </h2>
        {hint && <p className="tw:text-[13px] tw:text-muted">{hint}</p>}
      </div>
      {children}
    </section>
  )
}

// ---------------------------------------------------------------------------------------------
// Appearance

const THEME_OPTIONS: { id: ThemeChoice; label: string; halves: ('light' | 'dark')[] }[] = [
  { id: 'light', label: 'Light', halves: ['light'] },
  { id: 'dark', label: 'Dark', halves: ['dark'] },
  { id: 'system', label: 'System', halves: ['light', 'dark'] },
]

function AppearanceSection() {
  const { appearance, update } = useAppearance()
  return (
    <>
      <SectionHeader title="Appearance" intro="How Slidecraft looks in this browser. Slides always use their deck's own theme, and the player stays dark." />
      <div className="tw:flex tw:flex-col tw:gap-7">
        <Group id="theme-heading" title="Theme" hint="System follows your operating system and switches with it.">
          <RadioGroup.Root
            aria-labelledby="theme-heading"
            value={appearance.theme}
            onValueChange={(v) => update({ theme: v as ThemeChoice })}
            className="tw:grid tw:grid-cols-[repeat(auto-fit,minmax(180px,1fr))] tw:gap-3.5"
          >
            {THEME_OPTIONS.map((o) => (
              <RadioGroup.Item
                key={o.id}
                value={o.id}
                className="tw:group tw:flex tw:flex-col tw:gap-2.5 tw:rounded-[14px] tw:bg-panel tw:p-2 tw:pb-3 tw:text-left tw:shadow-hairline tw:data-[state=checked]:shadow-[0_0_0_2px_var(--sc-focus)]"
              >
                <span className="tw:flex tw:h-[110px] tw:overflow-hidden tw:rounded-[9px] tw:shadow-hairline">
                  {o.halves.map((h) => (
                    <ThemePreview key={h} theme={h} />
                  ))}
                </span>
                <span className="tw:flex tw:items-center tw:gap-2 tw:px-1">
                  <span
                    aria-hidden
                    className="tw:size-4 tw:rounded-full tw:border-[1.5px] tw:border-muted tw:group-data-[state=checked]:border-[5px] tw:group-data-[state=checked]:border-focus"
                  />
                  <span className="tw:font-medium">{o.label}</span>
                </span>
              </RadioGroup.Item>
            ))}
          </RadioGroup.Root>
        </Group>

        <Group id="accent-heading" title="Accent in dark mode" hint="For selection, focus and highlights when the theme is dark. Light mode always uses Slidecraft yellow.">
          <div className="tw:flex tw:flex-wrap tw:items-start tw:gap-6">
            <RadioGroup.Root
              aria-labelledby="accent-heading"
              value={appearance.darkAccent}
              onValueChange={(v) => update({ darkAccent: v as DarkAccent })}
              orientation="horizontal"
              className="tw:flex tw:flex-wrap tw:gap-2.5"
            >
              {DARK_ACCENTS.map((a) => (
                <RadioGroup.Item
                  key={a.id}
                  value={a.id}
                  className="tw:group tw:flex tw:w-[76px] tw:flex-col tw:items-center tw:gap-2 tw:rounded-xl tw:py-2.5 tw:text-[12px] tw:text-fg-2 tw:data-[state=checked]:bg-field tw:data-[state=checked]:text-fg"
                >
                  <span
                    aria-hidden
                    className="tw:size-8 tw:rounded-full tw:shadow-[0_0_0_3px_var(--sc-panel),0_0_0_5px_transparent] tw:group-data-[state=checked]:shadow-[0_0_0_3px_var(--sc-panel),0_0_0_5px_var(--swatch)]"
                    style={{ background: a.value, ['--swatch' as string]: a.value }}
                  />
                  {a.label}
                </RadioGroup.Item>
              ))}
            </RadioGroup.Root>
            <AccentPreview />
          </div>
        </Group>
      </div>
    </>
  )
}

/** A miniature of the app, drawn with the real tokens by forcing a theme on the subtree. */
function ThemePreview({ theme }: { theme: 'light' | 'dark' }) {
  return (
    <span data-sc-theme={theme} className="tw:flex tw:flex-1 tw:gap-1.5 tw:bg-ground tw:p-2" aria-hidden>
      <span className="tw:flex tw:w-[22%] tw:flex-col tw:gap-1.5 tw:pt-1">
        <span className="tw:h-1.5 tw:rounded-sm tw:bg-line" />
        <span className="tw:h-1.5 tw:w-3/4 tw:rounded-sm tw:bg-line" />
        <span className="tw:h-1.5 tw:w-4/5 tw:rounded-sm tw:bg-line" />
      </span>
      <span className="tw:flex tw:flex-1 tw:flex-col tw:gap-1.5 tw:rounded-md tw:bg-panel tw:p-2 tw:shadow-hairline">
        <span className="tw:h-2 tw:w-1/2 tw:rounded-sm tw:bg-fg" />
        <span className="tw:flex-1 tw:rounded tw:bg-[#f4efe6] tw:shadow-[0_0_0_2px_var(--sc-accent)]" />
      </span>
    </span>
  )
}

function AccentPreview() {
  return (
    <div data-sc-theme="dark" className="sc-app tw:flex tw:min-w-[260px] tw:flex-[1_1_260px] tw:flex-col tw:gap-2.5 tw:rounded-xl tw:bg-ground tw:p-3.5 tw:shadow-hairline" aria-label="Dark mode preview" role="img">
      <span className="tw:text-[12px] tw:text-muted">Dark preview</span>
      <div className="tw:flex tw:items-center tw:gap-2.5">
        <span className="tw:aspect-video tw:w-[92px] tw:rounded tw:bg-[#f4efe6] tw:shadow-[0_0_0_2px_var(--sc-focus)]" />
        <div className="tw:flex tw:flex-col tw:items-start tw:gap-2">
          <Badge tone="accent">Slide 4 · Title</Badge>
          <span className="tw:inline-flex tw:h-[30px] tw:items-center tw:rounded-lg tw:bg-raised tw:px-3 tw:text-[12px] tw:shadow-[0_0_0_2px_var(--sc-ground),0_0_0_4px_var(--sc-focus)]">
            Focused button
          </span>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------------------------
// Vaults

type Run = <T>(action: () => Promise<ApiResult<T>>) => Promise<T | undefined>

function VaultsSection({ vaults, onChanged, onOpenVault }: { vaults: VaultInfo[]; onChanged(): Promise<void>; onOpenVault(id: string): void }) {
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState(false)
  const temporary = vaults.find((v) => v.temporary)

  const run: Run = async (action) => {
    setBusy(true)
    setError(undefined)
    const result = await action()
    setBusy(false)
    if (!result.data) {
      setError(result.error ?? 'The change failed')
      return undefined
    }
    await onChanged()
    return result.data
  }

  return (
    <>
      <SectionHeader
        title="Vaults"
        intro={
          <>
            A vault is a folder of presentations with its own themes, images and house style (its <code className="tw:font-mono tw:text-[13px]">AGENTS.md</code>). The app
            shows one vault at a time, and its address is in the link, so two tabs can show two vaults.
          </>
        }
      />
      {error && (
        <p role="alert" className="tw:rounded-xl tw:bg-field tw:px-4 tw:py-3 tw:text-removed">
          {error}
        </p>
      )}
      <ul className="tw:flex tw:flex-col tw:gap-2.5" aria-label="Vaults">
        {vaults.map((vault) => (
          <VaultRow key={vault.id} vault={vault} busy={busy} run={run} onOpen={() => onOpenVault(vault.id)} />
        ))}
      </ul>
      <AddVault key={temporary?.id ?? 'new'} busy={busy} initial={temporary} run={run} onAdded={onOpenVault} />
    </>
  )
}

function VaultRow({ vault, busy, run, onOpen }: { vault: VaultInfo; busy: boolean; run: Run; onOpen(): void }) {
  const [name, setName] = useState(vault.name)
  const [confirming, setConfirming] = useState(false)
  const managed = !vault.builtIn && !vault.temporary
  const rename = (e: FormEvent) => {
    e.preventDefault()
    if (name.trim() && name.trim() !== vault.name) void run(() => updateVault(vault.id, { name: name.trim() }))
  }
  const readOnlyId = `read-only-${vault.id}`
  return (
    <li>
      <Card className="tw:flex tw:flex-wrap tw:items-center tw:gap-x-6 tw:gap-y-3 tw:px-4 tw:py-3.5">
        <div className="tw:flex tw:min-w-0 tw:flex-[1_1_280px] tw:flex-col tw:gap-1">
          <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-2">
            {managed ? (
              <form onSubmit={rename} className="tw:min-w-0 tw:flex-1">
                <Input
                  value={name}
                  aria-label={`Name of ${vault.name}`}
                  onChange={(e) => setName(e.target.value)}
                  onBlur={rename}
                  disabled={busy}
                  className="tw:-ml-2 tw:h-8 tw:max-w-[280px] tw:bg-transparent tw:px-2 tw:font-semibold tw:hover:bg-field tw:focus-visible:bg-field"
                />
              </form>
            ) : (
              <strong className="tw:font-semibold">{vault.name}</strong>
            )}
            {vault.builtIn && <Badge>Examples</Badge>}
            {vault.temporary && <Badge tone="accent">This run only</Badge>}
            {vault.readOnly && <Badge>Read-only</Badge>}
          </div>
          <code className="tw:truncate tw:font-mono tw:text-[12px] tw:text-muted" title={vault.path}>
            {vault.path}
          </code>
        </div>
        <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-2">
          {managed && (
            <label htmlFor={readOnlyId} className="tw:mr-2 tw:flex tw:items-center tw:gap-2 tw:text-[13px] tw:text-fg-2">
              <Switch
                id={readOnlyId}
                checked={vault.readOnly}
                disabled={busy}
                onCheckedChange={(checked) => void run(() => updateVault(vault.id, { readOnly: checked }))}
              />
              Read-only
            </label>
          )}
          <Button size="sm" onClick={onOpen}>
            Open
          </Button>
          {managed && (
            <Button size="sm" variant="ghost" onClick={() => setConfirming(true)} title="The folder and its files stay where they are">
              Remove…
            </Button>
          )}
        </div>
      </Card>
      <Dialog
        open={confirming}
        onOpenChange={setConfirming}
        title={`Remove ${vault.name}?`}
        description="Slidecraft forgets this vault. The folder and its files stay where they are, and you can add it again later."
      >
        <div className="tw:flex tw:justify-end tw:gap-2">
          <Button onClick={() => setConfirming(false)}>Keep</Button>
          <Button
            variant="danger"
            disabled={busy}
            onClick={() => {
              setConfirming(false)
              void run(() => removeVault(vault.id))
            }}
          >
            Remove from Slidecraft
          </Button>
        </div>
      </Dialog>
    </li>
  )
}

function AddVault({ busy, initial, run, onAdded }: { busy: boolean; initial?: VaultInfo; run: Run; onAdded(id: string): void }) {
  const [name, setName] = useState(initial?.name ?? '')
  const [path, setPath] = useState(initial?.path ?? '')
  const [create, setCreate] = useState(true)
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const added = await run(() => createVault({ name: name.trim(), path: path.trim(), create }))
    if (added) onAdded(added.vault.id)
  }
  return (
    <Group id="add-vault-heading" title={initial ? 'Save this folder as a vault' : 'Add a vault'}>
      <form className="tw:flex tw:flex-col tw:gap-4" onSubmit={(e) => void submit(e)} aria-labelledby="add-vault-heading">
        <div className="tw:flex tw:flex-wrap tw:items-end tw:gap-3">
          <Field label="Name" className="tw:w-48">
            <Input value={name} placeholder="Work" required onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Folder" className="tw:min-w-[240px] tw:flex-1">
            <Input value={path} placeholder="~/Documents/Presentations/Work" required onChange={(e) => setPath(e.target.value)} />
          </Field>
          <Button type="submit" variant="primary" disabled={busy || !name.trim() || !path.trim()}>
            Add vault
          </Button>
        </div>
        <label className="tw:flex tw:items-center tw:gap-2.5 tw:text-[13px] tw:text-fg-2">
          <Switch checked={create} onCheckedChange={setCreate} />
          Create the folder if it does not exist
        </label>
      </form>
    </Group>
  )
}

// ---------------------------------------------------------------------------------------------
// Agent

/** Which agent works in the app, whether it is ready, and the model it uses. */
function AgentSection() {
  const [backends, setBackends] = useState<AgentBackendInfo[] | null>(null)
  const [settings, setSettings] = useState<AgentSettings | null>(null)
  const [model, setModel] = useState('')
  const [saved, setSaved] = useState<string>()
  useEffect(() => {
    void fetchBackends().then((r) => setBackends(r.data ?? []))
    void fetchAgentSettings().then((r) => {
      if (!r.data) return
      setSettings(r.data)
      setModel(r.data.model ?? '')
    })
  }, [])
  const save = async (change: Partial<AgentSettings>) => {
    const result = await saveAgentSettings(change)
    if (result.data) {
      setSettings(result.data)
      setSaved('Saved')
      setTimeout(() => setSaved(undefined), 1500)
    } else setSaved(result.error)
  }
  return (
    <>
      <SectionHeader
        title="Agent"
        intro="The agent works in the vault folder with your own command-line login. It edits decks there without asking and asks before anything else."
      />
      <div className="tw:flex tw:flex-col tw:gap-7">
        <Group id="backend-heading" title="Agent for new conversations">
          {backends === null ? (
            <p className="tw:text-muted">Checking…</p>
          ) : (
            <RadioGroup.Root
              aria-labelledby="backend-heading"
              value={settings?.backend ?? ''}
              onValueChange={(v) => void save({ backend: v as AgentSettings['backend'] })}
              className="tw:flex tw:flex-col tw:gap-2.5"
            >
              {backends.map((b) => (
                <RadioGroup.Item
                  key={b.id}
                  value={b.id}
                  className="tw:group tw:flex tw:items-center tw:gap-3 tw:rounded-[14px] tw:bg-panel tw:px-4 tw:py-3.5 tw:text-left tw:shadow-hairline tw:data-[state=checked]:shadow-[0_0_0_2px_var(--sc-focus)]"
                >
                  <StatusDot tone={b.available ? 'agent' : 'muted'} />
                  <span className="tw:flex tw:flex-1 tw:flex-col">
                    <span className="tw:font-semibold">{b.name}</span>
                    <span className="tw:text-[13px] tw:text-muted">{b.available ? `Ready${b.version ? ` · version ${b.version}` : ''}` : (b.detail ?? 'Not available')}</span>
                  </span>
                  <span
                    aria-hidden
                    className="tw:size-4 tw:rounded-full tw:border-[1.5px] tw:border-muted tw:group-data-[state=checked]:border-[5px] tw:group-data-[state=checked]:border-focus"
                  />
                </RadioGroup.Item>
              ))}
            </RadioGroup.Root>
          )}
        </Group>
        <Group id="model-heading" title="Model" hint="Leave empty for the command-line tool's default.">
          <form
            className="tw:flex tw:flex-wrap tw:items-center tw:gap-3"
            onSubmit={(e) => {
              e.preventDefault()
              void save({ model })
            }}
          >
            <Input
              aria-labelledby="model-heading"
              value={model}
              placeholder="For example opus or sonnet"
              onChange={(e) => setModel(e.target.value)}
              className="tw:max-w-[360px] tw:flex-1"
            />
            <Button type="submit" variant="primary" disabled={!settings || model === (settings.model ?? '')}>
              Save model
            </Button>
            {saved && (
              <span role="status" className="tw:text-[13px] tw:text-muted">
                {saved}
              </span>
            )}
          </form>
        </Group>
      </div>
    </>
  )
}
