import { expect, test } from 'bun:test'
import { router } from '../server/index.ts'

test('health identifies the app', async () => {
  const res = router(new Request('http://localhost:6110/api/health'))
  expect(res.status).toBe(200)
  expect(res.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:6100')
  const body = (await res.json()) as { app: string; pid: number }
  expect(body.app).toBe('slidecraft')
  expect(body.pid).toBe(process.pid)
})

test('unknown API routes are JSON 404s and OPTIONS is a preflight', async () => {
  const missing = router(new Request('http://localhost:6110/api/nope'))
  expect(missing.status).toBe(404)
  expect(await missing.json()).toEqual({ error: 'Not found' })
  const preflight = router(new Request('http://localhost:6110/api/mdx/x', { method: 'OPTIONS' }))
  expect(preflight.status).toBe(204)
  expect(preflight.headers.get('Access-Control-Max-Age')).toBe('86400')
})
