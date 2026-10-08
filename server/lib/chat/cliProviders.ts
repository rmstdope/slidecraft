/**
 * CLI agent providers (Part 5 §A.6.2–A.6.3): Claude Code and the GitHub Copilot CLI run in the
 * content folder and edit the deck files themselves; the file watcher then refreshes the preview.
 * Only the last user message is sent; each CLI keeps the conversation in its own session.
 */
import type { ChatResponse } from '../../../shared/chat.ts'
import { deckName, type DeckRef } from '../../../shared/decks.ts'
import { relative, sep } from 'node:path'
import { readConfig } from '../paths.ts'

export interface ProcessResult {
  stdout: string
  stderr: string
  exitCode: number
  timedOut: boolean
}

export type RunProcess = (cmd: string[], options: { cwd: string; timeoutMs: number }) => Promise<ProcessResult>

export const runProcess: RunProcess = async (cmd, { cwd, timeoutMs }) => {
  let proc: ReturnType<typeof Bun.spawn>
  try {
    proc = Bun.spawn(cmd, { cwd, stdout: 'pipe', stderr: 'pipe', stdin: 'ignore', env: process.env })
  } catch (error) {
    throw new SpawnError((error as Error).message)
  }
  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    proc.kill()
  }, timeoutMs)
  const [stdout, stderr, exitCode] = await Promise.all([new Response(proc.stdout as ReadableStream).text(), new Response(proc.stderr as ReadableStream).text(), proc.exited])
  clearTimeout(timer)
  return { stdout, stderr, exitCode, timedOut }
}

export class SpawnError extends Error {}

export interface CliChatInput {
  message: string
  conversationId: string
  cwd: string
  contextPrompt: string
  deck?: DeckRef
  /** Content source the CLI runs in; names a deck the CLI created from its modified files. */
  sourceId?: string
  run?: RunProcess
}

const modified = (deck?: DeckRef) => (deck ? { modifiedPresentation: deckName(deck), modifiedDeck: deck } : {})
const tail = (text: string) => text.trim().split('\n').slice(-12).join('\n')

// ---------------------------------------------------------------------------------------------
// Claude Code: resumes by the session id it returns.

const claudeSessions = new Map<string, string>()
export const CLAUDE_TIMEOUT_MS = 120_000

export function claudeCommand(input: CliChatInput, sessionId?: string, bin = process.env.SLIDECRAFT_CLAUDE_BIN ?? 'claude'): string[] {
  return [bin, '-p', input.message, '--output-format', 'json', '--dangerously-skip-permissions', '--append-system-prompt', input.contextPrompt, ...(sessionId ? ['--resume', sessionId] : [])]
}

export async function runClaudeCode(input: CliChatInput): Promise<ChatResponse> {
  const run = input.run ?? runProcess
  let result: ProcessResult
  try {
    result = await run(claudeCommand(input, claudeSessions.get(input.conversationId)), { cwd: input.cwd, timeoutMs: CLAUDE_TIMEOUT_MS })
  } catch (error) {
    return { message: `Could not start Claude Code: ${(error as Error).message}. Is the claude CLI installed and on PATH?`, error: 'claude-code_spawn_error' }
  }
  if (result.timedOut) return { message: `Claude Code did not finish within ${CLAUDE_TIMEOUT_MS / 1000} s.`, error: 'claude-code_error' }
  if (result.exitCode !== 0) return { message: `Claude Code error (exit ${result.exitCode}): ${tail(result.stderr || result.stdout)}`, error: 'claude-code_error' }
  let parsed: { result?: string; session_id?: string; is_error?: boolean } | null = null
  try {
    parsed = JSON.parse(result.stdout)
  } catch {
    return { message: result.stdout.trim() || 'Done', ...modified(input.deck) }
  }
  if (parsed?.session_id) claudeSessions.set(input.conversationId, parsed.session_id)
  if (parsed?.is_error) return { message: parsed.result || 'Claude Code reported an error.', error: 'claude-code_error' }
  return { message: parsed?.result || 'Done', ...modified(input.deck) }
}

// ---------------------------------------------------------------------------------------------
// GitHub Copilot CLI: the caller supplies the session id; there is no system-prompt flag, so the
// context goes in front of the first message of a conversation.

