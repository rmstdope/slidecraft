/**
 * The agent backend seam (UX overhaul U2). A backend runs one turn of a conversation in a vault
 * folder and reports what happens as normalised events; the thread runner owns storage,
 * broadcasting, approvals and stopping. Backends never talk to the browser.
 */
import type { AgentBackendId, AgentBackendInfo, AgentEventBody } from '../../../shared/agent.ts'

export interface ApprovalRequest {
  tool: string
  summary: string
  detail?: string
}

export interface TurnInput {
  /** The vault folder: the agent's working directory. */
  cwd: string
  /** The vault id, for the Slidecraft MCP server the agent gets. */
  vault: string
  /** The user's message with the per-message context in front of it. */
  prompt: string
  /** Standing instructions, appended to the agent's own system prompt. */
  instructions: string
  /** The backend's session to continue, from an earlier turn. */
  sessionId?: string
  model?: string
  signal: AbortSignal
  emit(event: AgentEventBody): void
  /** Ask the person; resolves false when they deny or the turn is stopped. */
  requestApproval(request: ApprovalRequest): Promise<boolean>
}

export interface TurnResult {
  ok: boolean
  /** The session to resume next turn. */
  sessionId?: string
  error?: string
  costUsd?: number
}

export interface AgentBackend {
  id: AgentBackendId
  name: string
  detect(): Promise<AgentBackendInfo>
  runTurn(input: TurnInput): Promise<TurnResult>
}
