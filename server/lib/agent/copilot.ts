/**
 * GitHub Copilot CLI as an agent backend (UX overhaul U6): `copilot -p` with JSON-lines output,
 * streamed. Copilot's prompt mode cannot ask anyone, so it is allowed to write files inside the
 * vault and to use the Slidecraft MCP server; anything else (a shell command, a file outside the
 * vault) is refused by Copilot itself, and the conversation says so.
 *
 * Copilot has no system-prompt flag: the standing instructions go in front of the first message
 * of a session. Sessions are resumed with `--session-id`.
 */
import { isAbsolute, relative, sep } from 'node:path'
import type { AgentBackendInfo, AgentEventBody } from '../../../shared/agent.ts'
import type { AgentBackend, TurnInput, TurnResult } from './backend.ts'
import { slidecraftMcpServer } from './claudeCode.ts'

export const copilotBinary = (): string | null => process.env.SLIDECRAFT_COPILOT_BIN || Bun.which('copilot')

const clip = (text: string, max = 120) => (text.length > max ? `${text.slice(0, max - 1)}…` : text)

/** Copilot's MCP config: the same server as Claude Code gets, in Copilot's shape. */
export function copilotMcpConfig(vault: string, appOrigin?: string): string {
  const server = slidecraftMcpServer(vault, appOrigin) as { command: string; args?: string[]; env?: Record<string, string> }
  return JSON.stringify({ mcpServers: { slidecraft: { type: 'local', command: server.command, args: server.args ?? [], env: server.env ?? {}, tools: ['*'] } } })
}

export function copilotCommand(binary: string, input: Pick<TurnInput, 'prompt' | 'instructions' | 'vault' | 'model' | 'appOrigin'>, sessionId: string, firstTurn: boolean): string[] {
  const prompt = firstTurn ? `${input.instructions}\n\n---\n\n${input.prompt}` : input.prompt
  return [
    binary,
    '-p',
    prompt,
    '--output-format',
    'json',
    '--stream',
    'on',
    '--session-id',
    sessionId,
    '--no-auto-update',
    '--no-color',
    '--allow-tool',
    'write',
    '--allow-tool',
    'slidecraft',
    '--additional-mcp-config',
    copilotMcpConfig(input.vault, input.appOrigin),
    ...(input.model ? ['--model', input.model] : []),
  ]
}

const pathIn = (cwd: string, path: string) => (isAbsolute(path) && !relative(cwd, path).startsWith('..') ? relative(cwd, path).split(sep).join('/') : path)

/** "Edit q3/index.mdx", "Run: ls", "Read q3/index.mdx". */
export function summarizeCopilotTool(name: string, args: unknown, cwd: string): string {
  const a = (args && typeof args === 'object' ? args : {}) as Record<string, unknown>
  const str = (key: string) => (typeof a[key] === 'string' ? (a[key] as string) : undefined)
  if (name === 'view') return `Read ${pathIn(cwd, str('path') ?? '')}`
  if (name === 'bash') return `Run: ${clip(str('command') ?? '')}`
  if (name === 'rg' || name === 'grep') return `Search: ${str('pattern') ?? ''}`
  if (name === 'glob') return `Find files: ${str('pattern') ?? ''}`
  if (name === 'apply_patch' && typeof args === 'string') {
    const files = [...args.matchAll(/\*\*\* (?:Update|Add|Delete) File: (.+)/g)].map((m) => pathIn(cwd, m[1].trim()))
    return `Edit ${files.join(', ') || 'files'}`
  }
  if (name === 'create' || name === 'edit' || name === 'str_replace' || name === 'write') return `${name === 'create' ? 'Create' : 'Edit'} ${pathIn(cwd, str('path') ?? str('file_path') ?? '')}`
  if (name.startsWith('slidecraft')) return name.replace(/^slidecraft[-_]+/, '').replace(/_/g, ' ') + (str('name') ? `: ${str('name')}` : '')
  return name
}

export interface CopilotMapState {
  cwd: string
  /** Messages whose text already arrived as deltas. */
  streamed: Set<string>
  result?: TurnResult
}

export const newCopilotState = (cwd: string): CopilotMapState => ({ cwd, streamed: new Set() })

type Line = { type?: string; data?: Record<string, unknown>; sessionId?: string; exitCode?: number }

