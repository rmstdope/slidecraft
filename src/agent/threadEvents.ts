/**
 * Folding a thread's events into what the chat shows (UX overhaul U2). Pure, so it is tested
 * without a browser. Live text arrives as deltas; the stored thread has them merged.
 */
import type { AgentEvent, ToolCallInfo } from '@shared/agent.ts'

/** Add a live event to the list: skip what is already there, merge text deltas of one turn. */
export function addEvent(events: AgentEvent[], event: AgentEvent): AgentEvent[] {
  const last = events[events.length - 1]
  if (last && event.seq <= last.seq) return events
  if (event.type === 'text' && last?.type === 'text' && last.turn === event.turn) {
    return [...events.slice(0, -1), { ...last, text: last.text + event.text, seq: event.seq, at: event.at }]
  }
  return [...events, event]
}

export type ToolState = 'running' | 'ok' | 'failed' | 'waiting' | 'denied'

export type TurnItem =
  | { kind: 'text'; key: string; text: string }
  | { kind: 'tools'; key: string; tools: { call: ToolCallInfo; state: ToolState; error?: string }[] }
  | { kind: 'approval'; key: string; id: string; tool: string; summary: string; detail?: string; answer?: boolean }

export interface Turn {
  turn: number
  user?: { text: string; slide?: number; selection?: boolean }
  items: TurnItem[]
  files: string[]
  done?: { ok: boolean; error?: string; costUsd?: number; stopped?: boolean }
}

/** Group events by turn: the user's message, then text, runs of tool calls and approvals in order. */
export function toTurns(events: AgentEvent[]): Turn[] {
  const turns = new Map<number, Turn>()
  for (const event of events) {
    let turn = turns.get(event.turn)
    if (!turn) {
      turn = { turn: event.turn, items: [], files: [] }
      turns.set(event.turn, turn)
    }
    const lastItem = turn.items[turn.items.length - 1]
    switch (event.type) {
      case 'user-message':
        turn.user = { text: event.text, slide: event.context?.slide, selection: !!event.context?.selection }
        break
      case 'text':
        if (lastItem?.kind === 'text') lastItem.text += event.text
        else turn.items.push({ kind: 'text', key: `t${event.seq}`, text: event.text })
        break
      case 'tool-call': {
        const entry = { call: event.call, state: 'running' as ToolState }
        if (lastItem?.kind === 'tools') lastItem.tools.push(entry)
        else turn.items.push({ kind: 'tools', key: `c${event.seq}`, tools: [entry] })
        break
      }
      case 'tool-result':
        for (const item of turn.items)
          if (item.kind === 'tools')
            for (const tool of item.tools) if (tool.call.id === event.id) Object.assign(tool, { state: event.ok ? 'ok' : 'failed', error: event.summary })
        break
      case 'approval-request':
        turn.items.push({ kind: 'approval', key: `a${event.seq}`, id: event.id, tool: event.tool, summary: event.summary, detail: event.detail })
        break
      case 'approval-resolved':
        for (const item of turn.items) if (item.kind === 'approval' && item.id === event.id) item.answer = event.allowed
        break
      case 'file-changed':
        if (!turn.files.includes(event.path)) turn.files.push(event.path)
        break
      case 'turn-done':
        turn.done = { ok: event.ok, error: event.error, costUsd: event.costUsd, stopped: event.stopped }
        // Tool calls without a result when the turn ended were cut short.
        for (const item of turn.items) if (item.kind === 'tools') for (const tool of item.tools) if (tool.state === 'running') tool.state = event.ok ? 'ok' : 'failed'
        break
    }
  }
  return [...turns.values()].sort((a, b) => a.turn - b.turn)
}

/** The approval the person still has to answer, if any. */
export const pendingApproval = (turns: Turn[]): Extract<TurnItem, { kind: 'approval' }> | undefined => {
  const last = turns[turns.length - 1]
  if (!last || last.done) return undefined
  return last.items.find((i): i is Extract<TurnItem, { kind: 'approval' }> => i.kind === 'approval' && i.answer === undefined)
}
