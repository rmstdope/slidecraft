/** Compile check for whole decks (Part 4 §7.2): syntax only; components are checked by the registry. */
import { compile } from '@mdx-js/mdx'
import { stripMdxFrontmatter, splitMdxFrontmatter } from '../../shared/frontmatter.ts'

export interface ValidationResult {
  valid: boolean
  message?: string
  line?: number
  column?: number
  snippet?: string
}

export async function validateMdx(content: string): Promise<ValidationResult> {
  const lineOffset = splitMdxFrontmatter(content).frontmatter.split('\n').length - 1
  try {
    await compile(stripMdxFrontmatter(content), { jsx: true, development: false })
    return { valid: true }
  } catch (error) {
    const e = error as { reason?: string; message: string; line?: number; column?: number; place?: { line?: number; column?: number; start?: { line: number; column: number } } }
    const rawLine = e.line ?? e.place?.start?.line ?? e.place?.line
    const line = rawLine != null ? rawLine + Math.max(0, lineOffset) : undefined
    const column = e.column ?? e.place?.start?.column ?? e.place?.column
    let snippet: string | undefined
    if (line) {
      const lines = content.split('\n')
      snippet = lines
        .slice(Math.max(0, line - 3), Math.min(lines.length, line + 2))
        .map((text, i) => {
          const n = Math.max(1, line - 2) + i
          return `${n === line ? '>>> ' : '    '}${n}: ${text}`
        })
        .join('\n')
    }
    return { valid: false, message: e.reason ?? e.message, line, column, snippet }
  }
}

export function formatValidationError(result: ValidationResult): string {
  const parts = ['MDX Compilation Error:', result.message ?? 'Unknown error']
  if (result.line) parts.push(`Location: line ${result.line}${result.column ? `, column ${result.column}` : ''}`)
  if (result.snippet) parts.push('Context:', result.snippet)
  return parts.join('\n')
}
