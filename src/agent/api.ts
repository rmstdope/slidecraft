/** The agent API (UX overhaul U2). Helpers never throw: failures become `{ error }`. */
import type { AgentBackendId, AgentBackendInfo, MessageContext, ThreadDetail, ThreadInfo, ThreadTarget, TurnDiff } from '@shared/agent.ts'
import type { DeckRef } from '@shared/decks.ts'
import { appPath } from '../basePath'
import type { ApiResult } from '../api'

async function request<T>(path: string, init?: RequestInit): Promise<ApiResult<T>> {
  try {
    const res = await fetch(appPath(path), init)
    const body = (await res.json().catch(() => ({}))) as T & { error?: string; details?: string }
    if (!res.ok) return { error: body.details ? `${body.error}: ${body.details}` : (body.error ?? `HTTP ${res.status}`), status: res.status }
    return { data: body, status: res.status }
  } catch (error) {
    return { error: `Network error: ${(error as Error).message}` }
  }
}

const post = (body?: unknown): RequestInit => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body ?? {}) })
const threadPath = (vault: string, id: string) => `/api/agent/threads/${encodeURIComponent(vault)}/${encodeURIComponent(id)}`

export const fetchBackends = () => request<AgentBackendInfo[]>('/api/agent/backends')

export const fetchThreads = (vault: string, deck?: DeckRef, target?: ThreadTarget) =>
  request<ThreadInfo[]>(`/api/agent/threads?${new URLSearchParams({ vault, ...(deck ? { path: deck.path } : {}), ...(target ? { [target.kind]: target.name } : {}) })}`)

export const createThread = (vault: string, deck?: DeckRef, backend?: AgentBackendId, target?: ThreadTarget) =>
  request<ThreadInfo>('/api/agent/threads', post({ vault, path: deck?.path, backend, target }))

export const fetchThread = (vault: string, id: string) => request<ThreadDetail>(threadPath(vault, id))

export const sendMessage = (vault: string, id: string, text: string, context?: MessageContext) =>
  request<ThreadInfo>(`${threadPath(vault, id)}/messages`, post({ text, context }))

export const stopThread = (vault: string, id: string) => request<{ stopped: boolean }>(`${threadPath(vault, id)}/stop`, post())

export const answerApproval = (vault: string, id: string, approvalId: string, allow: boolean) =>
  request<{ ok: true }>(`${threadPath(vault, id)}/approvals/${encodeURIComponent(approvalId)}`, post({ allow }))

export const fetchTurnDiff = (vault: string, id: string, turn: number) => request<TurnDiff>(`${threadPath(vault, id)}/turns/${turn}/diff`)
export const undoTurn = (vault: string, id: string, turn: number) => request<{ files: string[] }>(`${threadPath(vault, id)}/turns/${turn}/undo`, post())

/** Upload a file dropped into the conversation; images for a deck go into its images/ folder. */
export function uploadAttachment(vault: string, deckPath: string | undefined, file: File) {
  const form = new FormData()
  form.set('vault', vault)
  if (deckPath) form.set('path', deckPath)
  form.set('file', file)
  return request<{ path: string; image: boolean }>('/api/agent/attachments', { method: 'POST', body: form })
}

export interface AgentSettings {
  backend: AgentBackendId
  model?: string
}

export const fetchAgentSettings = () => request<AgentSettings>('/api/agent/settings')
export const saveAgentSettings = (change: Partial<AgentSettings>) =>
  request<AgentSettings>('/api/agent/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(change) })
