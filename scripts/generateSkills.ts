/**
 * Generates the skills' component catalogue (UX overhaul U4) from the component registry, so the
 * skills can never drift from the components. `bun run skills` writes it; `bun run build` runs it;
 * tests/skills.test.ts fails when the committed file is out of date.
 */
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { getAllTemplates, getParts, getTopLevelComponents, type RegistryConfig, type RegistryProp } from '../src/components/slides/defineComponent.ts'
import '../src/components/slides/index.ts'
import { COMPONENT_CATEGORIES } from '../server/lib/agentContext.ts'

const ROOT = join(import.meta.dir, '..')
export const CATALOGUE_FILE = join(ROOT, 'skills', 'slidecraft-presentations', 'references', 'components.md')

const cell = (text: string) => text.replace(/\|/g, '\\|').replace(/\n/g, ' ')

function propsTable(props: RegistryProp[]): string[] {
  if (props.length === 0) return ['No props.']
  return ['| Prop | Type | Default | What it does |', '|---|---|---|---|', ...props.map((p) => `| \`${p.name}\` | \`${cell(p.type)}\` | ${p.default ? `\`${cell(p.default)}\`` : ''} | ${cell(p.description ?? '')} |`)]
}

function entry(r: RegistryConfig, level: string): string[] {
  const lines = [`${level} ${r.name}`, '', r.description]
  if (r.useCases?.length) lines.push('', `Use for: ${r.useCases.join('; ')}.`)
  lines.push('', ...propsTable(r.props), '', '```mdx', r.snippet, '```')
  return lines
}

export function buildCatalogue(): string {
  const all = getTopLevelComponents().map((c) => c.registry)
  const byName = new Map(all.map((r) => [r.name, r]))
  const known = new Set(Object.values(COMPONENT_CATEGORIES).flat())
  const groups: [string, string[]][] = [...Object.entries(COMPONENT_CATEGORIES), ['Other', all.map((r) => r.name).filter((n) => !known.has(n))]]
  const out = [
    '<!-- Generated from the component registry by scripts/generateSkills.ts (`bun run skills`). Do not edit. -->',
    '',
    '# Components',
    '',
    'Every slide component, grouped by family, with its props and the smallest useful usage. Import',
    'each one you use from `@components`. Parts (such as `ListItem`) are listed under their parent.',
    '',
  ]
  out.push('| Family | Components |', '|---|---|')
  for (const [group, names] of groups) {
    const present = names.filter((n) => byName.has(n))
    if (present.length) out.push(`| ${group} | ${present.map((n) => `\`${n}\``).join(', ')} |`)
  }
  for (const [group, names] of groups) {
    const present = names.filter((n) => byName.has(n))
    if (!present.length) continue
    out.push('', `## ${group}`)
    for (const name of present) {
      out.push('', ...entry(byName.get(name)!, '###'))
      for (const part of getParts(name)) out.push('', ...entry(part.registry, '####'))
    }
  }
  out.push('', '## Slide templates', '', 'Whole-slide starting points (the editor\'s "Add slide" offers them too).')
  for (const t of getAllTemplates()) out.push('', `### ${t.name}`, '', t.description, '', '```mdx', t.snippet, '```')
  return `${out.join('\n')}\n`
}

if (import.meta.main) {
  writeFileSync(CATALOGUE_FILE, buildCatalogue())
  console.log(`Wrote ${CATALOGUE_FILE}`)
}
