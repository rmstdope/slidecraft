import { afterAll, describe, expect, test } from 'bun:test'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'

const content = mkdtempSync(join(tmpdir(), 'slidecraft-mcp-'))
afterAll(() => rmSync(content, { recursive: true, force: true }))

describe('MCP server over stdio', () => {
  test('lists the deck tools and creates and reads a presentation', async () => {
    const transport = new StdioClientTransport({
      command: 'bun',
      args: ['server/mcp.ts', '--content', content],
      cwd: join(import.meta.dir, '..'),
      env: { ...process.env, SLIDECRAFT_CONFIG: join(content, 'no-config.json') } as Record<string, string>,
      stderr: 'pipe',
    })
    const client = new Client({ name: 'test', version: '1.0.0' })
    await client.connect(transport)
    try {
      const { tools } = await client.listTools()
      expect(tools.map((t) => t.name)).toEqual(expect.arrayContaining(['get_content_dir', 'list_presentations', 'read_presentation', 'create_presentation', 'insert_slide', 'update_slide', 'delete_slide', 'list_themes', 'set_presentation_theme', 'validate_deck', 'screenshot_slide']))
      const created = await client.callTool({ name: 'create_presentation', arguments: { name: 'from-mcp', slides: ['<Slide>\n  <Title>Hello</Title>\n</Slide>'] } })
      expect(created.isError).toBe(false)
      const read = await client.callTool({ name: 'read_presentation', arguments: { name: 'from-mcp' } })
      const data = JSON.parse((read.content as { text: string }[])[0].text)
      expect(data.slideSummary).toEqual(['"Hello" [dark/yellow]'])
      const bad = await client.callTool({ name: 'update_slide', arguments: { name: 'from-mcp', index: 0, content: '<Slide><Title>x</Tittle></Slide>' } })
      expect(bad.isError).toBe(true)
      const checked = await client.callTool({ name: 'validate_deck', arguments: { name: 'from-mcp' } })
      expect(JSON.parse((checked.content as { text: string }[])[0].text)).toMatchObject({ ok: true, slideCount: 1, problems: [] })
      const missing = await client.callTool({ name: 'screenshot_slide', arguments: { name: 'from-mcp', index: 5 } })
      expect((missing.content as { text: string }[])[0].text).toContain('There is no slide 5')
    } finally {
      await client.close()
    }
  }, 30000)
})

const funnel = `import { defineComponent, Text } from 'slidecraft'

export const Funnel = defineComponent<{ label?: string }>({
  Component: ({ label = 'hi' }) => <Text>{label}</Text>,
  registry: { id: 'funnel', name: 'Funnel', category: 'component', description: 'A test component.', props: [{ name: 'label', type: 'string' }], snippet: '<Funnel />', previewCode: '<Slide><Funnel /></Slide>' },
})
`

/** An MCP server over stdio on one vault of a config with a trusted and an untrusted vault. */
async function vaultClient(vault: string): Promise<{ client: Client; call: (name: string, args: Record<string, unknown>) => Promise<{ text: string; isError: boolean }> }> {
  const root = join(content, 'vaults')
  for (const id of ['acme', 'stranger']) {
    mkdirSync(join(root, id, 'components', 'Funnel'), { recursive: true })
    writeFileSync(join(root, id, 'components', 'Funnel', 'index.tsx'), funnel)
    mkdirSync(join(root, id, 'pitch'), { recursive: true })
    writeFileSync(join(root, id, 'pitch', 'index.mdx'), '<Presentation>\n\n<Slide>\n  <Title>T</Title>\n  <Funnel label="x" />\n</Slide>\n\n</Presentation>\n')
  }
  const config = join(root, 'config.json')
  writeFileSync(config, JSON.stringify({ vaults: [{ id: 'acme', name: 'Acme', path: join(root, 'acme'), components: 'trusted' }, { id: 'stranger', name: 'Stranger', path: join(root, 'stranger') }] }))
  const transport = new StdioClientTransport({
    command: 'bun',
    args: ['server/mcp.ts', '--vault', vault],
    cwd: join(import.meta.dir, '..'),
    env: { ...process.env, SLIDECRAFT_CONFIG: config } as Record<string, string>,
    stderr: 'pipe',
  })
  const client = new Client({ name: 'test', version: '1.0.0' })
  await client.connect(transport)
  const call = async (name: string, args: Record<string, unknown>) => {
    const result = await client.callTool({ name, arguments: args })
    return { text: (result.content as { text: string }[])[0].text, isError: result.isError === true }
  }
  return { client, call }
}

describe('MCP server on a vault with its own components', () => {
  test('a trusted vault: validation knows its components, and the export carries them', async () => {
    const { client, call } = await vaultClient('acme')
    try {
      expect(JSON.parse((await call('validate_deck', { name: 'pitch' })).text)).toMatchObject({ ok: true, problems: [] })
      expect(JSON.parse((await call('validate_component', { name: 'Funnel' })).text)).toMatchObject({ ok: true })
      // The export needs the built viewer (`bun run build`).
      if (existsSync(join(import.meta.dir, '..', 'dist', 'viewer', 'viewer.js'))) {
        const exported = JSON.parse((await call('export_html', { name: 'pitch' })).text) as { filePath: string }
        expect(readFileSync(exported.filePath, 'utf8')).toContain('<script type="importmap">')
      }
    } finally {
      await client.close()
    }
  }, 30000)

  test('an untrusted vault: its code is not run, and both checks say so', async () => {
    const { client, call } = await vaultClient('stranger')
    try {
      const deck = JSON.parse((await call('validate_deck', { name: 'pitch' })).text) as { problems: { message: string }[] }
      expect(deck.problems.map((p) => p.message).join('\n')).toContain('not been allowed to run')
      const component = JSON.parse((await call('validate_component', { name: 'Funnel' })).text) as { problems: { message: string }[] }
      expect(component.problems[0].message).toContain('not allowed to run')
    } finally {
      await client.close()
    }
  }, 30000)
})
