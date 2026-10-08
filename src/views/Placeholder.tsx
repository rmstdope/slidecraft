import type { ReactNode } from 'react'

interface PlaceholderProps {
  title: string
  children?: ReactNode
  onHome?: () => void
}

/** Stand-in for views that later phases implement. */
export function Placeholder({ title, children, onHome }: PlaceholderProps) {
  return (
    <main className="placeholder">
      {onHome && (
        <button type="button" className="pill-button placeholder__home" onClick={onHome}>
          ← Home
        </button>
      )}
      <h1>{title}</h1>
      {children}
    </main>
  )
}
