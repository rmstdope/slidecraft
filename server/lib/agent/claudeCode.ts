/**
 * Claude Code as an agent backend (UX overhaul U2), through the Claude Agent SDK driving the
 * user's installed `claude` (so it uses their login). Edits inside the vault are allowed; any other
 * tool that would prompt (shell commands, edits outside the vault, web access) is sent to the
 * person as an approval request.
 */
import { join, relative, isAbsolute } from 'node:path'
import { query, type CanUseTool, type McpServerConfig, type SDKMessage } from '@anthropic-ai/claude-agent-sdk'
import type { AgentBackendInfo, AgentEventBody } from '../../../shared/agent.ts'
import { APP_ROOT, IS_BUNDLED } from '../paths.ts'
import type { AgentBackend, TurnInput, TurnResult } from './backend.ts'

/** The CLI to run: SLIDECRAFT_CLAUDE_BIN, else `claude` on the PATH. */
export const claudeBinary = (): string | null => process.env.SLIDECRAFT_CLAUDE_BIN || Bun.which('claude')

/**
 * Tools approved up front. File tools are deliberately not listed: a bare name would approve them
 * everywhere. `acceptEdits` approves reads and edits inside the vault; outside it, Claude Code asks,
 * and the question reaches `canUseTool` (the person).
 */
export const ALLOWED_TOOLS = ['TodoWrite', 'mcp__slidecraft']

const EDIT_TOOLS = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit'])

/** The Slidecraft MCP server for one vault: this checkout's script, or the release binary itself. */
export function slidecraftMcpServer(vault: string): McpServerConfig {
  return IS_BUNDLED
    ? { type: 'stdio', command: process.execPath, args: ['--mcp', '--vault', vault] }
    : { type: 'stdio', command: process.execPath, args: [join(APP_ROOT, 'server', 'mcp.ts'), '--vault', vault] }
}

const clip = (text: string, max = 120) => (text.length > max ? `${text.slice(0, max - 1)}…` : text)

/** "Edit q3-review/index.mdx", "Run: ls -la", "Search: Stat". */
export function summarizeTool(name: string, input: Record<string, unknown>, cwd: string): string {
  const str = (key: string) => (typeof input[key] === 'string' ? (input[key] as string) : undefined)
  const file = str('file_path') ?? str('notebook_path') ?? str('path')
  const shown = file ? (isAbsolute(file) && !relative(cwd, file).startsWith('..') ? relative(cwd, file) : file) : undefined
  if (name === 'Bash') return `Run: ${clip(str('command') ?? '')}`
  if (name === 'Glob') return `Find files: ${str('pattern') ?? ''}`
  if (name === 'Grep') return `Search: ${str('pattern') ?? ''}`
  if (name === 'WebFetch') return `Fetch: ${str('url') ?? ''}`
  if (name === 'WebSearch') return `Search the web: ${str('query') ?? ''}`
  if (name === 'TodoWrite') return 'Update the task list'
  if (name.startsWith('mcp__slidecraft__')) {
    const tool = name.slice('mcp__slidecraft__'.length).replace(/_/g, ' ')
    return str('name') ? `${tool}: ${str('name')}` : tool
  }
  if (name.startsWith('mcp__')) return name.split('__').slice(1).join(': ')
  return shown ? `${name} ${shown}` : name
}

/** Mapping state across the messages of one turn. */
export interface MapState {
  cwd: string
  sessionId?: string
  /** Text arrives as partial deltas; the final assistant message repeats it and is skipped. */
  streamedText: boolean
  /** Edit tool calls waiting for their result, by tool_use id → file. */
  pendingEdits: Map<string, string>
  result?: TurnResult
}

export const newMapState = (cwd: string): MapState => ({ cwd, streamedText: false, pendingEdits: new Map() })

type Block = { type: string; [key: string]: unknown }

/** One SDK message → normalised events. Pure apart from `state`, so recorded streams can test it. */
export function mapClaudeMessage(state: MapState, message: SDKMessage, emit: (event: AgentEventBody) => void): void {
  if ('session_id' in message && typeof message.session_id === 'string' && message.session_id) state.sessionId = message.session_id
  switch (message.type) {
    case 'stream_event': {
      if (message.parent_tool_use_id) return // a subagent's own output
      const event = message.event as { type: string; delta?: { type: string; text?: string } }
      if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta' && event.delta.text) {
        state.streamedText = true
        emit({ type: 'text', text: event.delta.text })
      }
      return
    }
    case 'assistant': {
      if (message.parent_tool_use_id) return
      for (const block of message.message.content as unknown as Block[]) {
        if (block.type === 'text' && !state.streamedText && typeof block.text === 'string') emit({ type: 'text', text: block.text })
        if (block.type === 'tool_use') {
          const id = String(block.id)
          const name = String(block.name)
          const input = (block.input ?? {}) as Record<string, unknown>
          emit({ type: 'tool-call', call: { id, name, summary: summarizeTool(name, input, state.cwd) } })
          const file = input.file_path ?? input.notebook_path
          if (EDIT_TOOLS.has(name) && typeof file === 'string') state.pendingEdits.set(id, file)
        }
      }
      return
    }
    case 'user': {
      if (message.parent_tool_use_id) return
      const content = message.message.content
      if (!Array.isArray(content)) return
      for (const block of content as unknown as Block[]) {
        if (block.type !== 'tool_result') continue
        const id = String(block.tool_use_id)
        const ok = block.is_error !== true
        const text = typeof block.content === 'string' ? block.content : undefined
        emit({ type: 'tool-result', id, ok, summary: ok ? undefined : clip(text ?? 'Failed', 300) })
        const file = state.pendingEdits.get(id)
        state.pendingEdits.delete(id)
        if (ok && file) emit({ type: 'file-changed', path: isAbsolute(file) ? relative(state.cwd, file) : file })
      }
      return
    }
    case 'result': {
      const ok = message.subtype === 'success' && !message.is_error
      const error = ok ? undefined : message.subtype === 'success' ? message.result : (message as { errors?: string[] }).errors?.join('; ') || message.subtype
      state.result = { ok, sessionId: state.sessionId, error, costUsd: message.total_cost_usd }
      return
    }
    default:
  }
}

