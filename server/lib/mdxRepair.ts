/**
 * Conservative repair before validation (Part 4 §7.4): components that never take children are
 * made self-closing when written as `<Stat value="1">` without a closer. Full tag balancing is
 * deliberately not done: it corrupts nested layouts.
 */
import { openingTagEnd } from '../../shared/deckParser.ts'

export const VOID_COMPONENTS = ['ContentImage', 'Svg', 'ProgressBar', 'Spectrum', 'Timeline', 'Stat', 'Divider', 'YouTube', 'BackgroundImage', 'Legend', 'ProConList', 'ComparisonTable', 'ScatterChart'] as const

export interface RepairResult {
  content: string
  repaired: boolean
  fixes: string[]
}

export function repairSlideContent(content: string): RepairResult {
  const fixes: string[] = []
  let out = content
  for (const name of VOID_COMPONENTS) {
    const re = new RegExp(`<${name}(?=[\\s>/])`, 'g')
    let match: RegExpExecArray | null
    let shift = 0
    const original = out
    while ((match = re.exec(original))) {
      const start = match.index + shift
      const end = openingTagEnd(out, start)
      if (end < 0 || out[end - 2] === '/') continue
      if (out.slice(end).trimStart().startsWith(`</${name}>`)) continue
      out = `${out.slice(0, end - 1).replace(/\s+$/, '')} />${out.slice(end)}`
      shift = out.length - original.length
      fixes.push(`Made <${name}> self-closing`)
    }
  }
  return { content: out, repaired: fixes.length > 0, fixes }
}
