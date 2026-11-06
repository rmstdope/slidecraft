/**
 * Which built-in components a vault can copy (vault components plan, V5), for `bun run skills`.
 * A built-in is copyable when its file holds it and only its parts, and every import is a shared
 * package or a name the `slidecraft` module exports as the very same thing. Anything else gets
 * the reason, said for an author: the gallery shows it.
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { BUILTIN_SOURCE_DIR, parseImports, SHARED_PACKAGES, STRUCTURAL_BUILTINS, type BuiltinCopiesManifest, type BuiltinCopyEntry } from '../shared/builtinCopies.ts'
import { getAllComponents } from '../src/components/slides/defineComponent.ts'
import '../src/components/slides/index.ts'

const ROOT = join(import.meta.dir, '..')
const SLIDES = join(ROOT, BUILTIN_SOURCE_DIR)
const API_INDEX = join(ROOT, 'src', 'vault-api', 'index.ts')
export const BUILTIN_COPIES_FILE = join(ROOT, 'shared', 'builtinCopies.json')

function resolveModule(from: string, spec: string): string | undefined {
  const base = join(dirname(from), spec)
  return [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts')].find((p) => existsSync(p) && !p.endsWith('/') && /\.tsx?$/.test(p))
}

/** Type names the slidecraft module exports: its `export type {…}` and the types of modules it re-exports whole. */
function apiTypeNames(): Set<string> {
  const names = new Set<string>()
  const collect = (file: string, text: string, depth: number) => {
    for (const m of text.matchAll(/^export\s+(?:declare\s+)?(?:interface|type)\s+(\w+)/gm)) names.add(m[1])
    for (const m of text.matchAll(/^export\s+(type\s+)?\{([^}]*)\}/gm)) {
      for (const raw of m[2].split(',')) {
        const part = raw.trim()
        if (!part) continue
        const exported = part.replace(/^type\s+/, '').split(/\s+as\s+/).pop()!.trim()
        if (m[1] || /^type\s+/.test(part)) names.add(exported)
      }
    }
    if (depth > 3) return
    for (const m of text.matchAll(/^export\s+\*\s+from\s+['"]([^'"]+)['"]/gm)) {
      const target = resolveModule(file, m[1])
      if (target) collect(target, readFileSync(target, 'utf8'), depth + 1)
    }
  }
  collect(API_INDEX, readFileSync(API_INDEX, 'utf8'), 0)
  return names
}

/** The barrel's `export { A, B } from './File'` lines: which file defines which components. */
function barrelFiles(): Map<string, string[]> {
  const text = readFileSync(join(SLIDES, 'index.ts'), 'utf8')
  const out = new Map<string, string[]>()
  for (const m of text.matchAll(/^export\s+\{([^}]+)\}\s+from\s+'\.\/(\w+)'/gm)) {
    out.set(`${m[2]}.tsx`, m[1].split(',').map((n) => n.trim()).filter(Boolean))
  }
  return out
}

const list = (names: string[]) => (names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`)

async function whyNot(file: string, api: Record<string, unknown>, types: Set<string>): Promise<string | undefined> {
  const path = join(SLIDES, file)
  const missing: string[] = []
  for (const imp of parseImports(readFileSync(path, 'utf8'))) {
    if (SHARED_PACKAGES.includes(imp.spec)) continue
    if (!imp.spec.startsWith('.')) return `It imports ${imp.spec}, which vault code cannot import.`
    const target = resolveModule(path, imp.spec)
    if (!target) return `It imports ${imp.spec}, which could not be found.`
    if (imp.sideEffect || imp.defaultName || imp.namespace) return `It imports ${imp.spec} in a way a vault copy cannot (only named imports carry over).`
    const mod = (await import(target)) as Record<string, unknown>
    for (const { name, type } of imp.named) {
      const offered = type ? types.has(name) : name in api && api[name] === mod[name]
      if (!offered) missing.push(name)
    }
  }
  if (missing.length) return `It uses ${list([...new Set(missing)])}, which the public slidecraft module does not offer.`
  return undefined
}

export async function buildBuiltinCopies(): Promise<BuiltinCopiesManifest> {
  const api = (await import('../src/vault-api/index.ts')) as Record<string, unknown>
  const types = apiTypeNames()
  const registry = new Map(getAllComponents(null).map((c) => [c.registry.name, c.registry]))
  const components: Record<string, BuiltinCopyEntry> = {}
  for (const [file, names] of barrelFiles()) {
    const tops = names.filter((n) => registry.has(n) && !registry.get(n)!.parent)
    for (const name of tops) {
      const parts = names.filter((n) => registry.get(n)?.parent === name)
      let reason: string | undefined
      if (STRUCTURAL_BUILTINS.includes(name)) reason = `${name} is part of how every deck is built, so a vault cannot replace it.`
      else if (tops.length > 1) reason = `It shares its file with ${list(tops.filter((n) => n !== name))}, and a vault folder holds one component and its parts.`
      else if (names.some((n) => n !== name && registry.get(n)?.parent !== name)) reason = `Its file defines more than ${name} and its parts.`
      else reason = await whyNot(file, api, types)
      components[name] = reason ? { reason } : { file, parts }
    }
  }
  return { components: Object.fromEntries(Object.entries(components).sort(([a], [b]) => a.localeCompare(b))) }
}

export const builtinCopiesText = async (): Promise<string> => `${JSON.stringify(await buildBuiltinCopies(), null, 2)}\n`
