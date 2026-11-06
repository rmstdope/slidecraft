import type { FC } from 'react'

/**
 * Stands in for a vault component that is not loaded (vault components plan, V2): blocked, not
 * yet allowed, or broken. Only the slides that use it show this; the rest of the deck renders.
 */
export function unavailableComponent(name: string, message: string): FC<Record<string, unknown>> {
  const Placeholder: FC<Record<string, unknown>> = () => (
    <div
      role="note"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        padding: '32px 40px',
        border: '3px dashed rgba(127,127,127,0.55)',
        borderRadius: 16,
        color: 'inherit',
        opacity: 0.8,
        fontFamily: 'var(--sc-font-body, system-ui, sans-serif)',
      }}
    >
      <strong style={{ fontSize: 36 }}>{`<${name}>`}</strong>
      <span style={{ fontSize: 26, whiteSpace: 'pre-line' }}>{`This vault component is not loaded: ${message}`}</span>
    </div>
  )
  Placeholder.displayName = `Unavailable(${name})`
  return Placeholder
}
