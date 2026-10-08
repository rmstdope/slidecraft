import { CLIENT_URL } from '../../shared/ports.ts'

export const corsHeaders = {
  'Access-Control-Allow-Origin': CLIENT_URL,
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export const json = (body: unknown, status = 200, headers: Record<string, string> = {}): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...corsHeaders, ...headers } })

export const errorJson = (status: number, error: string, details?: string): Response => json(details ? { error, details } : { error }, status)

export const preflight = (): Response => new Response(null, { status: 204, headers: { ...corsHeaders, 'Access-Control-Max-Age': '86400' } })

export async function readJson<T = Record<string, unknown>>(request: Request): Promise<T | null> {
  try {
    const value: unknown = await request.json()
    return typeof value === 'object' && value !== null ? (value as T) : null
  } catch {
    return null
  }
}

export const readOnlyError = (sourceId: string): Response => errorJson(403, `Content source "${sourceId}" is read-only`)
