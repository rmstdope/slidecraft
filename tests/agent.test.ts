import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { SDKMessage } from '@anthropic-ai/claude-agent-sdk'
import type { AgentEventBody } from '../shared/agent.ts'
import type { AgentBackend, TurnInput } from '../server/lib/agent/backend.ts'
import { ALLOWED_TOOLS, mapClaudeMessage, newMapState, summarizeTool } from '../server/lib/agent/claudeCode.ts'
import { clearThreadCache, createThread, getThread, listThreads, resolveApproval, sendMessage, setBackend, settled, stopTurn } from '../server/lib/agent/threads.ts'
import { initContentSources } from '../server/lib/contentSources.ts'
import { router } from '../server/index.ts'

const root = mkdtempSync(join(tmpdir(), 'slidecraft-agent-'))
const work = join(root, 'work')
const team = join(root, 'team')
afterAll(() => rmSync(root, { recursive: true, force: true }))
beforeAll(() => {
  for (const dir of [join(work, 'q4-plan'), join(team, 'shared')]) {
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'index.mdx'), '<Presentation>\n\n<Slide>\n  <Title>Q4 plan</Title>\n</Slide>\n\n<Slide>\n  <Title>Bets</Title>\n</Slide>\n\n</Presentation>\n')
  }
  initContentSources({ vaults: [{ id: 'work', name: 'Work', path: work }, { id: 'team', name: 'Team', path: team, readOnly: true }] }, undefined, join(root, 'examples'), join(root, 'config.json'))
})

describe('Claude Code stream mapping (recorded run)', () => {
  const messages = readFileSync(join(import.meta.dir, 'fixtures/agent/claude-edit-and-shell.jsonl'), 'utf8')
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line) as SDKMessage)

  test('a real turn becomes text, tool calls, results, a changed file and the result', () => {
    const state = newMapState('/vault')
    const events: AgentEventBody[] = []
    for (const message of messages) mapClaudeMessage(state, message, (e) => events.push(e))
    const calls = events.filter((e) => e.type === 'tool-call').map((e) => (e.type === 'tool-call' ? e.call.summary : ''))
    expect(calls).toEqual(['Read q4-plan/index.mdx', 'Edit q4-plan/index.mdx', "Run: python3 -c 'print(6*7)'"])
    expect(events.filter((e) => e.type === 'tool-result').every((e) => e.type === 'tool-result' && e.ok)).toBe(true)
    expect(events.filter((e) => e.type === 'file-changed')).toEqual([{ type: 'file-changed', path: 'q4-plan/index.mdx' }])
    const text = events.flatMap((e) => (e.type === 'text' ? [e.text] : [])).join('')
    expect(text.length).toBeGreaterThan(10)
    // The file change comes after the edit's result, never before.
    expect(events.findIndex((e) => e.type === 'file-changed')).toBeGreaterThan(events.findIndex((e) => e.type === 'tool-result' && e.id === (events[2] as { call?: { id: string } }).call?.id))
    expect(state.result).toMatchObject({ ok: true, sessionId: 'c2e8518d-be70-40d6-8630-e495fb91554a' })
    expect(state.result?.costUsd).toBeGreaterThan(0)
  })

  test('text is not repeated when the final assistant message arrives after the deltas', () => {
    const state = newMapState('/vault')
    const texts: string[] = []
    for (const message of messages) mapClaudeMessage(state, message, (e) => e.type === 'text' && texts.push(e.text))
    const joined = texts.join('')
    const finalText = (messages.filter((m) => m.type === 'assistant').flatMap((m) => (m.type === 'assistant' ? (m.message.content as { type: string; text?: string }[]) : [])).filter((b) => b.type === 'text').map((b) => b.text).join(''))
    expect(joined).toBe(finalText)
  })

  test('tool summaries', () => {
    expect(summarizeTool('Edit', { file_path: '/vault/a/index.mdx' }, '/vault')).toBe('Edit a/index.mdx')
    expect(summarizeTool('Write', { file_path: '/elsewhere/x.txt' }, '/vault')).toBe('Write /elsewhere/x.txt')
    expect(summarizeTool('Bash', { command: 'x'.repeat(300) }, '/vault')).toHaveLength(125)
    expect(summarizeTool('mcp__slidecraft__read_presentation', { name: 'q4-plan' }, '/vault')).toBe('read presentation: q4-plan')
  })

  test('file tools are never approved by name: outside the vault they must ask', () => {
    for (const tool of ['Read', 'Edit', 'Write', 'MultiEdit', 'Bash', 'Glob', 'Grep']) expect(ALLOWED_TOOLS).not.toContain(tool)
  })
})

