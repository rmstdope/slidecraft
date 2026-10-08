import { expect, test } from 'bun:test'

test('dev ports are constants that ignore the environment', async () => {
  const proc = Bun.spawn(
    ['bun', '--eval', `import { API_PORT, CLIENT_PORT } from './shared/ports.ts'; console.log(JSON.stringify({ api: API_PORT, client: CLIENT_PORT }))`],
    {
      cwd: `${import.meta.dir}/..`,
      env: { ...process.env, SLIDECRAFT_API_PORT: '7200', SLIDECRAFT_CLIENT_PORT: '7201', PORT: '7202' },
      stdout: 'pipe',
    },
  )
  const output = await new Response(proc.stdout).text()
  expect(await proc.exited).toBe(0)
  expect(JSON.parse(output.trim())).toEqual({ api: 6110, client: 6100 })
})
