import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { claudeCommand, copilotCommand, deckFromFiles, parseCopilotOutput, resetCliSessions, runClaudeCode, runCopilot, type RunProcess } from '../server/lib/chat/cliProviders.ts'
import { openAiCaller, runHttpChat, type ApiMessage, type CallModel } from '../server/lib/chat/httpProvider.ts'
import { buildAgentContext, buildSystemPrompt } from '../server/lib/chat/prompt.ts'
import { GENERATED_PREFIX } from '../server/lib/agentContext.ts'
import { initContentSources } from '../server/lib/contentSources.ts'
import { router } from '../server/index.ts'

const root = mkdtempSync(join(tmpdir(), 'slidecraft-chat-'))
const content = join(root, 'content')
const team = join(root, 'team')
const DECK = `import { Presentation, Slide, Title, Text } from '@components'

<Presentation>

<Slide>
  <Title>Opening</Title>
</Slide>

<Slide accent="teal">
  <Title>Middle</Title>
  <Text>Body</Text>
</Slide>

<Slide>
  <Title>End</Title>
</Slide>

</Presentation>
`

beforeAll(() => {
  mkdirSync(join(content, 'talk'), { recursive: true })
  writeFileSync(join(content, 'talk', 'index.mdx'), DECK)
  mkdirSync(join(team, 'shared'), { recursive: true })
  writeFileSync(join(team, 'shared', 'index.mdx'), DECK)
  initContentSources({ contents: { team: { path: team, readOnly: true } } }, content, join(root, 'fallback'))
})
afterAll(() => rmSync(root, { recursive: true, force: true }))
beforeEach(() => resetCliSessions())

/** A model that plays back a script of replies, recording what it was sent. */
function scripted(replies: ApiMessage[]): { call: CallModel; seen: ApiMessage[][] } {
  const seen: ApiMessage[][] = []
  let i = 0
  return {
    seen,
    call: async (messages) => {
      seen.push([...messages])
      return { message: replies[Math.min(i++, replies.length - 1)] }
    },
  }
}
const toolCall = (id: string, name: string, args: unknown): ApiMessage => ({ role: 'assistant', content: null, tool_calls: [{ id, type: 'function', function: { name, arguments: JSON.stringify(args) } }] })

describe('HTTP provider tool loop', () => {
  test('creates a deck through the tools and reports progress', async () => {
    const model = scripted([
      toolCall('c1', 'create_presentation', { name: 'fresh-deck', slides: ['<Slide>\n  <Title>Hello</Title>\n</Slide>'] }),
      { role: 'assistant', content: 'Created fresh-deck with one slide.' },
    ])
    const iterations: number[] = []
    const calls: string[] = []
    const res = await runHttpChat({ systemPrompt: 'sys', history: [{ role: 'user', content: 'Make a deck' }], callModel: model.call, onIteration: (i) => iterations.push(i), onToolCall: (c) => calls.push(`${c.tool}:${c.result}`) })
    expect(res.message).toBe('Created fresh-deck with one slide.')
    expect(res.modifiedPresentation).toBe('fresh-deck')
    expect(res.modifiedDeck).toEqual({ source: 'default', path: 'fresh-deck' })
    expect(existsSync(join(content, 'fresh-deck', 'index.mdx'))).toBe(true)
    expect(iterations).toEqual([1, 2])
    expect(calls).toEqual(['create_presentation:success'])
    // The tool result went back to the model with the call id.
    expect(model.seen[1].at(-1)).toMatchObject({ role: 'tool', tool_call_id: 'c1' })
    expect(model.seen[0][0]).toEqual({ role: 'system', content: 'sys' })
  })

  test('a refused slide is reported with its content; a later fix on the same slide clears it', async () => {
    const bad = '<Slide>\n  <Title>Broken</Tittle>\n</Slide>'
    const model = scripted([toolCall('a', 'update_slide', { name: 'talk', index: 1, content: bad }), { role: 'assistant', content: 'I could not fix it.' }])
    const res = await runHttpChat({ systemPrompt: 's', history: [{ role: 'user', content: 'edit' }], deck: { source: 'default', path: 'talk' }, callModel: model.call })
    expect(res.validationErrors).toHaveLength(1)
    expect(res.validationErrors![0]).toMatchObject({ tool: 'update_slide', slideIndex: 1, failedContent: bad })
    expect(res.validationErrors![0].error).toContain('Validation failed')
    expect(readFileSync(join(content, 'talk', 'index.mdx'), 'utf8')).toBe(DECK) // nothing written

    const fixed = scripted([
      toolCall('a', 'update_slide', { name: 'talk', index: 1, content: bad }),
      toolCall('b', 'update_slide', { name: 'talk', index: 1, content: '<Slide accent="teal">\n  <Title>Middle, fixed</Title>\n</Slide>' }),
      { role: 'assistant', content: 'Fixed.' },
    ])
    const res2 = await runHttpChat({ systemPrompt: 's', history: [{ role: 'user', content: 'edit' }], deck: { source: 'default', path: 'talk' }, callModel: fixed.call })
    expect(res2.validationErrors).toBeUndefined()
    expect(res2.toolCalls?.map((c) => c.result)).toEqual(['error', 'success'])
    writeFileSync(join(content, 'talk', 'index.mdx'), DECK)
  })

  test('stops after the iteration cap', async () => {
    const model = scripted([toolCall('x', 'list_presentations', {})])
    const res = await runHttpChat({ systemPrompt: 's', history: [{ role: 'user', content: 'loop' }], callModel: model.call, maxIterations: 3 })
    expect(res.error).toBe('max_iterations')
    expect(res.toolCalls).toHaveLength(3)
  })

  test('the OpenAI-compatible request carries the model, tools and bearer key', async () => {
    let sent: { url: string; init: RequestInit } | null = null
    const fakeFetch = (async (url: string, init: RequestInit) => {
      sent = { url, init }
      return new Response(JSON.stringify({ choices: [{ message: { role: 'assistant', content: 'hi' }, finish_reason: 'stop' }] }))
    }) as unknown as typeof fetch
    const call = openAiCaller({ url: 'http://ai.test/v1/chat/completions', model: 'm1', apiKey: 'k' }, fakeFetch)
    expect((await call([{ role: 'user', content: 'x' }], [{ type: 'function' }])).message.content).toBe('hi')
    const body = JSON.parse(String(sent!.init.body))
    expect(body).toMatchObject({ model: 'm1', tool_choice: 'auto', tools: [{ type: 'function' }] })
    expect((sent!.init.headers as Record<string, string>).Authorization).toBe('Bearer k')
    await expect(openAiCaller({ url: 'x', model: 'm', apiKey: undefined })([], [])).rejects.toThrow('AI_API_KEY')
    const failing = (async () => new Response('quota', { status: 429 })) as unknown as typeof fetch
    await expect(openAiCaller({ url: 'x', model: 'm', apiKey: 'k' }, failing)([], [])).rejects.toThrow('AI API error 429: quota')
  })
})

