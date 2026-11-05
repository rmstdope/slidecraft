import { useEffect, useState, type FormEvent } from 'react'
import type { AgentBackendInfo } from '@shared/agent.ts'
import type { VaultInfo } from '@shared/decks.ts'
import { fetchAgentSettings, fetchBackends, saveAgentSettings, type AgentSettings } from '../agent/api'
import { createVault, removeVault, updateVault, type ApiResult } from '../api'

interface Props {
  vaults: VaultInfo[]
  /** Reload the vault list and the decks after a change. */
  onChanged(): Promise<void>
  onOpenVault(id: string): void
  onExit(): void
}

/** Vault management (UX overhaul U1): add, rename, mark read-only, remove. Files are never deleted. */
export default function SettingsPage({ vaults, onChanged, onOpenVault, onExit }: Props) {
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState(false)
  const temporary = vaults.find((v) => v.temporary)

  const run = async <T,>(action: () => Promise<ApiResult<T>>): Promise<T | undefined> => {
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
    <div className="settings">
      <header className="gallery-header">
        <button type="button" className="tool-button" onClick={onExit}>
          ← Back
        </button>
        <h1>Settings</h1>
      </header>
      <main className="settings-main">
        <h2 className="settings-heading">Vaults</h2>
        <p className="settings-intro">
          A vault is a folder of presentations with its own themes, images and house style (its <code>AGENTS.md</code>). The app shows one vault at a time, and
          its address is in the link, so two tabs can show two vaults.
        </p>
        {error && (
          <p className="home-error" role="alert">
            {error}
          </p>
        )}

        <ul className="vault-list">
          {vaults.map((vault) => (
            <VaultRow key={vault.id} vault={vault} busy={busy} run={run} onOpen={() => onOpenVault(vault.id)} />
          ))}
        </ul>

        <AddVault key={temporary?.id ?? 'new'} busy={busy} initial={temporary} run={run} onAdded={onOpenVault} />

        <AgentSection />
      </main>
    </div>
  )
}

type Run = <T>(action: () => Promise<ApiResult<T>>) => Promise<T | undefined>

function VaultRow({ vault, busy, run, onOpen }: { vault: VaultInfo; busy: boolean; run: Run; onOpen(): void }) {
  const [name, setName] = useState(vault.name)
  const [confirming, setConfirming] = useState(false)
  const managed = !vault.builtIn && !vault.temporary
  const rename = (e: FormEvent) => {
    e.preventDefault()
    if (name.trim() && name.trim() !== vault.name) void run(() => updateVault(vault.id, { name: name.trim() }))
  }
  return (
    <li className="vault-row">
      <div className="vault-row__main">
        {managed ? (
          <form onSubmit={rename} className="vault-row__name">
            <input value={name} aria-label={`Name of ${vault.name}`} onChange={(e) => setName(e.target.value)} onBlur={rename} disabled={busy} />
          </form>
        ) : (
          <strong className="vault-row__name">{vault.name}</strong>
        )}
        <code className="vault-row__path">{vault.path}</code>
        <span className="vault-row__tags">
          {vault.builtIn && <span className="vault-tag">Examples</span>}
          {vault.temporary && <span className="vault-tag">This run only</span>}
          {vault.readOnly && <span className="vault-tag">Read-only</span>}
        </span>
      </div>
      <div className="vault-row__actions">
        <button type="button" className="tool-button" onClick={onOpen}>
          Open
        </button>
        {managed && (
          <label className="vault-row__toggle">
            <input type="checkbox" checked={vault.readOnly} disabled={busy} onChange={(e) => void run(() => updateVault(vault.id, { readOnly: e.target.checked }))} />
            Read-only
          </label>
        )}
        {managed &&
          (confirming ? (
            <>
              <button type="button" className="tool-button is-danger" disabled={busy} onClick={() => void run(() => removeVault(vault.id))}>
                Remove from Slidecraft
              </button>
              <button type="button" className="tool-button" onClick={() => setConfirming(false)}>
                Keep
              </button>
            </>
          ) : (
            <button type="button" className="tool-button" onClick={() => setConfirming(true)} title="The folder and its files stay where they are">
              Remove…
            </button>
          ))}
      </div>
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
    <form className="vault-add" onSubmit={(e) => void submit(e)}>
      <h2>{initial ? 'Save this folder as a vault' : 'Add a vault'}</h2>
      <div className="vault-add__fields">
        <label className="tool-field">
          <span>Name</span>
          <input value={name} placeholder="Work" required onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="tool-field is-grow">
          <span>Folder</span>
          <input value={path} placeholder="~/Documents/Presentations/Work" required onChange={(e) => setPath(e.target.value)} />
        </label>
        <button type="submit" className="tool-button is-primary" disabled={busy || !name.trim() || !path.trim()}>
          Add vault
        </button>
      </div>
      <label className="vault-row__toggle">
        <input type="checkbox" checked={create} onChange={(e) => setCreate(e.target.checked)} />
        Create the folder if it does not exist
      </label>
    </form>
  )
}

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
    <section className="settings-agent" aria-labelledby="agent-heading">
      <h2 id="agent-heading" className="settings-heading">Agent</h2>
      <p className="settings-intro">The agent works in the vault folder with your own command-line login. It edits decks there without asking and asks before anything else.</p>
      <ul className="vault-list">
        {backends === null && <li className="vault-row">Checking…</li>}
        {backends?.map((b) => (
          <li key={b.id} className="vault-row">
            <div className="vault-row__main">
              <strong className="vault-row__name">{b.name}</strong>
              <span className="vault-row__path">{b.available ? `Ready${b.version ? ` · version ${b.version}` : ''}` : (b.detail ?? 'Not available')}</span>
            </div>
            <div className="vault-row__actions">
              <label className="vault-row__toggle">
                <input type="radio" name="agent-backend" checked={settings?.backend === b.id} onChange={() => void save({ backend: b.id })} />
                Use for new conversations
              </label>
            </div>
          </li>
        ))}
      </ul>
      <form
        className="vault-add__fields"
        onSubmit={(e) => {
          e.preventDefault()
          void save({ model })
        }}
      >
        <label className="tool-field is-grow">
          <span>Model</span>
          <input value={model} placeholder="The CLI's default (for example opus or sonnet)" onChange={(e) => setModel(e.target.value)} />
        </label>
        <button type="submit" className="tool-button is-primary" disabled={!settings || model === (settings.model ?? '')}>
          Save model
        </button>
        {saved && <span className="settings-saved">{saved}</span>}
      </form>
    </section>
  )
}