/** Run a short CLI command and return its stdout, or undefined when it fails or hangs. */
async function output(args: string[]): Promise<string | undefined> {
  try {
    const proc = Bun.spawn(args, { stdout: 'pipe', stderr: 'ignore' })
    const timer = setTimeout(() => proc.kill(), 8000)
    const text = await new Response(proc.stdout).text()
    clearTimeout(timer)
    return (await proc.exited) === 0 || text.trim() ? text : undefined
  } catch {
    return undefined
  }
}

/** Signed in? Only `loggedIn` is read from `claude auth status`; nothing about the account. */
export function parseAuthStatus(text: string | undefined): boolean | undefined {
  if (!text) return undefined
  try {
    const parsed = JSON.parse(text) as { loggedIn?: unknown }
    return typeof parsed.loggedIn === 'boolean' ? parsed.loggedIn : undefined
  } catch {
    return undefined
  }
}

export const claudeCodeBackend: AgentBackend = {
  id: 'claude-code',
  name: 'Claude Code',

  async detect(): Promise<AgentBackendInfo> {
    const base = { id: 'claude-code' as const, name: 'Claude Code' }
    const binary = claudeBinary()
    if (!binary) return { ...base, available: false, detail: 'Install Claude Code, then run `claude` once in a terminal to sign in.' }
    const [versionText, authText] = await Promise.all([output([binary, '--version']), output([binary, 'auth', 'status'])])
    const version = versionText?.trim().split(/\s+/)[0] || undefined
    if (!version) return { ...base, available: false, detail: `${binary} did not answer --version.` }
    const loggedIn = parseAuthStatus(authText)
    if (loggedIn === false) return { ...base, available: false, version, detail: 'Claude Code is installed but not signed in: run `claude auth login` in a terminal.' }
    return { ...base, available: true, version }
  },

  async runTurn(input: TurnInput): Promise<TurnResult> {
    const binary = claudeBinary()
    if (!binary) return { ok: false, error: 'Claude Code is not installed (no `claude` on the PATH).' }
    const state = newMapState(input.cwd)
    const abort = new AbortController()
    const onAbort = () => abort.abort()
    input.signal.addEventListener('abort', onAbort)

    // Anything not allowed up front asks the person.
    const canUseTool: CanUseTool = async (toolName, toolInput, options) => {
      const allowed = await input.requestApproval({
        tool: toolName,
        summary: summarizeTool(toolName, toolInput, input.cwd),
        detail: options.decisionReason ?? (options.blockedPath ? `Outside the vault: ${options.blockedPath}` : undefined),
      })
      return allowed ? { behavior: 'allow', updatedInput: toolInput } : { behavior: 'deny', message: 'The user did not allow this.' }
    }

    try {
      const run = query({
        prompt: input.prompt,
        options: {
          cwd: input.cwd,
          pathToClaudeCodeExecutable: binary,
          resume: input.sessionId,
          model: input.model,
          abortController: abort,
          includePartialMessages: true,
          permissionMode: 'acceptEdits',
          allowedTools: ALLOWED_TOOLS,
          canUseTool,
          mcpServers: { slidecraft: slidecraftMcpServer(input.vault) },
          systemPrompt: { type: 'preset', preset: 'claude_code', append: input.instructions },
          settingSources: ['user', 'project', 'local'],
        },
      })
      for await (const message of run) {
        mapClaudeMessage(state, message, input.emit)
        if (input.signal.aborted) break
      }
    } catch (error) {
      if (input.signal.aborted) return { ok: false, sessionId: state.sessionId, error: 'Stopped' }
      return { ok: false, sessionId: state.sessionId, error: (error as Error).message }
    } finally {
      input.signal.removeEventListener('abort', onAbort)
    }
    if (input.signal.aborted) return { ok: false, sessionId: state.sessionId, error: 'Stopped' }
    return state.result ?? { ok: false, sessionId: state.sessionId, error: 'Claude Code ended without a result' }
  },
}
