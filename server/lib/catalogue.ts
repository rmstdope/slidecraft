/** One component's catalogue entry, as the skills' references show it (shared by the generators). */
import type { RegistryConfig, RegistryProp } from '../../src/components/slides/defineComponent.ts'

const cell = (text: string) => text.replace(/\|/g, '\\|').replace(/\n/g, ' ')

export function propsTable(props: RegistryProp[]): string[] {
  if (props.length === 0) return ['No props.']
  return ['| Prop | Type | Default | What it does |', '|---|---|---|---|', ...props.map((p) => `| \`${p.name}\` | \`${cell(p.type)}\` | ${p.default ? `\`${cell(p.default)}\`` : ''} | ${cell(p.description ?? '')} |`)]
}

export function catalogueEntry(r: RegistryConfig, level: string): string[] {
  const lines = [`${level} ${r.name}`, '', r.description]
  if (r.useCases?.length) lines.push('', `Use for: ${r.useCases.join('; ')}.`)
  lines.push('', ...propsTable(r.props), '', '```mdx', r.snippet, '```')
  return lines
}
