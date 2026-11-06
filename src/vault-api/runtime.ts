import * as React from 'react'
import * as jsxRuntime from 'react/jsx-runtime'
import * as motion from 'motion/react'
import { VAULT_MODULES_GLOBAL, type VaultModules } from '@shared/vaultRuntime.ts'
import * as slidecraft from './index'

/** The app's own modules, as vault components import them (see shared/vaultRuntime.ts). */
export const vaultModules: VaultModules = {
  slidecraft,
  react: React,
  'react/jsx-runtime': jsxRuntime,
  'motion/react': motion,
}

/** Makes the modules reachable for the import-map shims; call before any vault module loads. */
export function installVaultRuntime(): void {
  ;(globalThis as Record<string, unknown>)[VAULT_MODULES_GLOBAL] = vaultModules
}
