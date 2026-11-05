/**
 * Keeps the `slidecraft-presentations` skill in every writable vault (UX overhaul U4), at
 * `<vault>/.claude/skills/slidecraft-presentations/`, where Claude Code (in the app or in a
 * terminal opened in the vault) finds it. A marker file records a hash of every file written;
 * when any file differs from its hash, or the folder exists without the marker, a person edited
 * it, and the skill is left alone from then on.
 */
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, sep } from 'node:path'
import { listAppFiles, readAppBytes } from './appFiles.ts'
import { getContentSources, type ContentSource } from './contentSources.ts'
import { VERSION } from './paths.ts'

export const SKILL_NAME = 'slidecraft-presentations'
export const SKILL_SOURCE = `skills/${SKILL_NAME}/`
export const MARKER_FILE = '.slidecraft-generated.json'

export const vaultSkillDir = (vaultPath: string): string => join(vaultPath, '.claude', 'skills', SKILL_NAME)

interface Marker {
  generator: 'slidecraft'
  version: string
  files: Record<string, string>
}

const hash = (bytes: Buffer | string): string => createHash('sha256').update(bytes).digest('hex')

/** The skill as Slidecraft ships it: path inside the skill folder → bytes. */
export function skillFiles(): Map<string, Buffer> {
  const files = new Map<string, Buffer>()
  for (const appPath of listAppFiles(SKILL_SOURCE)) {
    const bytes = readAppBytes(appPath)
    if (bytes) files.set(appPath.slice(SKILL_SOURCE.length), bytes)
  }
  return files
}

function filesIn(dir: string): string[] {
  const out: string[] = []
  const walk = (d: string) => {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      const full = join(d, entry.name)
      if (entry.isDirectory()) walk(full)
      else out.push(relative(dir, full).split(sep).join('/'))
    }
  }
  if (existsSync(dir) && statSync(dir).isDirectory()) walk(dir)
  return out
}

function readMarker(dir: string): Marker | null {
  try {
    const marker = JSON.parse(readFileSync(join(dir, MARKER_FILE), 'utf8')) as Marker
    return marker?.generator === 'slidecraft' && marker.files && typeof marker.files === 'object' ? marker : null
  } catch {
    return null
  }
}

export type SkillSyncResult = 'written' | 'unchanged' | 'hand-edited' | 'read-only' | 'missing-dir' | 'no-skill'

/** Bring one vault's copy of the skill up to date, unless a person has edited it. */
export function syncSkill(vault: ContentSource, files = skillFiles()): SkillSyncResult {
  // The repository's own examples already see the skill through the repository's .claude/skills.
  if (vault.readOnly || vault.builtIn) return 'read-only'
  if (!existsSync(vault.path)) return 'missing-dir'
  if (files.size === 0) return 'no-skill'
  const dir = vaultSkillDir(vault.path)
  const present = filesIn(dir).filter((f) => f !== MARKER_FILE)
  const marker = readMarker(dir)
  if (present.length > 0 && !marker) return 'hand-edited'
  if (marker) {
    const edited = present.some((f) => marker.files[f] !== hash(readFileSync(join(dir, f)))) || Object.keys(marker.files).some((f) => !present.includes(f))
    if (edited) return 'hand-edited'
  }
  const wanted = Object.fromEntries([...files].map(([f, bytes]) => [f, hash(bytes)]))
  const same = marker && present.length === files.size && present.every((f) => wanted[f] === marker.files[f])
  if (same) return 'unchanged'
  for (const f of present) if (!(f in wanted)) rmSync(join(dir, f))
  for (const [f, bytes] of files) {
    mkdirSync(dirname(join(dir, f)), { recursive: true })
    writeFileSync(join(dir, f), bytes)
  }
  const next: Marker = { generator: 'slidecraft', version: VERSION, files: wanted }
  writeFileSync(join(dir, MARKER_FILE), `${JSON.stringify(next, null, 2)}\n`)
  return 'written'
}

/** Every writable vault (server start, and after the vaults change). */
export function syncSkillsToVaults(): Map<ContentSource, SkillSyncResult> {
  const files = skillFiles()
  const results = new Map<ContentSource, SkillSyncResult>()
  for (const vault of getContentSources()) {
    try {
      results.set(vault, syncSkill(vault, files))
    } catch (error) {
      console.warn(`Could not sync the ${SKILL_NAME} skill into ${vault.path}: ${(error as Error).message}`)
    }
  }
  return results
}
