/**
 * Agent threads (UX overhaul U2): stored per vault in `.slidecraft/conversations/<id>.json`, run one
 * turn at a time, broadcast over the shared SSE stream, with approvals and stop. A thread keeps
 * its backend session id, so it resumes after a server restart.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { AgentBackendId, AgentEvent, AgentEventBody, MessageContext, ThreadDetail, ThreadInfo } from '../../../shared/agent.ts'
import { deckName, type DeckRef } from '../../../shared/decks.ts'
import { buildAgentInstructions, buildDeckContext } from '../chat/prompt.ts'
import { getAgentSettings, getContentSource, type ContentSource } from '../contentSources.ts'
import { readDeckSource } from '../deckStore.ts'
import { resolveDeckRefInSources } from '../decks.ts'
import { broadcast } from '../events.ts'
import type { AgentBackend } from './backend.ts'
import { claudeCodeBackend } from './claudeCode.ts'

// ---- Backends ------------------------------------------------------------------------------

const backends = new Map<AgentBackendId, AgentBackend>([[claudeCodeBackend.id, claudeCodeBackend]])

export const getBackends = (): AgentBackend[] => [...backends.values()]
export const getBackend = (id: AgentBackendId): AgentBackend | undefined => backends.get(id)
export const DEFAULT_BACKEND: AgentBackendId = 'claude-code'

/** The backend new conversations use: the setting when it names a known backend. */
export function defaultBackend(): AgentBackendId {
  const wanted = getAgentSettings().backend as AgentBackendId | undefined
  return wanted && backends.has(wanted) ? wanted : DEFAULT_BACKEND
}

/** For tests: replace a backend with a scripted one. */
export function setBackend(backend: AgentBackend): void {
  backends.set(backend.id, backend)
}

// ---- Storage -------------------------------------------------------------------------------

interface StoredThread {
  version: 1
  info: Omit<ThreadInfo, 'running'>
  sessionId?: string
  events: AgentEvent[]
}

export class ThreadError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
  }
}

const ID_RE = /^[a-z0-9-]{8,64}$/
const dirOf = (vault: ContentSource) => join(vault.path, '.slidecraft', 'conversations')
const fileOf = (vault: ContentSource, id: string) => join(dirOf(vault), `${id}.json`)

const cache = new Map<string, StoredThread>() // key: vault:id
const keyOf = (vault: string, id: string) => `${vault}:${id}`

function save(vault: ContentSource, thread: StoredThread): void {
  mkdirSync(dirOf(vault), { recursive: true })
  const file = fileOf(vault, thread.info.id)
  const tmp = `${file}.tmp`
  writeFileSync(tmp, JSON.stringify(thread))
  renameSync(tmp, file)
}

function load(vault: ContentSource, id: string): StoredThread | null {
  if (!ID_RE.test(id)) return null
  const cached = cache.get(keyOf(vault.id, id))
  if (cached) return cached
  const file = fileOf(vault, id)
  if (!existsSync(file)) return null
  try {
    const thread = JSON.parse(readFileSync(file, 'utf8')) as StoredThread
    if (thread?.version !== 1 || thread.info?.id !== id) return null
    thread.info.vault = vault.id // the vault may have been renamed or re-added under another id
    if (thread.info.deck) thread.info.deck = { ...thread.info.deck, source: vault.id }
    cache.set(keyOf(vault.id, id), thread)
    return thread
  } catch {
    return null
  }
}

function vaultOf(id: string): ContentSource {
  const vault = getContentSource(id)
  if (!vault) throw new ThreadError(404, `No vault "${id}"`)
  return vault
}

// ---- Running turns -------------------------------------------------------------------------

interface ActiveTurn {
  abort: AbortController
  approvals: Map<string, (allowed: boolean) => void>
}

const active = new Map<string, ActiveTurn>() // key: vault:id

const infoOf = (thread: StoredThread): ThreadInfo => ({ ...thread.info, running: active.has(keyOf(thread.info.vault, thread.info.id)) })

