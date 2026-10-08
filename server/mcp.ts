/**
 * MCP server over stdio (Part 4 §12): the deck tools for external agents such as Claude Code.
 * Content-directory resolution is the same as the HTTP server's (flag, env, config, fallback).
 * Everything here writes to stderr: stdout carries the protocol.
 *
 *   bun run mcp [--content <dir-or-name>]
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { getContentDir } from './lib/contentSources.ts'
import { VERSION } from './lib/paths.ts'
import { executeTool, TOOL_DEFINITIONS, type ToolDefinition, type ToolResult } from './lib/tools.ts'

type Shape = Record<string, z.ZodType>

/** The tools' JSON-schema subset (strings, integers, string arrays) as a zod shape. */
export function zodShape(definition: ToolDefinition): Shape {
  const required = new Set(definition.parameters.required ?? [])
  const shape: Shape = {}
  for (const [name, schema] of Object.entries(definition.parameters.properties ?? {})) {
    let field: z.ZodType = schema.type === 'integer' ? z.number().int() : schema.type === 'array' ? z.array(z.string()) : z.string()
    if (schema.description) field = field.describe(schema.description)
    shape[name] = required.has(name) ? field : field.optional()
  }
  return shape
}

const text = (result: ToolResult) => ({
  content: [{ type: 'text' as const, text: result.success ? JSON.stringify(result.data, null, 2) : (result.error ?? 'Failed') }],
  isError: !result.success,
})

export function createMcpServer(): McpServer {
  const server = new McpServer({ name: 'slidecraft', version: VERSION === 'dev' ? '0.0.0' : VERSION })

  server.registerTool('get_content_dir', { description: 'The folder that holds the presentations (each <name>/index.mdx).', inputSchema: {} }, async () =>
    text({ success: true, data: { contentDir: getContentDir() } }),
  )

  for (const definition of TOOL_DEFINITIONS) {
    server.registerTool(
      definition.name,
      { description: definition.description, inputSchema: zodShape(definition), annotations: { readOnlyHint: !definition.mutates } },
      async (args: Record<string, unknown>) => text(await executeTool(definition.name, args)),
    )
  }

  for (const name of ['export_html', 'export_pdf']) {
    server.registerTool(name, { description: `Export a presentation (${name === 'export_html' ? 'single HTML file' : 'PDF'}). Arrives with the export phase.`, inputSchema: { name: z.string() } }, async () =>
      text({ success: false, error: `${name} is not implemented yet` }),
    )
  }
  return server
}

if (import.meta.main) {
  const server = createMcpServer()
  await server.connect(new StdioServerTransport())
  console.error(`Slidecraft MCP server ${VERSION} on stdio; content directory ${getContentDir()}`)
}
