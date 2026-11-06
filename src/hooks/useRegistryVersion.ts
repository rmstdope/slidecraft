import { useSyncExternalStore } from 'react'
import { getRegistryVersion, subscribeRegistry } from '../components/slides/defineComponent'

/** Re-renders when components or templates register, change or the active vault changes. */
export function useRegistryVersion(): number {
  return useSyncExternalStore(subscribeRegistry, getRegistryVersion, getRegistryVersion)
}