/** A scripted backend: each turn runs the function the test sets. */
let script: (input: TurnInput) => Promise<{ ok: boolean; sessionId?: string; error?: string }> = async () => ({ ok: true })
const seen: TurnInput[] = []
const fake: AgentBackend = {
  id: 'claude-code',
  name: 'Fake',
  detect: async () => ({ id: 'claude-code', name: 'Fake', available: true, version: 'test' }),
  runTurn: async (input) => {
    seen.push(input)
    return script(input)
  },
}
setBackend(fake)

const waitFor = async (check: () => boolean) => {
  for (let i = 0; i < 400 && !check(); i++) await Bun.sleep(5)
  expect(check()).toBe(true)
}

describe('threads', () => {
  test('a turn streams, asks for approval, is stored merged and resumes its session', async () => {
    const thread = createThread('work', { deck: { source: 'work', path: 'q4-plan' } })
    expect(thread).toMatchObject({ vault: 'work', deck: { source: 'work', path: 'q4-plan' }, backend: 'claude-code', running: false })
    expect(existsSync(join(work, '.slidecraft', 'conversations', `${thread.id}.json`))).toBe(true)

    let allowed: boolean | undefined
    script = async (input) => {
      input.emit({ type: 'text', text: 'Changing ' })
      input.emit({ type: 'text', text: 'the title.' })
      input.emit({ type: 'tool-call', call: { id: 't1', name: 'Bash', summary: 'Run: make' } })
      allowed = await input.requestApproval({ tool: 'Bash', summary: 'Run: make' })
      input.emit({ type: 'tool-result', id: 't1', ok: allowed })
      return { ok: true, sessionId: 'session-1' }
    }
    const started = await sendMessage('work', thread.id, 'Shorter title please', { slide: 1, selection: '<Title>Bets</Title>' })
    expect(started.running).toBe(true)
    expect(started.title).toBe('Shorter title please')

    await waitFor(() => getThread('work', thread.id).events.some((e) => e.type === 'approval-request'))
    const request = getThread('work', thread.id).events.find((e) => e.type === 'approval-request')!
    expect(resolveApproval('work', thread.id, request.type === 'approval-request' ? request.id : '', true)).toBe(true)
    await settled('work', thread.id)
    expect(allowed).toBe(true)

    const prompt = seen[seen.length - 1].prompt
    expect(prompt).toContain('File path: q4-plan/index.mdx')
    expect(prompt).toContain('1: "Bets" [dark/yellow]  <-- viewing')
    expect(prompt).toContain('<Title>Bets</Title>')
    expect(prompt.endsWith('Shorter title please')).toBe(true)
    expect(seen[seen.length - 1].cwd).toBe(work)

    const detail = getThread('work', thread.id)
    expect(detail.running).toBe(false)
    expect(detail.events.map((e) => e.type)).toEqual(['user-message', 'text', 'tool-call', 'approval-request', 'approval-resolved', 'tool-result', 'turn-done'])
    expect(detail.events[1]).toMatchObject({ type: 'text', text: 'Changing the title.' })
    expect(detail.events.every((e) => e.turn === 1)).toBe(true)

    // After a restart the thread comes back from disk and the next turn resumes the session.
    clearThreadCache()
    expect(getThread('work', thread.id).events).toHaveLength(7)
    script = async () => ({ ok: true })
    await sendMessage('work', thread.id, 'And the next slide')
    await settled('work', thread.id)
    expect(seen[seen.length - 1].sessionId).toBe('session-1')
    expect(getThread('work', thread.id).events.at(-1)).toMatchObject({ type: 'turn-done', ok: true, turn: 2 })
  })

  test('stop ends the turn and denies what is still waiting', async () => {
    const thread = createThread('work')
    let answer: boolean | undefined
    script = async (input) => {
      answer = await input.requestApproval({ tool: 'Bash', summary: 'Run: rm -rf build' })
      if (!input.signal.aborted) await new Promise((resolve) => input.signal.addEventListener('abort', resolve))
      return { ok: false, error: 'Stopped' }
    }
    await sendMessage('work', thread.id, 'Clean up')
    await waitFor(() => getThread('work', thread.id).events.some((e) => e.type === 'approval-request'))
    expect((await sendMessage('work', thread.id, 'again').catch((e: { status: number }) => e.status)) as unknown).toBe(409)
    expect(stopTurn('work', thread.id)).toBe(true)
    await settled('work', thread.id)
    expect(answer).toBe(false)
    expect(getThread('work', thread.id).events.at(-1)).toMatchObject({ type: 'turn-done', ok: false, stopped: true })
  })

  test('a failing backend ends the turn with its error', async () => {
    const thread = createThread('work')
    script = async () => {
      throw new Error('claude exited with code 1')
    }
    await sendMessage('work', thread.id, 'Hello')
    await settled('work', thread.id)
    expect(getThread('work', thread.id).events.at(-1)).toMatchObject({ type: 'turn-done', ok: false, error: 'claude exited with code 1' })
  })

  test('threads are listed per vault and per deck; read-only vaults refuse', () => {
    expect(listThreads('work').length).toBeGreaterThanOrEqual(3)
    expect(listThreads('work', { source: 'work', path: 'q4-plan' })).toHaveLength(1)
    expect(() => createThread('team')).toThrow('read-only')
    expect(() => createThread('work', { deck: { source: 'work', path: '../escape' } })).toThrow('Invalid')
    expect(() => getThread('work', 'not-a-thread-id')).toThrow('No such conversation')
  })
})

