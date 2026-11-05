import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { AgentEventBody } from '../shared/agent.ts'
import { copilotCommand, copilotMcpConfig, mapCopilotLine, newCopilotState, summarizeCopilotTool } from '../server/lib/agent/copilot.ts'

const lines = readFileSync(join(import.meta.dir, 'fixtures/agent/copilot-edit-and-shell.jsonl'), 'utf8')
  .trim()
  .split('\n')
  .map((l) => JSON.parse(l))

describe('Copilot stream mapping (recorded run)', () => {
  test('a real turn becomes tool calls, a changed file, a refused command, text and the result', () => {
    const state = newCopilotState('/vault')
    const events: AgentEventBody[] = []
    for (const line of lines) mapCopilotLine(state, line, (e) => events.push(e))
    const calls = events.flatMap((e) => (e.type === 'tool-call' ? [e.call.summary] : []))
    expect(calls).toEqual(['Read q4-plan/index.mdx', 'Edit q4-plan/index.mdx', "Run: python3 -c 'print(6*7)'"])
    expect(events.filter((e) => e.type === 'file-changed')).toEqual([{ type: 'file-changed', path: 'q4-plan/index.mdx' }])
    const refused = events.find((e) => e.type === 'tool-result' && !e.ok)
    expect(refused).toMatchObject({ ok: false, summary: expect.stringContaining('cannot ask for permission') })
    const text = events.flatMap((e) => (e.type === 'text' ? [e.text] : [])).join('')
    expect(text).toBe('Updated the title to “Q4 plan in two bets”; the requested Python command was blocked by permissions.')
    expect(state.result).toMatchObject({ ok: true, sessionId: expect.any(String) })
  })
  test('a message that never streamed still shows its text', () => {
    const state = newCopilotState('/vault')
    const events: AgentEventBody[] = []
    mapCopilotLine(state, { type: 'assistant.message', data: { messageId: 'm1', content: 'Done.' } }, (e) => events.push(e))
    expect(events).toEqual([{ type: 'text', text: 'Done.' }])
  })
})

describe('Copilot command', () => {
  const input = { prompt: 'Make it shorter', instructions: 'RULES', vault: 'work', model: 'gpt-x' }
  test('the first turn carries the instructions, later turns only the message', () => {
    const first = copilotCommand('copilot', input, 'sid', true)
    expect(first[2]).toBe('RULES\n\n---\n\nMake it shorter')
    expect(copilotCommand('copilot', input, 'sid', false)[2]).toBe('Make it shorter')
  })
  test('writes and the Slidecraft tools are allowed, nothing else', () => {
    const cmd = copilotCommand('copilot', input, 'sid', false)
    const allowed = cmd.flatMap((a, i) => (a === '--allow-tool' ? [cmd[i + 1]] : []))
    expect(allowed).toEqual(['write', 'slidecraft'])
    expect(cmd).not.toContain('--trust-folder') // Copilot refuses it together with --session-id
    expect(cmd).not.toContain('--allow-all-tools')
    expect(cmd.slice(cmd.indexOf('--session-id'), cmd.indexOf('--session-id') + 2)).toEqual(['--session-id', 'sid'])
    expect(cmd.slice(-2)).toEqual(['--model', 'gpt-x'])
    expect(JSON.parse(copilotMcpConfig('work')).mcpServers.slidecraft).toMatchObject({ type: 'local', args: expect.arrayContaining(['--vault', 'work']), tools: ['*'] })
  })
  test('tool summaries', () => {
    expect(summarizeCopilotTool('apply_patch', '*** Begin Patch\n*** Update File: /vault/a/index.mdx\n*** End Patch', '/vault')).toBe('Edit a/index.mdx')
    expect(summarizeCopilotTool('glob', { pattern: '**/*.mdx' }, '/vault')).toBe('Find files: **/*.mdx')
  })
})
