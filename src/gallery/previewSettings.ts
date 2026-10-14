/**
 * Gallery preview settings: the header's theme, scheme, accent and frame, and the detail panel's
 * component props, applied to a registry preview as source rewrites. The rewritten code is what
 * the preview renders and what the snippet shows, so "Copy" copies what you see.
 */
import type { Scheme } from '@shared/themes.ts'
import { scanTag, setTagAttr, tagAttrs, type TagAttrValue } from '@shared/tagAttrs.ts'
import type { RegistryConfig, RegistryProp, ToolbarPropEditor } from '../components/slides/defineComponent'

/** "" everywhere means "the example's own": what its previewCode says. */
export interface GallerySettings {
  /** "<source>:<id>" of a registered theme, or "". */
  theme: string
  scheme: '' | Scheme
  accent: '' | 'yellow' | 'red' | 'teal' | 'navy'
  /** A frame of the chosen theme, "none", or "". */
  frame: string
}

/** Dark by default, so the grid is uniform; the rest keep each example's own choice. */
export const DEFAULT_SETTINGS: GallerySettings = { theme: '', scheme: 'dark', accent: '', frame: '' }

export const sameSettings = (a: GallerySettings, b: GallerySettings): boolean => a.theme === b.theme && a.scheme === b.scheme && a.accent === b.accent && a.frame === b.frame

/** Offsets of every `<Name …>` opening tag. */
export function tagStarts(source: string, name: string): number[] {
  const starts: number[] = []
  const re = new RegExp(`<${name}(?=[\\s/>])`, 'g')
  for (let m = re.exec(source); m; m = re.exec(source)) starts.push(m.index)
  return starts
}

/** Set (or with null remove) an attribute on every `<Name>` tag; last first, so offsets hold. */
export function setOnTags(source: string, name: string, attr: string, value: TagAttrValue | null): string {
  return tagStarts(source, name).reverse().reduce((text, start) => setTagAttr(text, attr, value, start), source)
}

export function applySettings(source: string, settings: GallerySettings): string {
  let out = source
  // A chosen theme is provided around the preview, so the example's own theme attributes go.
  if (settings.theme) {
    out = setOnTags(out, 'Presentation', 'theme', null)
    out = setOnTags(out, 'Slide', 'theme', null)
  }
  if (settings.scheme) out = setOnTags(out, 'Slide', 'scheme', settings.scheme)
  if (settings.accent) out = setOnTags(out, 'Slide', 'accent', settings.accent)
  if (settings.frame) out = setOnTags(out, 'Slide', 'frame', settings.frame)
  return out
}

export type PropValues = Record<string, TagAttrValue | null>

/** The attributes written on the first `<Name>` tag. */
export function readProps(source: string, name: string): Record<string, TagAttrValue> {
  const start = tagStarts(source, name)[0]
  return start === undefined ? {} : tagAttrs(source, start)
}

/** Apply changed props to the first `<Name>` tag; untouched props keep what the example says. */
export function applyProps(source: string, name: string, values: PropValues): string {
  const start = tagStarts(source, name)[0]
  if (start === undefined || !scanTag(source, start)) return source
  return Object.entries(values).reduce((text, [prop, value]) => setTagAttr(text, prop, value, start), source)
}

export type PropControl =
  | { kind: 'boolean'; prop: RegistryProp; defaultOn: boolean }
  | { kind: 'select'; prop: RegistryProp; options: string[] }
  | { kind: 'number'; prop: RegistryProp; min?: number; max?: number; step?: number }
  | { kind: 'text'; prop: RegistryProp }

/** Props that are about staging in a deck, not about the look. */
const SKIPPED = new Set(['step', 'morph', 'className', 'children'])

/** `"a" | "b"` → ['a', 'b']; anything else → null. */
export function unionOptions(type: string): string[] | null {
  const parts = type.split('|').map((p) => p.trim())
  return parts.every((p) => /^"[^"]*"$/.test(p)) ? parts.map((p) => p.slice(1, -1)) : null
}

/**
 * One control per prop that can be set without writing code: the toolbar editors first (they
 * carry ranges and option lists), then every other boolean, string, number or string-union prop.
 * Arrays, objects and images are left to the code.
 */
export function propControls(registry: RegistryConfig, toolbar: ToolbarPropEditor[] = []): PropControl[] {
  const controls: PropControl[] = []
  const seen = new Set<string>()
  const propOf = (name: string): RegistryProp => registry.props.find((p) => p.name === name) ?? { name, type: 'string' }
  for (const editor of toolbar) {
    const prop = propOf(String(editor.prop))
    if (SKIPPED.has(prop.name) || editor.type === 'image') continue
    seen.add(prop.name)
    if (editor.type === 'boolean') controls.push({ kind: 'boolean', prop, defaultOn: prop.default === 'true' })
    else if (editor.type === 'select') controls.push({ kind: 'select', prop, options: editor.options ?? [] })
    else controls.push({ kind: 'number', prop, min: editor.min, max: editor.max, step: editor.step })
  }
  for (const prop of registry.props) {
    if (seen.has(prop.name) || SKIPPED.has(prop.name)) continue
    const type = prop.type.trim()
    const options = unionOptions(type)
    if (type === 'boolean') controls.push({ kind: 'boolean', prop, defaultOn: prop.default === 'true' })
    else if (options) controls.push({ kind: 'select', prop, options })
    else if (type === 'number') controls.push({ kind: 'number', prop })
    else if (type === 'string') controls.push({ kind: 'text', prop })
  }
  return controls
}

/** The attribute a control writes for an input value; null removes it. */
export function controlValue(control: PropControl, input: string | boolean): TagAttrValue | null {
  switch (control.kind) {
    case 'boolean':
      // Off on a prop that defaults to on has to be written out; otherwise the attribute goes.
      return input === true ? (control.defaultOn ? null : true) : control.defaultOn ? { expression: 'false' } : null
    case 'number':
      return typeof input === 'string' && /^-?\d+(\.\d+)?$/.test(input.trim()) ? { expression: input.trim() } : null
    default:
      return typeof input === 'string' && input !== '' ? input : null
  }
}

/** What a control shows for an attribute value (or the prop's default when absent). */
export function controlInput(control: PropControl, value: TagAttrValue | undefined): string | boolean {
  if (control.kind === 'boolean') {
    if (value === undefined) return control.defaultOn
    return value === true || value === 'true' || (typeof value === 'object' && value.expression.trim() === 'true')
  }
  if (value === undefined || value === true) return ''
  return typeof value === 'object' ? value.expression : value
}
