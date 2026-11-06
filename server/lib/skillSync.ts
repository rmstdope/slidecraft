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
import { buildVaultCatalogue } from './agentContext.ts'

export const SKILL_NAME = 'slidecraft-presentations'
/** The components skill, for a vault's own components and templates (vault components plan, V4). */
export const COMPONENTS_SKILL = 'slidecraft-components'
export const VAULT_SKILLS = [SKILL_NAME, COMPONENTS_SKILL] as const
export type VaultSkill = (typeof VAULT_SKILLS)[number]
export const MARKER_FILE = '.slidecraft-generated.json'
/** Generated per vault into its copy of the presentations skill: the vault's own components. */
export const VAULT_CATALOGUE = 'references/vault-components.md'

export const vaultSkillDir = (vaultPath: string, skill: VaultSkill = SKILL_NAME): string => join(vaultPath, '.claude', 'skills', skill)

interface Marker {
  generator: 'slidecraft'
  version: string
  files: Record<string, string>
}

const hash = (bytes: Buffer | string): string => createHash('sha256').update(bytes).digest('hex')

/** The skill as Slidecraft ships it: path inside the skill folder → bytes. */
export function skillFiles(skill: VaultSkill = SKILL_NAME): Map<string, Buffer> {
  const prefix = `skills/${skill}/`
  const files = new Map<string, Buffer>()
  for (const appPath of listAppFiles(prefix)) {
    const bytes = readAppBytes(appPath)
    if (bytes) files.set(appPath.slice(prefix.length), bytes)
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
export function syncSkill(vault: ContentSource, files = skillFiles(), skill: VaultSkill = SKILL_NAME): SkillSyncResult {
  // The repository's own examples already see the skill through the repository's .claude/skills.
  if (vault.readOnly || vault.builtIn) return 'read-only'
  if (!existsSync(vault.path)) return 'missing-dir'
  if (files.size === 0) return 'no-skill'
  const dir = vaultSkillDir(vault.path, skill)
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

/** One vault's skills: the shipped files, plus the presentations skill's catalogue of the vault's own. */
export async function syncVaultSkills(vault: ContentSource, shipped?: Map<VaultSkill, Map<string, Buffer>>): Promise<Record<VaultSkill, SkillSyncResult>> {
  const out = {} as Record<VaultSkill, SkillSyncResult>
  for (const skill of VAULT_SKILLS) {
    const files = new Map(shipped?.get(skill) ?? skillFiles(skill))
    if (skill === SKILL_NAME && files.size && !vault.readOnly && !vault.builtIn && existsSync(vault.path)) {
      const catalogue = await buildVaultCatalogue(vault.id)
      if (catalogue) files.set(VAULT_CATALOGUE, Buffer.from(catalogue))
    }
    try {
      out[skill] = syncSkill(vault, files, skill)
    } catch (error) {
      console.warn(`Could not sync the ${skill} skill into ${vault.path}: ${(error as Error).message}`)
    }
  }
  return out
}

/** Every writable vault (server start, and after the vaults change). */
export async function syncSkillsToVaults(): Promise<Map<ContentSource, Record<VaultSkill, SkillSyncResult>>> {
  const shipped = new Map(VAULT_SKILLS.map((skill) => [skill, skillFiles(skill)] as const))
  const results = new Map<ContentSource, Record<VaultSkill, SkillSyncResult>>()
  for (const vault of getContentSources()) results.set(vault, await syncVaultSkills(vault, shipped))
  return results
}
