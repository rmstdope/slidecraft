import { afterAll, describe, expect, test } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import * as slidecraft from '../src/vault-api/index'
import { vaultModules } from '../src/vault-api/runtime'
import { getAllComponents } from '../src/components/slides/defineComponent'
import { handleVaultRuntime } from '../server/routes/vaultRuntime'
import { shimSource, VAULT_MODULE_NAMES, VAULT_MODULES, VAULT_MODULES_GLOBAL, vaultImportMap, vaultModuleForFile } from '../shared/vaultRuntime'
import recorded from './fixtures/vault-api-exports.json'

const dir = mkdtempSync(join(tmpdir(), 'vault-api-'))
afterAll(() => rmSync(dir, { recursive: true, force: true }))

describe('the slidecraft module', () => {
  test('keeps every export vault code may depend on', () => {
    const now = Object.keys(slidecraft).sort()
    // Removing or renaming an export breaks vault components in people's folders.
    expect(recorded.filter((name) => !now.includes(name))).toEqual([])
    // Adding one is fine: record it here, and bump API_VERSION.
    expect(now).toEqual(recorded)
  })

  test('offers every built-in component under its registry name', () => {
    const api = slidecraft as Record<string, unknown>
    for (const c of getAllComponents(null)) expect(api[c.registry.name]).toBe(c.Component)
  })

  test('the runtime hands out the app’s own modules', () => {
    expect(Object.keys(vaultModules).sort()).toEqual([...VAULT_MODULE_NAMES].sort())
    expect(vaultModules.slidecraft).toBe(slidecraft)
  })
})

describe('import-map shims', () => {
  test('re-export the global module, including a name that clashes with a local', async () => {
    const fake = { default: 'the default', m: 'motion m', jsx: () => 'jsx', 'not-an-identifier': 1 }
    ;(globalThis as Record<string, unknown>)[VAULT_MODULES_GLOBAL] = { 'motion/react': fake }
    const file = join(dir, 'shim.mjs')
    writeFileSync(file, shimSource('motion/react', Object.keys(fake)))
    const shim = await import(file)
    expect(shim.default).toBe('the default')
    expect(shim.m).toBe('motion m')
    expect(shim.jsx).toBe(fake.jsx)
    expect('not-an-identifier' in shim).toBe(false)
  })

  test('fail clearly when the app has not provided the module', async () => {
    const file = join(dir, 'missing.mjs')
    writeFileSync(file, shimSource('react', ['useState']))
    // In a subprocess: bun test reports a module that throws while loading as not found.
    const run = Bun.spawnSync(['bun', '-e', `try { await import(${JSON.stringify(file)}) } catch (e) { console.log(e.message) }`])
    expect(run.stdout.toString()).toContain('Slidecraft has not provided react to vault components')
  })

  test('the import map names every module, below the base path', () => {
    expect(vaultImportMap('/app/').imports).toEqual({
      slidecraft: '/app/vault-runtime/slidecraft.js',
      react: '/app/vault-runtime/react.js',
      'react/jsx-runtime': '/app/vault-runtime/react-jsx-runtime.js',
      'motion/react': '/app/vault-runtime/motion-react.js',
    })
  })

  test('index.html carries the same import map', async () => {
    const html = await Bun.file(join(import.meta.dir, '..', 'index.html')).text()
    const json = /<script type="importmap">([\s\S]*?)<\/script>/.exec(html)?.[1]
    expect(json).toBeDefined()
    expect(JSON.parse(json!.replaceAll('%BASE_URL%', '/'))).toEqual(vaultImportMap('/'))
  })

  test('the server serves a shim per module and nothing else', async () => {
    for (const name of VAULT_MODULE_NAMES) {
      expect(vaultModuleForFile(VAULT_MODULES[name])).toBe(name)
      const res = await handleVaultRuntime(`/vault-runtime/${VAULT_MODULES[name]}`)
      expect(res.status).toBe(200)
      expect(res.headers.get('Content-Type')).toContain('javascript')
    }
    const api = await (await handleVaultRuntime('/vault-runtime/slidecraft.js')).text()
    expect(api).toContain('defineComponent')
    expect(api).toContain('Timeline')
    expect((await handleVaultRuntime('/vault-runtime/fs.js')).status).toBe(404)
  })
})