describe('agent routes', () => {
  const call = (path: string, init?: RequestInit) => router(new Request(`http://localhost:6110${path}`, init))
  test('create, send, read, and errors as JSON', async () => {
    script = async (input) => {
      input.emit({ type: 'text', text: 'Done.' })
      return { ok: true }
    }
    const backends = (await (await call('/api/agent/backends')).json()) as unknown
    expect(backends).toEqual([{ id: 'claude-code', name: 'Fake', available: true, version: 'test' }])
    const created = await call('/api/agent/threads', { method: 'POST', body: JSON.stringify({ vault: 'work', path: 'q4-plan' }) })
    expect(created.status).toBe(201)
    const { id } = (await created.json()) as { id: string }
    expect((await call(`/api/agent/threads/work/${id}/messages`, { method: 'POST', body: JSON.stringify({ text: 'Hi', context: { slide: 0 } }) })).status).toBe(202)
    await settled('work', id)
    const detail = (await (await call(`/api/agent/threads/work/${id}`)).json()) as { events: { type: string }[] }
    expect(detail.events.map((e) => e.type)).toEqual(['user-message', 'text', 'turn-done'])
    const listed = (await (await call('/api/agent/threads?vault=work&path=q4-plan')).json()) as unknown[]
    expect(listed.length).toBe(2)
    expect((await call('/api/agent/threads', { method: 'POST', body: JSON.stringify({ vault: 'team' }) })).status).toBe(403)
    expect((await call(`/api/agent/threads/work/${id}/approvals/nope`, { method: 'POST', body: JSON.stringify({ allow: true }) })).status).toBe(404)
    expect((await call('/api/agent/threads?vault=nope')).status).toBe(404)
  })
})
