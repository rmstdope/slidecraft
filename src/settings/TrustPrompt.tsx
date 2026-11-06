import { useState } from 'react'
import type { VaultInfo } from '@shared/decks.ts'
import { setComponentTrust, useVaultComponents } from '../vault-api/vaultComponents'
import { Button, Dialog } from '../ui'

/** Vaults whose prompt was put off this session ("Not now"); it comes back next time the app opens. */
const putOff = new Set<string>()

/**
 * Asks once whether a vault's own components may run (vault components plan, V2, board 5). Shown
 * when the vault on screen has component folders and no choice has been made.
 */
export function TrustPrompt({ vault }: { vault: VaultInfo | undefined }) {
  const state = useVaultComponents(vault?.id)
  const [, rerender] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  if (!vault || !state || state.trust !== 'ask' || state.components.length === 0 || putOff.has(vault.id)) return null

  const later = () => {
    putOff.add(vault.id)
    rerender((n) => n + 1)
  }
  const allow = async () => {
    setBusy(true)
    const failed = await setComponentTrust(vault.id, 'trusted')
    setBusy(false)
    if (failed) setError(failed)
  }
  const count = state.components.length

  return (
    <Dialog open onOpenChange={(open) => !open && later()} title={`Run the components in “${vault.name}”?`} className="tw:w-[min(560px,calc(100vw-32px))]">
      <p className="tw:m-0 tw:text-fg-2">
        This vault has its own components. Components are code: they run inside Slidecraft with the same access as Slidecraft itself. Only allow them if you trust where the vault came from.
      </p>
      <div className="tw:flex tw:flex-col tw:gap-2 tw:rounded-lg tw:bg-field tw:p-3">
        <span className="tw:font-mono tw:text-[12px] tw:text-muted">
          {vault.path}/components/ · {count} component{count === 1 ? '' : 's'}
        </span>
        <span className="tw:flex tw:flex-wrap tw:gap-1.5">
          {state.components.map((c) => (
            <code key={c.name} className="tw:rounded-md tw:bg-panel tw:px-2 tw:py-0.5 tw:font-mono tw:text-[12px]">
              {c.name}/
            </code>
          ))}
        </span>
      </div>
      <p className="tw:m-0 tw:text-[13px] tw:text-muted">
        Until you allow them, slides that use them show a placeholder and the built-in components stay in place. You can change this on Settings › Vaults.
      </p>
      {error && <p className="tw:m-0 tw:text-[13px] tw:text-removed">{error}</p>}
      <div className="tw:flex tw:justify-end tw:gap-2">
        <Button onClick={later}>Not now</Button>
        <Button variant="primary" disabled={busy} onClick={() => void allow()}>
          Allow components
        </Button>
      </div>
    </Dialog>
  )
}