const copilotStarted = new Set<string>()
export const COPILOT_TIMEOUT_MS = 180_000
const SESSION_BUSY = /session.*(dispos|in use|locked)/i

export function copilotCommand(prompt: string, conversationId: string, config = readConfig().copilot, bin = process.env.SLIDECRAFT_COPILOT_BIN ?? 'copilot'): string[] {
  return [
    bin,
    '-p',
    prompt,
    '--allow-all-tools',
    '--output-format',
    'json',
    '--session-id',
    conversationId,
    '--no-auto-update',
    '--no-color',
    ...(config?.model ? ['--model', config.model] : []),
    ...(config?.effort ? ['--reasoning-effort', config.effort] : []),
  ]
}

interface CopilotOutcome {
  text: string
  exitCode: number | null
  filesModified: string[]
}

/** The JSON-lines event stream: assistant messages make the reply; the result line closes it. */
export function parseCopilotOutput(stdout: string): CopilotOutcome {
  const texts: string[] = []
  let exitCode: number | null = null
  let filesModified: string[] = []
  for (const line of stdout.split('\n')) {
    if (!line.trim()) continue
    let event: { type?: string; data?: { content?: string }; exitCode?: number; usage?: { codeChanges?: { filesModified?: string[] } } }
    try {
      event = JSON.parse(line)
    } catch {
      continue
    }
    if (event.type === 'assistant.message' && event.data?.content?.trim()) texts.push(event.data.content.trim())
    if (event.type === 'result') {
      exitCode = typeof event.exitCode === 'number' ? event.exitCode : null
      filesModified = event.usage?.codeChanges?.filesModified ?? []
    }
  }
  return { text: texts.join('\n\n'), exitCode, filesModified }
}

export async function runCopilot(input: CliChatInput): Promise<ChatResponse> {
  const run = input.run ?? runProcess
  const first = !copilotStarted.has(input.conversationId)
  const prompt = first ? `${input.contextPrompt}\n\n## Request\n\n${input.message}` : input.message
  const cmd = copilotCommand(prompt, input.conversationId)
  let result: ProcessResult
  try {
    result = await run(cmd, { cwd: input.cwd, timeoutMs: COPILOT_TIMEOUT_MS })
    if (result.exitCode !== 0 && SESSION_BUSY.test(result.stderr)) {
      await new Promise((r) => setTimeout(r, 250))
      result = await run(cmd, { cwd: input.cwd, timeoutMs: COPILOT_TIMEOUT_MS })
    }
  } catch (error) {
    return { message: `Could not start the Copilot CLI: ${(error as Error).message}. Is copilot installed and on PATH?`, error: 'copilot_spawn_error' }
  }
  if (result.timedOut) return { message: `The Copilot CLI did not finish within ${COPILOT_TIMEOUT_MS / 1000} s.`, error: 'copilot_error' }
  const outcome = parseCopilotOutput(result.stdout)
  if (result.exitCode !== 0 || (outcome.exitCode !== null && outcome.exitCode !== 0)) {
    return { message: `Copilot CLI error (exit ${outcome.exitCode ?? result.exitCode}): ${tail(result.stderr || outcome.text)}`, error: 'copilot_error' }
  }
  copilotStarted.add(input.conversationId)
  const deck = input.deck ?? deckFromFiles(outcome.filesModified, input.cwd, input.sourceId)
  return { message: outcome.text || 'Done', ...(outcome.filesModified.length ? modified(deck) : {}) }
}

/** `<cwd>/talks/q3/index.mdx` → `{ source, path: 'talks/q3' }`: the deck a CLI created. */
export function deckFromFiles(files: string[], cwd: string, sourceId?: string): DeckRef | undefined {
  if (!sourceId) return undefined
  for (const file of files) {
    const rel = relative(cwd, file).split(sep).join('/')
    if (rel.startsWith('..') || !rel.endsWith('/index.mdx')) continue
    return { source: sourceId, path: rel.slice(0, -'/index.mdx'.length) }
  }
  return undefined
}

/** For tests. */
export function resetCliSessions(): void {
  claudeSessions.clear()
  copilotStarted.clear()
}
