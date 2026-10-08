/** App files (Part 4 §4.3): from the checkout on disk, or from the binary's embedded table. */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, normalize, relative, sep } from 'node:path'
import { embedded } from '../embedded.generated.ts'
import { APP_ROOT, IS_BUNDLED } from './paths.ts'

const clean = (rel: string): string | null => {
  const n = normalize(rel).split(sep).join('/').replace(/^\/+/, '')
  return n.startsWith('..') || n.includes('\0') ? null : n
}

export function appFile(rel: string): ReturnType<typeof Bun.file> | null {
  const path = clean(rel)
  if (!path) return null
  if (IS_BUNDLED) return embedded[path] ? Bun.file(embedded[path]) : null
  const full = join(APP_ROOT, path)
  try {
    return statSync(full).isFile() ? Bun.file(full) : null
  } catch {
    return null
  }
}

export function readAppText(rel: string): string | null {
  const path = clean(rel)
  if (!path) return null
  if (IS_BUNDLED) return embedded[path] ? readFileSync(embedded[path], 'utf8') : null
  const full = join(APP_ROOT, path)
  return existsSync(full) ? readFileSync(full, 'utf8') : null
}

export function listAppFiles(prefix: string): string[] {
  if (IS_BUNDLED) return Object.keys(embedded).filter((k) => k.startsWith(prefix))
  const root = join(APP_ROOT, prefix)
  const out: string[] = []
  const walk = (dir: string) => {
    if (!existsSync(dir)) return
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) walk(full)
      else out.push(relative(APP_ROOT, full).split(sep).join('/'))
    }
  }
  walk(root)
  return out
}

/** The presentation author guide: the body of generated AGENTS.md files and chat prompts. */
export const readAuthorGuide = (): string | null => readAppText('docs/agents/presentation-author.md')