describe('prompts', () => {
  test('the system prompt has the guide, components, guidelines and the slides near the view', async () => {
    const prompt = await buildSystemPrompt({ ref: { source: 'default', path: 'talk' }, source: DECK, currentSlideIndex: 1, contentDir: content }, content)
    expect(prompt).toContain('# AI Presentation Assistant')
    expect(prompt).toContain('# Presentation author guide')
    expect(prompt).toContain('## Available components')
    expect(prompt).toContain('Create and edit are different workflows')
    expect(prompt).toContain('1: "Middle" [dark/teal]  <-- viewing')
    expect(prompt).toContain('**Previous slide (index 0):**')
    expect(prompt).toContain('**Current slide (index 1) ← the user is viewing this:**')
    expect(prompt).toContain('**Next slide (index 2):**')
  })

  test('folder instructions are included when written by a person, never when generated', async () => {
    writeFileSync(join(content, 'AGENTS.md'), 'Write in British English.')
    expect(await buildAgentContext(null, content)).toContain('Write in British English.')
    writeFileSync(join(content, 'AGENTS.md'), `${GENERATED_PREFIX} dev -->\nGenerated text`)
    expect(await buildAgentContext(null, content)).not.toContain('Generated text')
    rmSync(join(content, 'AGENTS.md'))
  })

  test('the CLI context names the file to edit and marks the current slide', async () => {
    const context = await buildAgentContext({ ref: { source: 'default', path: 'talk' }, source: DECK, currentSlideIndex: 2, contentDir: content }, content)
    expect(context).toContain('File path: talk/index.mdx')
    expect(context).toContain('2: "End" [dark/yellow]  <-- viewing')
    expect(context).toContain('### Current slide (index 2)')
    expect(context).toContain('Edit the MDX file directly')
  })
})

const proc = (stdout: string, exitCode = 0, stderr = ''): Awaited<ReturnType<RunProcess>> => ({ stdout, stderr, exitCode, timedOut: false })