/** One JSON line from Copilot → normalised events. Pure apart from `state`, tested on a recorded run. */
export function mapCopilotLine(state: CopilotMapState, line: Line, emit: (event: AgentEventBody) => void): void {
  const data = line.data ?? {}
  switch (line.type) {
    case 'assistant.message_delta': {
      const text = typeof data.deltaContent === 'string' ? data.deltaContent : ''
      if (!text) return
      state.streamed.add(String(data.messageId))
      emit({ type: 'text', text })
      return
    }
    case 'assistant.message': {
      const content = typeof data.content === 'string' ? data.content : ''
      if (content.trim() && !state.streamed.has(String(data.messageId))) emit({ type: 'text', text: content })
      return
    }
    case 'tool.execution_start':
      emit({ type: 'tool-call', call: { id: String(data.toolCallId), name: String(data.toolName), summary: summarizeCopilotTool(String(data.toolName), data.arguments, state.cwd) } })
      return
    case 'tool.execution_complete': {
      const ok = data.success === true
      const error = (data.error as { message?: string } | undefined)?.message
      const denied = !ok && /permission denied/i.test(error ?? '')
      emit({
        type: 'tool-result',
        id: String(data.toolCallId),
        ok,
        summary: ok ? undefined : denied ? 'Refused: Copilot cannot ask for permission inside Slidecraft, so only edits in the vault are allowed.' : clip(error ?? 'Failed', 300),
      })
      if (ok) for (const edit of (data.fileEdits as { path?: string }[] | undefined) ?? []) if (edit.path) emit({ type: 'file-changed', path: pathIn(state.cwd, edit.path) })
      return
    }
    case 'result': {
      const ok = line.exitCode === 0
      state.result = { ok, sessionId: line.sessionId, error: ok ? undefined : `Copilot exited with code ${line.exitCode}` }
      return
    }
    default:
  }
}

async function output(args: string[]): Promise<string | undefined> {
  try {
    const proc = Bun.spawn(args, { stdout: 'pipe', stderr: 'ignore' })
    const timer = setTimeout(() => proc.kill(), 8000)
    const text = await new Response(proc.stdout).text()
    clearTimeout(timer)
    return text
  } catch {
    return undefined
  }
}

export const copilotBackend: AgentBackend = {
  id: 'copilot',
  name: 'GitHub Copilot CLI',

  async detect(): Promise<AgentBackendInfo> {
    const base = { id: 'copilot' as const, name: 'GitHub Copilot CLI', approvals: false }
    const binary = copilotBinary()
    if (!binary) return { ...base, available: false, detail: 'Install the GitHub Copilot CLI and sign in: run `copilot` once in a terminal.' }
    const version = /(\d+\.\d+\.\d+)/.exec((await output([binary, '--version'])) ?? '')?.[1]
    if (!version) return { ...base, available: false, detail: `${binary} did not answer --version.` }
    return { ...base, available: true, version, detail: 'Copilot cannot ask for permission here: it edits files in the vault, and anything else it tries is refused.' }
  },

  async runTurn(input: TurnInput): Promise<TurnResult> {
    const binary = copilotBinary()
    if (!binary) return { ok: false, error: 'The GitHub Copilot CLI is not installed (no `copilot` on the PATH).' }
    const sessionId = input.sessionId ?? crypto.randomUUID()
    const state = newCopilotState(input.cwd)
    const proc = Bun.spawn(copilotCommand(binary, input, sessionId, !input.sessionId), { cwd: input.cwd, stdout: 'pipe', stderr: 'pipe', stdin: 'ignore' })
    const onAbort = () => proc.kill()
    input.signal.addEventListener('abort', onAbort)
    const stderr = new Response(proc.stderr).text()
    try {
      const decoder = new TextDecoder()
      let buffer = ''
      for await (const chunk of proc.stdout) {
        buffer += decoder.decode(chunk, { stream: true })
        let newline: number
        while ((newline = buffer.indexOf('\n')) >= 0) {
          const text = buffer.slice(0, newline).trim()
          buffer = buffer.slice(newline + 1)
          if (!text) continue
          try {
            mapCopilotLine(state, JSON.parse(text) as Line, input.emit)
          } catch {
            /* not a JSON line */
          }
        }
      }
      const code = await proc.exited
      if (input.signal.aborted) return { ok: false, sessionId, error: 'Stopped' }
      if (state.result) return { ...state.result, sessionId: state.result.sessionId ?? sessionId }
      const message = (await stderr).trim().split('\n').slice(-3).join(' ')
      return { ok: false, sessionId, error: `Copilot exited with code ${code}${message ? `: ${clip(message, 300)}` : ''}` }
    } finally {
      input.signal.removeEventListener('abort', onAbort)
    }
  },
}