function announce(thread: StoredThread): void {
  broadcast({ type: 'agent-thread', thread: infoOf(thread), timestamp: Date.now() })
}

/** Append an event: text deltas are broadcast as they come and stored merged. */
function append(vault: ContentSource, thread: StoredThread, turn: number, body: AgentEventBody): AgentEvent {
  const last = thread.events[thread.events.length - 1]
  const event = { ...body, seq: (last?.seq ?? 0) + 1, turn, at: Date.now() } as AgentEvent
  if (event.type === 'text' && last?.type === 'text' && last.turn === turn) {
    thread.events[thread.events.length - 1] = { ...last, text: last.text + event.text, seq: event.seq, at: event.at }
  } else thread.events.push(event)
  thread.info.updatedAt = event.at
  // A vault conversation that writes a new deck becomes that deck's conversation.
  if (event.type === 'file-changed' && !thread.info.deck) {
    const match = /^([^/].*)\/index\.mdx$/.exec(event.path)
    const deck = match ? { source: vault.id, path: match[1] } : undefined
    if (deck && resolveDeckRefInSources(deck)) {
      thread.info.deck = deck
      queueMicrotask(() => announce(thread))
    }
  }
  broadcast({ type: 'agent-event', thread: thread.info.id, vault: vault.id, event, timestamp: event.at })
  return event
}

// ---- Public API ----------------------------------------------------------------------------

export function listThreads(vaultId: string, deck?: DeckRef): ThreadInfo[] {
  const vault = vaultOf(vaultId)
  if (!existsSync(dirOf(vault))) return []
  const threads: ThreadInfo[] = []
  for (const file of readdirSync(dirOf(vault))) {
    if (!file.endsWith('.json')) continue
    const thread = load(vault, file.slice(0, -'.json'.length))
    if (!thread) continue
    if (deck && thread.info.deck?.path !== deck.path) continue
    threads.push(infoOf(thread))
  }
  return threads.sort((a, b) => b.updatedAt - a.updatedAt)
}

export function getThread(vaultId: string, id: string): ThreadDetail {
  const thread = load(vaultOf(vaultId), id)
  if (!thread) throw new ThreadError(404, 'No such conversation')
  return { ...infoOf(thread), events: thread.events }
}

export function createThread(vaultId: string, options: { deck?: DeckRef; backend?: AgentBackendId } = {}): ThreadInfo {
  const vault = vaultOf(vaultId)
  if (vault.readOnly) throw new ThreadError(403, `The vault "${vault.name}" is read-only`)
  const backend = options.backend ?? defaultBackend()
  if (!backends.has(backend)) throw new ThreadError(400, `Unknown agent "${backend}"`)
  if (options.deck && !resolveDeckRefInSources({ source: vault.id, path: options.deck.path })) throw new ThreadError(400, 'Invalid presentation reference')
  const now = Date.now()
  const thread: StoredThread = {
    version: 1,
    info: {
      id: crypto.randomUUID(),
      vault: vault.id,
      deck: options.deck ? { source: vault.id, path: options.deck.path } : undefined,
      title: options.deck ? deckName(options.deck) : 'New conversation',
      backend,
      createdAt: now,
      updatedAt: now,
    },
    events: [],
  }
  cache.set(keyOf(vault.id, thread.info.id), thread)
  save(vault, thread)
  announce(thread)
  return infoOf(thread)
}

/** The prompt for one message: what is on screen, then the person's words. */
async function promptFor(vault: ContentSource, thread: StoredThread, text: string, context?: MessageContext): Promise<string> {
  let deckContext = buildDeckContext(null)
  if (thread.info.deck) {
    const resolved = resolveDeckRefInSources(thread.info.deck)
    if (resolved) {
      deckContext = buildDeckContext({
        ref: thread.info.deck,
        source: await readDeckSource(resolved),
        currentSlideIndex: Number.isInteger(context?.slide) && context!.slide! >= 0 ? context!.slide : undefined,
        contentDir: vault.path,
      })
    }
  }
  const selection = context?.selection?.trim() ? `\n\n### Selected in the code editor\n\n\`\`\`mdx\n${context.selection.slice(0, 8000)}\n\`\`\`` : ''
  return `<slidecraft-context>\n${deckContext}${selection}\n</slidecraft-context>\n\n${text}`
}

