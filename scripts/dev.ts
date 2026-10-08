/**
 * Development orchestrator (Part 4 §10.3). Reuses servers that are already running instead of
 * starting duplicates, and never moves to another port.
 *
 *   bun run dev          start whichever of API (6110) and Vite (6100) is not running
 *   bun scripts/dev.ts status
 */
import { API_PORT, API_URL, CLIENT_PORT, CLIENT_URL } from '../shared/ports.ts'

interface Health {
  app?: string
  version?: string
  pid?: number
  contentDir?: string
}

async function fetchWithTimeout(url: string, ms = 1500): Promise<Response | null> {
  try {
    return await fetch(url, { signal: AbortSignal.timeout(ms) })
  } catch {
    return null
  }
}

async function apiHealth(): Promise<Health | null> {
  const res = await fetchWithTimeout(`${API_URL}/api/health`)
  if (!res?.ok) return null
  const body = (await res.json().catch(() => null)) as Health | null
  return body?.app === 'slidecraft' ? body : null
}

const clientRunning = async () => (await fetchWithTimeout(`${CLIENT_URL}/@vite/client`))?.ok === true
const portTaken = async (url: string) => (await fetchWithTimeout(url)) !== null

async function status(): Promise<number> {
  const [api, client] = await Promise.all([apiHealth(), clientRunning()])
  console.log(
    api
      ? `API server   ${API_URL}  running (slidecraft ${api.version}, pid ${api.pid}${api.contentDir ? `, content ${api.contentDir}` : ''})`
      : `API server   ${API_URL}  not running`,
  )
  console.log(`Vite dev     ${CLIENT_URL}  ${client ? 'running' : 'not running'}`)
  return api && client ? 0 : 1
}

async function start(serverArgs: string[]): Promise<number> {
  const [api, client] = await Promise.all([apiHealth(), clientRunning()])
  if (api && client) {
    console.log(`Slidecraft is already running at ${CLIENT_URL}`)
    return 0
  }
  if (!api && (await portTaken(`${API_URL}/`))) {
    console.error(`Port ${API_PORT} is taken by something that is not slidecraft.`)
    return 1
  }
  if (!client && (await portTaken(`${CLIENT_URL}/`))) {
    console.error(`Port ${CLIENT_PORT} is taken by something that is not the slidecraft Vite server.`)
    return 1
  }

  const env = { ...process.env, PORT: String(API_PORT), SLIDECRAFT_API_PORT: String(API_PORT), SLIDECRAFT_CLIENT_PORT: String(CLIENT_PORT) }
  const children = [
    // Flags such as --content are passed through to the API server.
    ...(api ? [] : [Bun.spawn(['bun', '--watch', 'server/index.ts', ...serverArgs], { env, stdio: ['inherit', 'inherit', 'inherit'] })]),
    ...(client ? [] : [Bun.spawn(['bunx', 'vite'], { env, stdio: ['inherit', 'inherit', 'inherit'] })]),
  ]
  if (api) console.log(`Reusing API server on ${API_URL}${serverArgs.length ? ` (ignoring ${serverArgs.join(' ')}: it keeps its own content directory)` : ''}`)
  if (client) console.log(`Reusing Vite dev server on ${CLIENT_URL}`)

  const stopAll = () => children.forEach((child) => child.kill())
  process.on('SIGINT', stopAll)
  process.on('SIGTERM', stopAll)

  // The first child to exit takes the other down; its exit code becomes ours.
  const code = await Promise.race(children.map((child) => child.exited))
  stopAll()
  return code
}

process.exit(process.argv[2] === 'status' ? await status() : await start(process.argv.slice(2)))
