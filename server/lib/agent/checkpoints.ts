/**
 * Per-turn checkpoints (UX overhaul U5). Before a turn, every file in its scope (the deck folder,
 * or the whole vault for a vault conversation) is hashed and its bytes kept once by hash; after
 * the turn the scope is hashed again. The difference is what the turn changed, and undoing it
 * puts the earlier bytes back — refused when any of those files has changed since the turn.
 *
 *   <vault>/.slidecraft/checkpoints/<thread>.json   turn records (last KEEP_TURNS per thread)
 *   <vault>/.slidecraft/checkpoints/blobs/<sha256>  file contents, shared by every record
 */
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import type { FileChange, TurnDiff } from '../../../shared/agent.ts'
import { diffLines, toHunks } from '../../../shared/lineDiff.ts'

export const KEEP_TURNS = 20
/** Folders a checkpoint never looks into: Slidecraft's and the agent's own state, exports, tooling. */
export const EXCLUDED_DIRS = new Set(['.slidecraft', '.claude', '.git', 'node_modules', 'exports'])
/** Larger files are left out of checkpoints (and so cannot be restored). */
export const MAX_FILE_BYTES = 25 * 1024 * 1024

type Manifest = Record<string, string> // vault-relative path → sha256

interface TurnRecord {
  turn: number
  /** Vault-relative folder the checkpoint covers; '' is the whole vault. */
  scope: string
  before: Manifest
  after?: Manifest
  undone?: boolean
  at: number
}

interface ThreadCheckpoints {
  version: 1
  turns: TurnRecord[]
}

export class CheckpointError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly conflicts: string[] = [],
  ) {
    super(message)
  }
}

const rootOf = (vaultPath: string) => join(vaultPath, '.slidecraft', 'checkpoints')
const blobDir = (vaultPath: string) => join(rootOf(vaultPath), 'blobs')
const recordFile = (vaultPath: string, thread: string) => join(rootOf(vaultPath), `${thread}.json`)
const sha = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex')

function load(vaultPath: string, thread: string): ThreadCheckpoints {
  try {
    const parsed = JSON.parse(readFileSync(recordFile(vaultPath, thread), 'utf8')) as ThreadCheckpoints
    if (parsed?.version === 1 && Array.isArray(parsed.turns)) return parsed
  } catch {
    /* none yet */
  }
  return { version: 1, turns: [] }
}

function save(vaultPath: string, thread: string, data: ThreadCheckpoints): void {
  mkdirSync(rootOf(vaultPath), { recursive: true })
  const file = recordFile(vaultPath, thread)
  writeFileSync(`${file}.tmp`, JSON.stringify(data))
  renameSync(`${file}.tmp`, file)
}

/** Hash every file under the scope, keeping each file's bytes in the blob store. */
function snapshot(vaultPath: string, scope: string): Manifest {
  const manifest: Manifest = {}
  const start = resolve(vaultPath, scope)
  if (!existsSync(start)) return manifest
  mkdirSync(blobDir(vaultPath), { recursive: true })
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (!EXCLUDED_DIRS.has(entry.name)) walk(join(dir, entry.name))
        continue
      }
      if (!entry.isFile() || entry.name === '.DS_Store') continue
      const full = join(dir, entry.name)
      if (statSync(full).size > MAX_FILE_BYTES) continue
      const bytes = readFileSync(full)
      const hash = sha(bytes)
      const blob = join(blobDir(vaultPath), hash)
      if (!existsSync(blob)) writeFileSync(blob, bytes)
      manifest[relative(vaultPath, full).split(sep).join('/')] = hash
    }
  }
  walk(start)
  return manifest
}

function changesOf(record: TurnRecord): FileChange[] {
  const after = record.after ?? {}
  const changes: FileChange[] = []
  for (const [path, hash] of Object.entries(after)) {
    if (!(path in record.before)) changes.push({ path, status: 'added' })
    else if (record.before[path] !== hash) changes.push({ path, status: 'modified' })
  }
  for (const path of Object.keys(record.before)) if (!(path in after)) changes.push({ path, status: 'deleted' })
  return changes.sort((a, b) => a.path.localeCompare(b.path))
}

/** Delete blobs no turn of any thread in this vault still needs. */
function collectGarbage(vaultPath: string): void {
  const root = rootOf(vaultPath)
  if (!existsSync(blobDir(vaultPath))) return
  const live = new Set<string>()
  for (const file of readdirSync(root)) {
    if (!file.endsWith('.json')) continue
    for (const t of load(vaultPath, file.slice(0, -'.json'.length)).turns) for (const m of [t.before, t.after ?? {}]) for (const h of Object.values(m)) live.add(h)
  }
  for (const blob of readdirSync(blobDir(vaultPath))) if (!live.has(blob)) rmSync(join(blobDir(vaultPath), blob), { force: true })
}

