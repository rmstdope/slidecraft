import { describe, expect, test } from 'bun:test'
import type { AgentEvent, AgentEventBody } from '../shared/agent.ts'
import { addEvent, pendingApproval, toTurns } from '../src/agent/threadEvents'

let seq = 0
const ev = (turn: number, body: AgentEventBody): AgentEvent => ({ ...body, seq: ++seq, turn, at: seq } as AgentEvent)

describe('addEvent', () => {
  test('merges text deltas of one turn and ignores events already shown', () => {
    const a = ev(1, { type: 'text', text: 'Hel' })
    const b = ev(1, { type: 'text', text: 'lo' })
    let list = addEvent([], a)
    list = addEvent(list, b)
    list = addEvent(list, b) // a repeat after a reconnect
    expect(list).toEqual([{ ...a, text: 'Hello', seq: b.seq, at: b.at } as AgentEvent])
    const next = ev(2, { type: 'text', text: 'Next turn' })
    expect(addEvent(list, next)).toHaveLength(2)
  })
})

describe('toTurns', () => {
  test('groups a turn into the message, text, a run of tool calls, an approval and the outcome', () => {
    const events = [
      ev(1, { type: 'user-message', text: 'Shorter title', context: { slide: 2, selection: 'x' } }),
      ev(1, { type: 'text', text: 'On it.' }),
      ev(1, { type: 'tool-call', call: { id: 'a', name: 'Read', summary: 'Read q/index.mdx' } }),
      ev(1, { type: 'tool-result', id: 'a', ok: true }),
      ev(1, { type: 'tool-call', call: { id: 'b', name: 'Edit', summary: 'Edit q/index.mdx' } }),
      ev(1, { type: 'tool-result', id: 'b', ok: false, summary: 'old_string not found' }),
      ev(1, { type: 'file-changed', path: 'q/index.mdx' }),
      ev(1, { type: 'approval-request', id: 'p', tool: 'Bash', summary: 'Run: make' }),
    ]
    const turns = toTurns(events)
    expect(turns).toHaveLength(1)
    const [turn] = turns
    expect(turn.user).toEqual({ text: 'Shorter title', slide: 2, selection: true })
    expect(turn.items.map((i) => i.kind)).toEqual(['text', 'tools', 'approval'])
    const tools = turn.items[1].kind === 'tools' ? turn.items[1].tools : []
    expect(tools.map((t) => t.state)).toEqual(['ok', 'failed'])
    expect(tools[1].error).toBe('old_string not found')
    expect(turn.files).toEqual(['q/index.mdx'])
    expect(pendingApproval(turns)).toMatchObject({ id: 'p', summary: 'Run: make' })

    const answered = toTurns([...events, ev(1, { type: 'approval-resolved', id: 'p', allowed: false }), ev(1, { type: 'tool-call', call: { id: 'c', name: 'Bash', summary: 'Run: ls' } }), ev(1, { type: 'turn-done', ok: false, stopped: true })])
    expect(pendingApproval(answered)).toBeUndefined()
    const last = answered[0].items.at(-1)
    expect(last?.kind === 'tools' && last.tools[0].state).toBe('failed') // cut short by the stop
    expect(answered[0].done).toEqual({ ok: false, error: undefined, costUsd: undefined, stopped: true })
  })
})

describe('agent markdown', () => {
  test('paragraphs, lists and code blocks', async () => {
    const { parseBlocks } = await import('../src/agent/markdown')
    expect(parseBlocks('I made three slides:\n\n1. **Title**: Team offsite\n2. Agenda\n- a\n- b\n\n```mdx\n<Slide />\n```\nDone.')).toEqual([
      { kind: 'p', text: 'I made three slides:' },
      { kind: 'ol', items: ['**Title**: Team offsite', 'Agenda'] },
      { kind: 'ul', items: ['a', 'b'] },
      { kind: 'code', text: '<Slide />' },
      { kind: 'p', text: 'Done.' },
    ])
  })
  test('bold and code become elements, never HTML', async () => {
    const { inline } = await import('../src/agent/markdown')
    const parts = inline('Edit **`q3`** and `<script>`')
    expect(parts).toHaveLength(4)
    expect(parts[0]).toBe('Edit ')
    expect(typeof parts[3]).toBe('object') // the <script> text sits inside a <code> element
  })
})
