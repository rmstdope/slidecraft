/**
 * A minimal headless Chrome driver over the DevTools protocol (Bun has WebSocket built in), so
 * PDF export needs no Puppeteer download and stays inside the release binary.
 */
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export const CHROME_CANDIDATES = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
]

/** CHROME_PATH first, then the usual install locations. */
export function findChrome(env = process.env, exists: (p: string) => boolean = existsSync): string | null {
  const candidates = [env.CHROME_PATH, ...CHROME_CANDIDATES].filter((p): p is string => !!p)
  return candidates.find((p) => exists(p)) ?? null
}

export interface CdpPage {
  send<T = any>(method: string, params?: Record<string, unknown>): Promise<T>
  /** Evaluates an expression in the page, awaiting promises; returns the value or throws the page error. */
  evaluate<T = unknown>(expression: string): Promise<T>
}

export interface Browser {
  newPage(): Promise<CdpPage>
  close(): void
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export async function launchChrome(executable: string): Promise<Browser> {
  const profile = mkdtempSync(join(tmpdir(), 'slidecraft-chrome-'))
  const proc = Bun.spawn(
    [executable, '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check', `--user-data-dir=${profile}`, '--remote-debugging-port=0', 'about:blank'],
    { stdout: 'ignore', stderr: 'ignore' },
  )
  const sockets: WebSocket[] = []
  const close = () => {
    sockets.forEach((s) => s.close())
    proc.kill()
    setTimeout(() => rmSync(profile, { recursive: true, force: true }), 500)
  }
  // Chrome writes the port it picked into the profile.
  let port = 0
  for (let i = 0; i < 100 && !port; i++) {
    await sleep(100)
    const file = join(profile, 'DevToolsActivePort')
    if (existsSync(file)) port = Number(readFileSync(file, 'utf8').split('\n')[0])
    if (proc.exitCode !== null) break
  }
  if (!port) {
    close()
    throw new Error('Chrome did not start')
  }

  return {
    async newPage() {
      const res = await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })
      const target = (await res.json()) as { webSocketDebuggerUrl: string }
      const socket = new WebSocket(target.webSocketDebuggerUrl)
      sockets.push(socket)
      await new Promise<void>((resolve, reject) => {
        socket.onopen = () => resolve()
        socket.onerror = () => reject(new Error('Could not connect to Chrome'))
      })
      let id = 0
      const pending = new Map<number, { resolve: (v: any) => void; reject: (e: Error) => void }>()
      socket.onmessage = (event) => {
        const message = JSON.parse(String(event.data)) as { id?: number; result?: unknown; error?: { message: string } }
        const waiter = message.id ? pending.get(message.id) : undefined
        if (!waiter) return
        pending.delete(message.id!)
        if (message.error) waiter.reject(new Error(message.error.message))
        else waiter.resolve(message.result)
      }
      const send = <T,>(method: string, params: Record<string, unknown> = {}) =>
        new Promise<T>((resolve, reject) => {
          pending.set(++id, { resolve, reject })
          socket.send(JSON.stringify({ id, method, params }))
        })
      return {
        send,
        async evaluate<T>(expression: string) {
          const result = await send<{ result: { value?: T }; exceptionDetails?: { exception?: { description?: string }; text: string } }>('Runtime.evaluate', {
            expression,
            awaitPromise: true,
            returnByValue: true,
          })
          if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text)
          return result.result.value as T
        },
      }
    },
    close,
  }
}
