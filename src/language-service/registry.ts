/** Registry metadata as language-service data (Part 3 §5.2–5.3). */
import type { RegistryConfig, ToolbarPropEditor } from '../components/slides/defineComponent'
import type { ComponentInfo, PropInfo, PropType, ToolbarOption } from './types'

/** Classify a registry prop type string: `"a" | "b"`, `string[]`, `{ … }`, `boolean`, … */
export function parseTypeString(raw: string): PropType {
  const t = raw.trim()
  if (t === 'boolean') return { kind: 'boolean' }
  if (t === 'number') return { kind: 'number' }
  if (t === 'string') return { kind: 'string' }
  if (t === 'ReactNode' || t === 'React.ReactNode') return { kind: 'ReactNode' }
  const parts = t.split('|').map((p) => p.trim())
  if (parts.length > 0 && parts.every((p) => /^(["']).*\1$/.test(p))) return { kind: 'union', values: parts.map((p) => p.slice(1, -1)) }
  if (/^Array</.test(t)) return { kind: 'array', elementType: t.slice(6, -1) }
  if (t.endsWith('[]')) return { kind: 'array', elementType: t.slice(0, -2) }
  if (t.startsWith('{') || t.startsWith('Record<') || t === 'object') return { kind: 'object' }
  if (t.includes('=>') || t.startsWith('(') || t === 'function') return { kind: 'function' }
  return { kind: 'unknown', rawType: t }
}

export function formatPropType(type: PropType, raw: string): string {
  return type.kind === 'union' ? type.values.map((v) => `"${v}"`).join(' | ') : raw
}

/** Children are expected when the snippet holds content between an opening and a closing tag. */
export function snippetHasChildren(snippet: string): boolean {
  return /^<[A-Z]\w*[^>]*[^/]>/.test(snippet.trim()) && /<\/[A-Z]\w*>\s*$/.test(snippet.trim())
}

export function convertRegistryConfig(config: RegistryConfig): ComponentInfo {
  const props: PropInfo[] = config.props.map((p) => ({
    name: p.name,
    type: parseTypeString(p.type),
    rawType: p.type,
    required: p.default === undefined && !/optional|defaults? to/i.test(p.description ?? ''),
    defaultValue: p.default,
    description: p.description,
  }))
  return {
    name: config.name,
    description: config.description,
    props,
    snippet: config.snippet,
    keywords: config.keywords ?? [],
    useCases: config.useCases ?? [],
    hasChildren: snippetHasChildren(config.snippet),
  }
}

export const convertToolbarConfig = (toolbar: ToolbarPropEditor[] | undefined): ToolbarOption[] | undefined =>
  toolbar?.map((t) => ({ prop: String(t.prop), type: t.type, options: t.options }))

/** Values for a prop: toolbar options first (most precise), then union values, then booleans. */
export function propValues(component: ComponentInfo | undefined, prop: string, toolbar: ToolbarOption[] | undefined): string[] | undefined {
  const option = toolbar?.find((t) => t.prop === prop)
  if (option?.type === 'select' && option.options?.length) return option.options
  const info = component?.props.find((p) => p.name === prop)
  if (info?.type.kind === 'union') return info.type.values
  if (option?.type === 'boolean' || info?.type.kind === 'boolean') return ['true', 'false']
  return undefined
}
