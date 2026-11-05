import type { VaultInfo } from '@shared/decks.ts'

/** Which vault the app shows. A plain select: keyboard and screen readers work as they should. */
export function VaultSwitcher({ vault, vaults, onSwitch }: { vault: VaultInfo; vaults: VaultInfo[]; onSwitch(id: string): void }) {
  if (vaults.length < 2) return <span className="vault-switcher vault-switcher--single">{vault.name}</span>
  return (
    <label className="vault-switcher">
      <span className="vault-switcher__label">Vault</span>
      <select value={vault.id} onChange={(e) => onSwitch(e.target.value)} aria-label="Vault">
        {vaults.map((v) => (
          <option key={v.id} value={v.id}>
            {v.name}
            {v.temporary ? ' (this run only)' : ''}
            {v.readOnly ? ' (read-only)' : ''}
          </option>
        ))}
      </select>
    </label>
  )
}
