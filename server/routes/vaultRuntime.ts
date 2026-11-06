/**
 * `GET /vault-runtime/<file>.js`: the import-map shims for vault components (vault components
 * plan, V1), from `server/lib/vaultShims.ts`.
 */
import { VAULT_RUNTIME_PREFIX, vaultModuleForFile } from '../../shared/vaultRuntime.ts'
import { errorJson } from '../lib/http.ts'
import { vaultShim } from '../lib/vaultShims.ts'

export async function handleVaultRuntime(pathname: string): Promise<Response> {
  const name = vaultModuleForFile(pathname.slice(VAULT_RUNTIME_PREFIX.length))
  if (!name) return errorJson(404, 'Not found')
  return new Response(await vaultShim(name), { headers: { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'no-cache' } })
}
