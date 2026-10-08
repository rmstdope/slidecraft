import type { ComponentType } from 'react'

/** A compiled deck module: bundled by Vite or compiled in the browser at runtime. */
export interface DeckModule {
  default: ComponentType<Record<string, unknown>>
}

export type DeckModuleLoader = () => Promise<DeckModule>
