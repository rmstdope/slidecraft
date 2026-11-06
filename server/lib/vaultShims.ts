/**
 * The import-map shims for vault components (vault components plan, V1): each re-exports the
 * app's own module from a global. The export names are read from the same packages here, so a
 * shim always lists what the app (or the export viewer, built from the same code) has.
 */
import { shimSource, VAULT_MODULE_NAMES, type VaultModuleName } from '../../shared/vaultRuntime.ts'

const loaders: Record<VaultModuleName, () => Promise<Record<string, unknown>>> = {
  slidecraft: () => import('../../src/vault-api/index.ts'),
  react: () => import('react'),
  'react/jsx-runtime': () => import('react/jsx-runtime'),
  'motion/react': () => import('motion/react'),
}

const cache = new Map<VaultModuleName, string>()

export async function vaultShim(name: VaultModuleName): Promise<string> {
  let source = cache.get(name)
  if (!source) {
    source = shimSource(name, Object.keys(await loaders[name]()))
    cache.set(name, source)
  }
  return source
}

/** An import map whose shims are `data:` URLs, for a page with no server (the HTML export). */
export async function inlineVaultImportMap(): Promise<{ imports: Record<string, string> }> {
  const imports: Record<string, string> = {}
  for (const name of VAULT_MODULE_NAMES) imports[name] = `data:text/javascript;base64,${Buffer.from(await vaultShim(name), 'utf8').toString('base64')}`
  return { imports }
}