describe('Claude Code provider', () => {
  test('passes the context as a system prompt and resumes the session it returned', async () => {
    const cmds: string[][] = []
    const run: RunProcess = async (cmd, opts) => {
      cmds.push(cmd)
      expect(opts.cwd).toBe(content)
      return proc(JSON.stringify({ type: 'result', result: 'Edited slide 2.', session_id: 'sess-1', is_error: false }))
    }
    const input = { message: 'Fix slide 2', conversationId: 'conv', cwd: content, contextPrompt: 'CTX', deck: { source: 'default', path: 'talk' }, run }
    const first = await runClaudeCode(input)
    expect(first).toMatchObject({ message: 'Edited slide 2.', modifiedPresentation: 'talk' })
    await runClaudeCode(input)
    expect(cmds[0]).toEqual(claudeCommand(input))
    expect(cmds[0]).toContain('--append-system-prompt')
    expect(cmds[0]).not.toContain('--resume')
    expect(cmds[1].slice(-2)).toEqual(['--resume', 'sess-1'])
  })

  test('errors, plain text and missing executables', async () => {
    const base = { message: 'x', conversationId: 'c2', cwd: content, contextPrompt: '' }
    expect(await runClaudeCode({ ...base, run: async () => proc('', 2, 'boom') })).toMatchObject({ error: 'claude-code_error', message: 'Claude Code error (exit 2): boom' })
    expect(await runClaudeCode({ ...base, run: async () => proc(JSON.stringify({ result: 'nope', is_error: true })) })).toMatchObject({ error: 'claude-code_error', message: 'nope' })
    expect((await runClaudeCode({ ...base, run: async () => proc('just text') })).message).toBe('just text')
    expect(await runClaudeCode({ ...base, run: async () => { throw new Error('ENOENT') } })).toMatchObject({ error: 'claude-code_spawn_error' })
  })
})

describe('Copilot CLI provider', () => {
  const jsonl = (...events: unknown[]) => events.map((e) => JSON.stringify(e)).join('\n')
  const result = (filesModified: string[] = [], exitCode = 0) => ({ type: 'result', exitCode, usage: { codeChanges: { filesModified } } })

  test('the first message carries the context, later ones are bare; flags follow the config', async () => {
    const prompts: string[] = []
    const run: RunProcess = async (cmd) => {
      prompts.push(cmd[cmd.indexOf('-p') + 1])
      return proc(jsonl({ type: 'assistant.message', data: { content: 'Done it.' } }, result()))
    }
    const input = { message: 'Add a slide', conversationId: 'conv-c', cwd: content, contextPrompt: 'CTX', run }
    expect((await runCopilot(input)).message).toBe('Done it.')
    await runCopilot({ ...input, message: 'And another' })
    expect(prompts[0]).toBe('CTX\n\n## Request\n\nAdd a slide')
    expect(prompts[1]).toBe('And another')
    const cmd = copilotCommand('p', 'id-1', { model: 'gpt-x', effort: 'high' }, 'copilot')
    expect(cmd).toEqual(['copilot', '-p', 'p', '--allow-all-tools', '--output-format', 'json', '--session-id', 'id-1', '--no-auto-update', '--no-color', '--model', 'gpt-x', '--reasoning-effort', 'high'])
  })

  test('the reply joins assistant messages; a created deck is found from the modified files', async () => {
    const out = jsonl({ type: 'session.tools_updated' }, { type: 'assistant.message', data: { content: 'One.' } }, 'not json', { type: 'assistant.message', data: { content: 'Two.' } }, result([join(content, 'new-one', 'index.mdx')]))
    expect(parseCopilotOutput(out)).toEqual({ text: 'One.\n\nTwo.', exitCode: 0, filesModified: [join(content, 'new-one', 'index.mdx')] })
    const res = await runCopilot({ message: 'Create', conversationId: 'conv-d', cwd: content, contextPrompt: '', sourceId: 'default', run: async () => proc(out) })
    expect(res.modifiedDeck).toEqual({ source: 'default', path: 'new-one' })
    expect(deckFromFiles(['/elsewhere/x/index.mdx'], content, 'default')).toBeUndefined()
  })

  test('retries once when the session is still being disposed; reports failures', async () => {
    let attempts = 0
    const run: RunProcess = async () => (++attempts === 1 ? proc('', 1, 'Error: session disposal in progress') : proc(jsonl({ type: 'assistant.message', data: { content: 'ok' } }, result())))
    expect((await runCopilot({ message: 'x', conversationId: 'conv-e', cwd: content, contextPrompt: '', run })).message).toBe('ok')
    expect(attempts).toBe(2)
    const failed = await runCopilot({ message: 'x', conversationId: 'conv-f', cwd: content, contextPrompt: '', run: async () => proc(jsonl(result([], 1))) })
    expect(failed.error).toBe('copilot_error')
  })
})

describe('POST /api/chat', () => {
  const post = (body: unknown) => router(new Request('http://localhost/api/chat', { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } }))

  test('validates the request', async () => {
    expect((await post({})).status).toBe(400)
    expect((await post({ messages: [{ role: 'assistant', content: 'hi' }] })).status).toBe(400)
    expect((await post({ messages: [{ role: 'user', content: 'hi' }], provider: 'copilot' })).status).toBe(400) // no conversationId
    expect((await post({ messages: [{ role: 'user', content: 'hi' }], deck: { source: 'nope', path: 'x' } })).status).toBe(400)
    expect((await post({ messages: [{ role: 'user', content: 'hi' }], deck: { source: 'team', path: 'shared' } })).status).toBe(403)
  })
})