/** Start a turn; it runs in the background and reports through events. */
export async function sendMessage(vaultId: string, id: string, text: string, context?: MessageContext): Promise<ThreadInfo> {
  const vault = vaultOf(vaultId)
  const thread = load(vault, id)
  if (!thread) throw new ThreadError(404, 'No such conversation')
  if (vault.readOnly) throw new ThreadError(403, `The vault "${vault.name}" is read-only`)
  if (!text.trim()) throw new ThreadError(400, 'The message is empty')
  const key = keyOf(vault.id, id)
  if (active.has(key)) throw new ThreadError(409, 'The agent is still working on the last message')
  const backend = backends.get(thread.info.backend)
  if (!backend) throw new ThreadError(400, `Unknown agent "${thread.info.backend}"`)

  const turn = (thread.events[thread.events.length - 1]?.turn ?? 0) + 1
  const run: ActiveTurn = { abort: new AbortController(), approvals: new Map() }
  active.set(key, run)
  if (thread.info.title === 'New conversation' || (thread.info.deck && thread.info.title === deckName(thread.info.deck) && turn === 1)) {
    thread.info.title = text.trim().replace(/\s+/g, ' ').slice(0, 80)
  }
  append(vault, thread, turn, { type: 'user-message', text, context })
  save(vault, thread)
  announce(thread)

  const prompt = await promptFor(vault, thread, text, context)
  const instructions = await buildAgentInstructions(vault.path)
  void (async () => {
    let result
    try {
      result = await backend.runTurn({
        cwd: vault.path,
        vault: vault.id,
        prompt,
        instructions,
        sessionId: thread.sessionId,
        model: getAgentSettings().model,
        signal: run.abort.signal,
        emit: (body) => append(vault, thread, turn, body),
        requestApproval: (request) =>
          new Promise<boolean>((resolve) => {
            if (run.abort.signal.aborted) return resolve(false)
            const approvalId = crypto.randomUUID()
            run.approvals.set(approvalId, (allowed) => {
              run.approvals.delete(approvalId)
              append(vault, thread, turn, { type: 'approval-resolved', id: approvalId, allowed })
              save(vault, thread)
              resolve(allowed)
            })
            append(vault, thread, turn, { type: 'approval-request', id: approvalId, ...request })
            save(vault, thread)
          }),
      })
    } catch (error) {
      result = { ok: false, error: (error as Error).message }
    }
    for (const decide of [...run.approvals.values()]) decide(false)
    if (result.sessionId) thread.sessionId = result.sessionId
    const stopped = run.abort.signal.aborted
    append(vault, thread, turn, { type: 'turn-done', ok: result.ok && !stopped, error: stopped ? undefined : result.error, costUsd: result.costUsd, stopped: stopped || undefined })
    active.delete(key)
    save(vault, thread)
    announce(thread)
  })()
  return infoOf(thread)
}

export function stopTurn(vaultId: string, id: string): boolean {
  const run = active.get(keyOf(vaultOf(vaultId).id, id))
  if (!run) return false
  run.abort.abort()
  for (const decide of [...run.approvals.values()]) decide(false)
  return true
}

export function resolveApproval(vaultId: string, id: string, approvalId: string, allowed: boolean): boolean {
  const decide = active.get(keyOf(vaultOf(vaultId).id, id))?.approvals.get(approvalId)
  if (!decide) return false
  decide(allowed)
  return true
}

/** For tests: wait until a thread's turn has finished. */
export async function settled(vaultId: string, id: string, timeoutMs = 5000): Promise<void> {
  const start = Date.now()
  while (active.has(keyOf(vaultId, id))) {
    if (Date.now() - start > timeoutMs) throw new Error('Turn did not finish')
    await Bun.sleep(5)
  }
}

/** For tests: forget cached threads (simulates a server restart). */
export function clearThreadCache(): void {
  cache.clear()
}
