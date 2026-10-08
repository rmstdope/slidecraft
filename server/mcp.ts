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
import { exportRef, writeHtmlExport, writePdfExport } from './lib/exportFiles.ts'
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

  const exportInput = {
    name: z.string().describe('Presentation folder name'),
    source: z.string().optional().describe('Content source id (default: the default source)'),
    path: z.string().optional().describe('Deck path inside the source (default: the name)'),
    outDir: z.string().optional().describe('Output folder; relative paths are inside the content folder (default "exports")'),
  }
  server.registerTool(
    'export_html',
    { description: 'Export a presentation as one self-contained HTML file that works offline. Returns the file path.', inputSchema: exportInput },
    async ({ name, source, path, outDir }) => {
      try {
        return text({ success: true, data: await writeHtmlExport(exportRef(name, source, path), outDir) })
      } catch (error) {
        return text({ success: false, error: (error as Error).message })
      }
    },
  )
  server.registerTool(
    'export_pdf',
    {
      description: 'Export a presentation as a PDF with one page per slide. Needs the Slidecraft HTTP server running and Chrome installed.',
      inputSchema: { ...exportInput, origin: z.string().optional().describe('Running Slidecraft server (default http://localhost:<port>)') },
    },
    async ({ name, source, path, outDir, origin }) => {
      try {
        return text({ success: true, data: await writePdfExport(exportRef(name, source, path), outDir, origin) })
      } catch (error) {
        return text({ success: false, error: (error as Error).message })
      }
    },
  )
  return server
}

if (import.meta.main) {
  const server = createMcpServer()
  await server.connect(new StdioServerTransport())
  console.error(`Slidecraft MCP server ${VERSION} on stdio; content directory ${getContentDir()}`)
}