/** Before a turn: remember what the scope looks like. */
export function beginCheckpoint(vaultPath: string, thread: string, turn: number, scope: string): void {
  const data = load(vaultPath, thread)
  data.turns = data.turns.filter((t) => t.turn !== turn)
  data.turns.push({ turn, scope, before: snapshot(vaultPath, scope), at: Date.now() })
  save(vaultPath, thread, data)
}

/** After a turn: what it changed. Old turns beyond KEEP_TURNS are forgotten. */
export function finishCheckpoint(vaultPath: string, thread: string, turn: number): FileChange[] {
  const data = load(vaultPath, thread)
  const record = data.turns.find((t) => t.turn === turn)
  if (!record) return []
  record.after = snapshot(vaultPath, record.scope)
  const changes = changesOf(record)
  // A turn that changed nothing needs no checkpoint.
  data.turns = data.turns.filter((t) => t !== record || changes.length > 0).slice(-KEEP_TURNS)
  save(vaultPath, thread, data)
  collectGarbage(vaultPath)
  return changes
}

const blobText = (vaultPath: string, hash: string | undefined): Buffer | null => (hash ? readFileSync(join(blobDir(vaultPath), hash)) : Buffer.alloc(0))
const isBinary = (bytes: Buffer) => bytes.subarray(0, 8000).includes(0)

export function turnDiff(vaultPath: string, thread: string, turn: number): TurnDiff {
  const record = load(vaultPath, thread).turns.find((t) => t.turn === turn && t.after)
  if (!record) throw new CheckpointError(404, 'This turn has no checkpoint (it changed nothing, or is too old)')
  const files = changesOf(record).map((change) => {
    const before = blobText(vaultPath, record.before[change.path])
    const after = blobText(vaultPath, record.after![change.path])
    if (!before || !after || isBinary(before) || isBinary(after)) return { ...change, binary: true }
    const lines = diffLines(before.toString('utf8'), after.toString('utf8'))
    return lines ? { ...change, hunks: toHunks(lines) } : { ...change, tooLarge: true }
  })
  return { turn, undone: !!record.undone, files }
}

const currentHash = (vaultPath: string, path: string): string | null => {
  const full = join(vaultPath, path)
  return existsSync(full) && statSync(full).isFile() ? sha(readFileSync(full)) : null
}

/** After removing a file a turn added: drop the folders it leaves empty, up to the scope. */
function removeEmptyParents(dir: string, stop: string): void {
  for (let d = dir; d.startsWith(stop + sep) && existsSync(d) && readdirSync(d).length === 0; d = dirname(d)) rmSync(d, { recursive: true })
}

/**
 * Put the files a turn changed back as they were before it. Refused (409) when any of them has
 * changed since the turn ended, so a later edit is never lost.
 */
export function undoTurn(vaultPath: string, thread: string, turn: number): FileChange[] {
  const data = load(vaultPath, thread)
  const record = data.turns.find((t) => t.turn === turn && t.after)
  if (!record) throw new CheckpointError(404, 'This turn has no checkpoint (it changed nothing, or is too old)')
  if (record.undone) throw new CheckpointError(409, 'This turn is already undone')
  const changes = changesOf(record)
  const conflicts = changes.filter((c) => currentHash(vaultPath, c.path) !== (record.after![c.path] ?? null)).map((c) => c.path)
  if (conflicts.length) throw new CheckpointError(409, `Changed since this turn: ${conflicts.join(', ')}. Undo it by hand, or ask the agent.`, conflicts)
  for (const change of changes) {
    const full = join(vaultPath, change.path)
    const before = record.before[change.path]
    if (before) {
      mkdirSync(dirname(full), { recursive: true })
      writeFileSync(full, readFileSync(join(blobDir(vaultPath), before)))
    } else {
      rmSync(full, { force: true })
      removeEmptyParents(dirname(full), resolve(vaultPath, record.scope))
    }
  }
  // A folder the turn created (a new vault component) goes too once it is empty again.
  const scopeDir = resolve(vaultPath, record.scope)
  if (record.scope && Object.keys(record.before).length === 0 && existsSync(scopeDir) && readdirSync(scopeDir).length === 0) rmSync(scopeDir, { recursive: true })
  record.undone = true
  save(vaultPath, thread, data)
  return changes
}
