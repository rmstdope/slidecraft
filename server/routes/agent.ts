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
 * GET  /api/agent/threads/<vault>/<id>/turns/<n>/diff · POST …/turns/<n>/undo
 * POST /api/agent/attachments (multipart: vault, path?, file)
 */
import type { AgentBackendId, MessageContext } from '../../shared/agent.ts'
import { AttachmentError, MAX_ATTACHMENT_BYTES, storeAttachment } from '../lib/agent/attachments.ts'
import { localOrigin } from '../lib/agent/claudeCode.ts'
import { boundaryOf, parseMultipart } from '../lib/multipart.ts'
import { getAgentSettings, getContentSource, setAgentSettings } from '../lib/contentSources.ts'
import { createThread, defaultBackend, getBackends, getThread, getTurnDiff, listThreads, resolveApproval, sendMessage, stopTurn, ThreadError, undoAgentTurn } from '../lib/agent/threads.ts'
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
    attachments: Array.isArray(v.attachments) ? v.attachments.filter((a): a is string => typeof a === 'string' && !a.includes('..') && !a.startsWith('/')).slice(0, 20) : undefined,
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
    if (parts[0] === 'attachments' && parts.length === 1 && method === 'POST') return await handleAttachment(request)
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
      return json(await sendMessage(vault, id, body.text, contextOf(body.context), { appOrigin: localOrigin(request.headers.get('origin')) }), 202)
    }
    if (action === 'stop' && method === 'POST') return json({ stopped: stopTurn(vault, id) })
    if (action === 'turns' && parts[4] && /^\d+$/.test(parts[4])) {
      const turn = Number(parts[4])
      if (parts[5] === 'diff' && method === 'GET') return json(getTurnDiff(vault, id, turn))
      if (parts[5] === 'undo' && method === 'POST') return json({ files: undoAgentTurn(vault, id, turn) })
    }
    if (action === 'approvals' && parts[4] && method === 'POST') {
      const body = await readJson<{ allow?: unknown }>(request)
      if (!body || typeof body.allow !== 'boolean') return errorJson(400, 'Body must be JSON with an "allow" boolean')
      const approvalId = decode(parts[4])
      if (!approvalId || !resolveApproval(vault, id, approvalId, body.allow)) return errorJson(404, 'No such pending approval')
      return json({ ok: true })
    }
    return errorJson(404, 'Not found')
  } catch (error) {
    if (error instanceof ThreadError || error instanceof AttachmentError) return errorJson(error.status, error.message)
    return errorJson(500, 'Agent request failed', (error as Error).message)
  }
}

async function handleAttachment(request: Request): Promise<Response> {
  const boundary = boundaryOf(request.headers.get('content-type'))
  if (!boundary) return errorJson(400, 'Expected multipart/form-data')
  if (Number(request.headers.get('content-length') ?? 0) > MAX_ATTACHMENT_BYTES + 64 * 1024) return errorJson(413, 'The file is larger than 20 MB')
  const { fields, files } = parseMultipart(new Uint8Array(await request.arrayBuffer()), boundary)
  const vault = fields.vault ? getContentSource(fields.vault) : undefined
  if (!vault) return errorJson(404, 'No such vault')
  if (!files.file) return errorJson(400, 'Missing file')
  return json(await storeAttachment(vault, fields.path || undefined, files.file), 201)
}
