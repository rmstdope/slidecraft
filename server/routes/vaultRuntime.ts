/**
 * `GET /vault-runtime/<file>.js`: the import-map shims for vault components (vault components
 * plan, V1). Each re-exports the browser app's own module from a global; the export names are
 * read from the same packages here, so the shim always lists what the app has.
 */
import { shimSource, VAULT_RUNTIME_PREFIX, vaultModuleForFile, type VaultModuleName } from '../../shared/vaultRuntime.ts'
import { errorJson } from '../lib/http.ts'

const loaders: Record<VaultModuleName, () => Promise<Record<string, unknown>>> = {
  slidecraft: () => import('../../src/vault-api/index.ts'),
  react: () => import('react'),
  'react/jsx-runtime': () => import('react/jsx-runtime'),
  'motion/react': () => import('motion/react'),
}

const cache = new Map<VaultModuleName, string>()

export async function handleVaultRuntime(pathname: string): Promise<Response> {
  const name = vaultModuleForFile(pathname.slice(VAULT_RUNTIME_PREFIX.length))
  if (!name) return errorJson(404, 'Not found')
  let source = cache.get(name)
  if (!source) {
    source = shimSource(name, Object.keys(await loaders[name]()))
    cache.set(name, source)
  }
  return new Response(source, { headers: { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'no-cache' } })
}
