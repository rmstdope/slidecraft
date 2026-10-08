import { afterAll, describe, expect, test } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
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
      expect(tools.map((t) => t.name)).toEqual(expect.arrayContaining(['get_content_dir', 'list_presentations', 'read_presentation', 'create_presentation', 'insert_slide', 'update_slide', 'delete_slide', 'list_themes', 'set_presentation_theme']))
      const created = await client.callTool({ name: 'create_presentation', arguments: { name: 'from-mcp', slides: ['<Slide>\n  <Title>Hello</Title>\n</Slide>'] } })
      expect(created.isError).toBe(false)
      const read = await client.callTool({ name: 'read_presentation', arguments: { name: 'from-mcp' } })
      const data = JSON.parse((read.content as { text: string }[])[0].text)
      expect(data.slideSummary).toEqual(['"Hello" [dark/yellow]'])
      const bad = await client.callTool({ name: 'update_slide', arguments: { name: 'from-mcp', index: 0, content: '<Slide><Title>x</Tittle></Slide>' } })
      expect(bad.isError).toBe(true)
    } finally {
      await client.close()
    }
  }, 30000)
})
