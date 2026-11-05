/**
 * The agent contract (UX overhaul U2): threads, the events a turn streams to the browser, and the
 * requests the browser sends back. Backends (Claude Code, later Copilot) are normalised to these
 * events on the server; the browser never sees a CLI's own format.
 */
import type { DeckRef } from './decks.ts'
import type { DiffHunk } from './lineDiff.ts'

export type AgentBackendId = 'claude-code' | 'copilot'

export interface AgentBackendInfo {
  id: AgentBackendId
  name: string
  /** Installed and runnable. */
  available: boolean
  version?: string
  /** Why it is not available, or how to set it up. */
  detail?: string
  /** Can ask the person before a tool runs; without it, anything not allowed up front is refused. */
  approvals: boolean
}

/** A conversation about one deck, or about the vault as a whole (`deck` absent). */
export interface ThreadInfo {
  id: string
  vault: string
  deck?: DeckRef
  title: string
  backend: AgentBackendId
  createdAt: number
  updatedAt: number
  /** A turn is running right now. */
  running: boolean
}

/** What the user is looking at when they send a message. */
export interface MessageContext {
  /** 0-based slide shown in the preview. */
  slide?: number
  /** Text selected in the code editor. */
  selection?: string
  /** Files dropped into the conversation, as vault-relative paths. */
  attachments?: string[]
}

/** One finding of the deck check (`validate_deck`, and the check after every turn). */
export interface DeckProblem {
  severity: 'error' | 'warning'
  /** 1-based line in the file. */
  line?: number
  /** 0-based slide index, when the problem sits in one slide. */
  slide?: number
  message: string
}

/** A file an agent turn added, changed or deleted, as a vault-relative path. */
export interface FileChange {
  path: string
  status: 'added' | 'modified' | 'deleted'
}

/** GET …/turns/<n>/diff: what one turn changed, file by file. */
export interface TurnDiff {
  turn: number
  undone: boolean
  files: (FileChange & { binary?: boolean; tooLarge?: boolean; hunks?: DiffHunk[] })[]
}

/** A tool call, summarised for display ("Edit q3/index.mdx"). */
export interface ToolCallInfo {
  id: string
  name: string
  summary: string
}

export type AgentEventBody =
  | { type: 'user-message'; text: string; context?: MessageContext }
  | { type: 'text'; text: string }
  | { type: 'tool-call'; call: ToolCallInfo }
  | { type: 'tool-result'; id: string; ok: boolean; summary?: string }
  | { type: 'file-changed'; path: string }
  | { type: 'approval-request'; id: string; tool: string; summary: string; detail?: string }
  | { type: 'approval-resolved'; id: string; allowed: boolean }
  | { type: 'changes'; files: FileChange[] }
  | { type: 'deck-check'; path: string; ok: boolean; problems: DeckProblem[] }
  | { type: 'turn-undone'; files: string[] }
  | { type: 'turn-done'; ok: boolean; error?: string; costUsd?: number; stopped?: boolean }

/** One event of a thread. `seq` orders them; a turn starts with `user-message` and ends with `turn-done`. */
export type AgentEvent = AgentEventBody & { seq: number; turn: number; at: number }

/** GET /api/agent/threads/<vault>/<id> */
export interface ThreadDetail extends ThreadInfo {
  events: AgentEvent[]
}

/** Broadcast on /api/events for every new event of any thread. */
export interface AgentServerEvent {
  type: 'agent-event'
  thread: string
  vault: string
  event: AgentEvent
  timestamp: number
}

/** Broadcast when a thread is created, renamed, or starts or stops running. */
export interface AgentThreadServerEvent {
  type: 'agent-thread'
  thread: ThreadInfo
  timestamp: number
}

export const AGENT_BACKENDS: { id: AgentBackendId; name: string }[] = [
  { id: 'claude-code', name: 'Claude Code' },
  { id: 'copilot', name: 'GitHub Copilot CLI' },
]
