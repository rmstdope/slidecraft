/**
 * The agent API (UX overhaul U2). Events of a running turn arrive on /api/events as
 * `agent-event`; these routes start and steer turns.
 *
 * GET  /api/agent/backends
 * GET  /api/agent/settings · PUT /api/agent/settings {backend?, model?}
 * GET  /api/agent/threads?vault=<id>[&path=<deck>]
 * POST /api/agent/threads {vault, path?, backend?}
 * GET  /api/agent/threads/<vault>/<id>
 * POST /api/agent/threads/<vault>/<id>/messages {text, context?}
 * POST /api/agent/threads/<vault>/<id>/stop
 * POST /api/agent/threads/<vault>/<id>/approvals/<approvalId> {allow}
 */
import type { AgentBackendId, MessageContext } from '../../shared/agent.ts'
import { getAgentSettings, setAgentSettings } from '../lib/contentSources.ts'
import { createThread, defaultBackend, getBackends, getThread, listThreads, resolveApproval, sendMessage, stopTurn, ThreadError } from '../lib/agent/threads.ts'
import { errorJson, json, readJson } from '../lib/http.ts'

const decode = (segment: string | undefined): string | null => {
  try {
    return segment === undefined ? null : decodeURIComponent(segment)
  } catch {
    return null
  }
}

function contextOf(value: unknown): MessageContext | undefined {
  if (!value || typeof value !== 'object') return undefined
  const v = value as Record<string, unknown>
  return {
    slide: typeof v.slide === 'number' && Number.isInteger(v.slide) ? v.slide : undefined,
    selection: typeof v.selection === 'string' ? v.selection : undefined,
  }
}

export async function handleAgent(request: Request, url: URL): Promise<Response> {
  const parts = url.pathname.slice('/api/agent/'.length).split('/')
  const method = request.method
  try {
    if (parts[0] === 'backends' && parts.length === 1 && method === 'GET') {
      return json(await Promise.all(getBackends().map((b) => b.detect())))
    }
    if (parts[0] === 'settings' && parts.length === 1) {
      if (method === 'GET') return json({ ...getAgentSettings(), backend: defaultBackend() })
      if (method === 'PUT') {
        const body = await readJson<{ backend?: unknown; model?: unknown }>(request)
        if (!body) return errorJson(400, 'Body must be JSON')
        if (body.backend !== undefined && !getBackends().some((b) => b.id === body.backend)) return errorJson(400, `Unknown agent "${String(body.backend)}"`)
        setAgentSettings({ backend: typeof body.backend === 'string' ? body.backend : undefined, model: typeof body.model === 'string' ? body.model : undefined })
        return json({ ...getAgentSettings(), backend: defaultBackend() })
      }
      return errorJson(405, 'Method not allowed')
    }
    if (parts[0] !== 'threads') return errorJson(404, 'Not found')

    if (parts.length === 1) {
      if (method === 'GET') {
        const vault = url.searchParams.get('vault')
        if (!vault) return errorJson(400, 'vault is required')
        const path = url.searchParams.get('path')
        return json(listThreads(vault, path ? { source: vault, path } : undefined))
      }
      if (method === 'POST') {
        const body = await readJson<{ vault?: unknown; path?: unknown; backend?: unknown }>(request)
        if (!body || typeof body.vault !== 'string') return errorJson(400, 'Body must be JSON with a "vault" string')
        const path = typeof body.path === 'string' && body.path ? body.path : undefined
        const thread = createThread(body.vault, { deck: path ? { source: body.vault, path } : undefined, backend: typeof body.backend === 'string' ? (body.backend as AgentBackendId) : undefined })
        return json(thread, 201)
      }
      return errorJson(405, 'Method not allowed')
    }

    const vault = decode(parts[1])
    const id = decode(parts[2])
    if (!vault || !id) return errorJson(400, 'Invalid conversation path')
    const action = parts[3]

    if (!action && method === 'GET') return json(getThread(vault, id))
    if (action === 'messages' && method === 'POST') {
      const body = await readJson<{ text?: unknown; context?: unknown }>(request)
      if (!body || typeof body.text !== 'string') return errorJson(400, 'Body must be JSON with a "text" string')
      return json(await sendMessage(vault, id, body.text, contextOf(body.context)), 202)
    }
    if (action === 'stop' && method === 'POST') return json({ stopped: stopTurn(vault, id) })
    if (action === 'approvals' && parts[4] && method === 'POST') {
      const body = await readJson<{ allow?: unknown }>(request)
      if (!body || typeof body.allow !== 'boolean') return errorJson(400, 'Body must be JSON with an "allow" boolean')
      const approvalId = decode(parts[4])
      if (!approvalId || !resolveApproval(vault, id, approvalId, body.allow)) return errorJson(404, 'No such pending approval')
      return json({ ok: true })
    }
    return errorJson(404, 'Not found')
  } catch (error) {
    if (error instanceof ThreadError) return errorJson(error.status, error.message)
    return errorJson(500, 'Agent request failed', (error as Error).message)
  }
}
