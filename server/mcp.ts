/**
 * MCP server over stdio (Part 4 §12): the deck tools for external agents such as Claude Code.
 * Content-directory resolution is the same as the HTTP server's (flag, env, config, fallback).
 * Everything here writes to stderr: stdout carries the protocol.
 *
 *   bun run mcp [--vault <name>] [--content <dir>]
 *
 * `screenshot_slide` renders through the running app: SLIDECRAFT_APP_ORIGIN (set by the in-app
 * agent to the page it was started from), else this server's own port.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { getContentDir, getDefaultContentSource } from './lib/contentSources.ts'
import { exportRef, writeHtmlExport, writePdfExport } from './lib/exportFiles.ts'
import { screenshotSlide } from './lib/exportPdf.ts'
import { parseDeck } from '../shared/deckParser.ts'
import { readDeckSource } from './lib/deckStore.ts'
import { resolveDeckRefInSources } from './lib/decks.ts'
import { PORT, VERSION } from './lib/paths.ts'
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

  server.registerTool('get_content_dir', { description: 'The vault this server works in and its folder (each presentation is <name>/index.mdx).', inputSchema: {} }, async () => {
    const vault = getDefaultContentSource()
    return text({ success: true, data: { contentDir: vault.path, vault: { id: vault.id, name: vault.name, readOnly: vault.readOnly } } })
  },
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
  server.registerTool(
    'screenshot_slide',
    {
      description:
        'Look at one slide as the audience will see it, every step shown, as a 960 × 540 image. Use it after editing a slide to check for overflow, wrapping titles and colour. Needs the Slidecraft app running and Chrome installed.',
      inputSchema: {
        name: z.string().describe('Presentation folder name'),
        index: z.number().int().describe('0-based slide index in the file, as read_presentation numbers them'),
        source: z.string().optional().describe('Vault id (default: this server\'s vault)'),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ name, index, source }) => {
      try {
        const ref = exportRef(name, source, undefined)
        const resolved = resolveDeckRefInSources(ref)
        const mdx = resolved ? await readDeckSource(resolved) : null
        if (mdx === null) return text({ success: false, error: `Presentation "${name}" not found` })
        const slides = parseDeck(mdx).slides
        const target = slides[index]
        if (!target) return text({ success: false, error: `There is no slide ${index}; the deck has ${slides.length} (0-based)` })
        if (target.hidden) return text({ success: false, error: `Slide ${index} is hidden, so it is never shown` })
        const visible = slides.slice(0, index).filter((s) => !s.hidden).length + 1
        const origin = process.env.SLIDECRAFT_APP_ORIGIN || `http://localhost:${PORT}`
        const png = await screenshotSlide(ref, origin, visible)
        return {
          content: [
            { type: 'image' as const, data: Buffer.from(png).toString('base64'), mimeType: 'image/png' },
            { type: 'text' as const, text: `Slide ${index} of ${slides.length}${target.titleText ? `: "${target.titleText}"` : ''}` },
          ],
        }
      } catch (error) {
        return text({ success: false, error: (error as Error).message })
      }
    },
  )
  return server
}

export async function runMcpServer(): Promise<void> {
  const server = createMcpServer()
  await server.connect(new StdioServerTransport())
  console.error(`Slidecraft MCP server ${VERSION} on stdio; vault ${getDefaultContentSource().name} (${getContentDir()})`)
}

if (import.meta.main) await runMcpServer()
