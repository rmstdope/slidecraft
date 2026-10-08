/**
 * Theme format (plan Phase 4b). A theme is a folder with a theme.json plus the assets it names
 * (frame SVGs, logos, fonts). Built-in themes ship with the app; more live in a content
 * directory under themes/<id>/. This module is shared by the browser and the server: types,
 * validation and `extends` merging. Asset paths are relative to the theme folder, absolute app
 * paths ("/logo.svg"), or data:/http(s) URLs.
 */

export type Scheme = 'dark' | 'light'
export const SCHEMES: readonly Scheme[] = ['dark', 'light']
export const ACCENT_TOKENS = ['yellow', 'red', 'teal', 'navy', 'navyOnDark', 'gray'] as const
export type AccentToken = (typeof ACCENT_TOKENS)[number]

export interface SchemeTokens {
  bg?: string
  text?: string
  muted?: string
}

export interface ThemeFontFile {
  src: string
  weight?: number | string
  style?: 'normal' | 'italic'
}

export interface ThemeFont {
  /** CSS family name; with `files` it is loaded under a theme-private name. */
  family: string
  fallback?: string
  files?: ThemeFontFile[]
}

/** Absolute placement in 1920×1080 design pixels. */
export interface Placement {
  top?: number
  right?: number
  bottom?: number
  left?: number
  height?: number
  opacity?: number
}

export interface FrameSpec {
  name?: string
  description?: string
  /** Background art drawn at 1920×1080 behind the content; never scaled with the body. */
  svg?: string
  /** Forces the colour scheme on slides using this frame. */
  scheme?: Scheme
  layout?: 'centered' | 'document'
  /** Content padding: top, right, bottom, left. */
  padding?: [number, number, number, number]
  align?: 'left' | 'center'
  /** Width limit for the content column. */
  maxWidth?: number
  /** Gap between stacked items in centered layout. */
  gap?: number
  /** The line under a document header: the accent border, the theme's bar, or none. */
  headerRule?: 'accent' | 'bar' | 'none'
  /** Logo placement on this frame; null hides it. */
  logo?: Placement | null
  /** Footer text placement (the theme's footer.text); null hides it. */
  footerText?: (Placement & { color?: string; size?: number }) | null
  /** Draw the document footer rule. */
  footerRule?: boolean
  title?: { size?: number; color?: string }
  subtitle?: { variant?: 'eyebrow' | 'subheadline'; color?: string }
}

export interface ThemeSpec {
  name: string
  description?: string
  /** Id of a theme to start from; this theme's fields override it. */
  extends?: string
  tokens?: {
    accents?: Partial<Record<AccentToken, string>>
    dark?: SchemeTokens
    light?: SchemeTokens
    /** Dark ink for text on light fills (e.g. on yellow). */
    ink?: string
    /** Colour of the sheared header bar used by `headerRule: "bar"`. */
    bar?: string
  }
  fonts?: { display?: ThemeFont; body?: ThemeFont }
  logos?: { onDark?: string | null; onLight?: string | null }
  /** Logo placement on slides without a frame; null hides it. */
  logo?: Placement | null
  footer?: { text?: string | null; rule?: boolean }
  frames?: Record<string, FrameSpec>
  defaults?: {
    scheme?: Scheme
    accent?: 'yellow' | 'red' | 'teal' | 'navy'
    transition?: string
    layout?: 'centered' | 'document'
    /** Frame for slides that do not name one; "none" for no frame. */
    frame?: string
  }
  constraints?: {
    /** Allowed schemes; slides asking for another get the first. */
    schemes?: Scheme[]
    /** False removes gradients from every slide. */
    gradients?: boolean
  }
}

export interface ParsedTheme {
  spec: ThemeSpec | null
  errors: string[]
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const isString = (v: unknown): v is string => typeof v === 'string'
const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

export const THEME_ID_RE = /^[a-z0-9][a-z0-9-]*$/

function pickString(obj: Record<string, unknown>, key: string, path: string, errors: string[]): string | undefined {
  const v = obj[key]
  if (v === undefined) return undefined
  if (isString(v)) return v
  errors.push(`${path}.${key} must be a string`)
  return undefined
}

function pickEnum<T extends string>(obj: Record<string, unknown>, key: string, allowed: readonly T[], path: string, errors: string[]): T | undefined {
  const v = obj[key]
  if (v === undefined) return undefined
  if (isString(v) && (allowed as readonly string[]).includes(v)) return v as T
  errors.push(`${path}.${key} must be one of ${allowed.join(', ')}`)
  return undefined
}

function parsePlacement(v: unknown, path: string, errors: string[]): Placement | null | undefined {
  if (v === undefined) return undefined
  if (v === null) return null
  if (!isObject(v)) {
    errors.push(`${path} must be an object or null`)
    return undefined
  }
  const out: Placement = {}
  for (const key of ['top', 'right', 'bottom', 'left', 'height', 'opacity'] as const) {
    if (v[key] === undefined) continue
    if (isNumber(v[key])) out[key] = v[key] as number
    else errors.push(`${path}.${key} must be a number`)
  }
  return out
}

function parseFont(v: unknown, path: string, errors: string[]): ThemeFont | undefined {
  if (v === undefined) return undefined
  if (!isObject(v) || !isString(v.family)) {
    errors.push(`${path} needs a "family" string`)
    return undefined
  }
  const font: ThemeFont = { family: v.family }
  const fallback = pickString(v, 'fallback', path, errors)
  if (fallback) font.fallback = fallback
  if (v.files !== undefined) {
    if (!Array.isArray(v.files)) errors.push(`${path}.files must be an array`)
    else {
      font.files = []
      v.files.forEach((f, i) => {
        if (!isObject(f) || !isString(f.src)) return errors.push(`${path}.files[${i}] needs a "src" string`)
        font.files!.push({ src: f.src, weight: isNumber(f.weight) || isString(f.weight) ? f.weight : undefined, style: f.style === 'italic' ? 'italic' : 'normal' })
      })
    }
  }
  return font
}

function parseFrame(v: unknown, path: string, errors: string[]): FrameSpec | undefined {
  if (!isObject(v)) {
    errors.push(`${path} must be an object`)
    return undefined
  }
  const frame: FrameSpec = {}
  for (const key of ['name', 'description', 'svg'] as const) {
    const s = pickString(v, key, path, errors)
    if (s !== undefined) frame[key] = s
  }
  frame.scheme = pickEnum(v, 'scheme', SCHEMES, path, errors)
  frame.layout = pickEnum(v, 'layout', ['centered', 'document'] as const, path, errors)
  frame.align = pickEnum(v, 'align', ['left', 'center'] as const, path, errors)
  frame.headerRule = pickEnum(v, 'headerRule', ['accent', 'bar', 'none'] as const, path, errors)
  if (v.padding !== undefined) {
    if (Array.isArray(v.padding) && v.padding.length === 4 && v.padding.every(isNumber)) frame.padding = v.padding as FrameSpec['padding']
    else errors.push(`${path}.padding must be four numbers: top, right, bottom, left`)
  }
  for (const key of ['maxWidth', 'gap'] as const) {
    if (v[key] === undefined) continue
    if (isNumber(v[key])) frame[key] = v[key] as number
    else errors.push(`${path}.${key} must be a number`)
  }
  if (v.footerRule !== undefined) frame.footerRule = v.footerRule === true
  const logo = parsePlacement(v.logo, `${path}.logo`, errors)
  if (logo !== undefined) frame.logo = logo
  if (v.footerText !== undefined) {
    const placement = parsePlacement(v.footerText, `${path}.footerText`, errors)
    if (placement === null) frame.footerText = null
    else if (placement && isObject(v.footerText)) {
      frame.footerText = { ...placement, color: isString(v.footerText.color) ? v.footerText.color : undefined, size: isNumber(v.footerText.size) ? v.footerText.size : undefined }
    }
  }
  if (isObject(v.title)) frame.title = { size: isNumber(v.title.size) ? v.title.size : undefined, color: isString(v.title.color) ? v.title.color : undefined }
  if (isObject(v.subtitle)) {
    frame.subtitle = {
      variant: v.subtitle.variant === 'subheadline' ? 'subheadline' : v.subtitle.variant === 'eyebrow' ? 'eyebrow' : undefined,
      color: isString(v.subtitle.color) ? v.subtitle.color : undefined,
    }
  }
  return frame
}

/** Validate a theme.json value. Invalid fields are dropped and reported; the rest is kept. */
export function parseThemeSpec(raw: unknown): ParsedTheme {
  const errors: string[] = []
  if (!isObject(raw)) return { spec: null, errors: ['theme.json must contain an object'] }
  if (!isString(raw.name) || raw.name.trim() === '') errors.push('"name" is required')
  const spec: ThemeSpec = { name: isString(raw.name) ? raw.name : 'Untitled theme' }
  const description = pickString(raw, 'description', 'theme', errors)
  if (description) spec.description = description
  const ext = pickString(raw, 'extends', 'theme', errors)
  if (ext) spec.extends = ext

  if (raw.tokens !== undefined) {
    if (!isObject(raw.tokens)) errors.push('tokens must be an object')
    else {
      const t = raw.tokens
      spec.tokens = {}
      if (isObject(t.accents)) {
        spec.tokens.accents = {}
        for (const [key, value] of Object.entries(t.accents)) {
          if (!(ACCENT_TOKENS as readonly string[]).includes(key)) errors.push(`tokens.accents.${key} is not a known accent (${ACCENT_TOKENS.join(', ')})`)
          else if (!isString(value)) errors.push(`tokens.accents.${key} must be a colour string`)
          else spec.tokens.accents[key as AccentToken] = value
        }
      }
      for (const scheme of SCHEMES) {
        const s = t[scheme]
        if (s === undefined) continue
        if (!isObject(s)) {
          errors.push(`tokens.${scheme} must be an object`)
          continue
        }
        spec.tokens[scheme] = {}
        for (const key of ['bg', 'text', 'muted'] as const) {
          const value = pickString(s, key, `tokens.${scheme}`, errors)
          if (value) spec.tokens[scheme]![key] = value
        }
      }
      for (const key of ['ink', 'bar'] as const) {
        const value = pickString(t, key, 'tokens', errors)
        if (value) spec.tokens[key] = value
      }
    }
  }

  if (isObject(raw.fonts)) {
    spec.fonts = {}
    const display = parseFont(raw.fonts.display, 'fonts.display', errors)
    const body = parseFont(raw.fonts.body, 'fonts.body', errors)
    if (display) spec.fonts.display = display
    if (body) spec.fonts.body = body
  }

  if (isObject(raw.logos)) {
    spec.logos = {}
    for (const key of ['onDark', 'onLight'] as const) {
      const value = raw.logos[key]
      if (value === null || isString(value)) spec.logos[key] = value
      else if (value !== undefined) errors.push(`logos.${key} must be a path or null`)
    }
  }
  const logo = parsePlacement(raw.logo, 'logo', errors)
  if (logo !== undefined) spec.logo = logo

  if (isObject(raw.footer)) {
    spec.footer = {}
    if (raw.footer.text === null || isString(raw.footer.text)) spec.footer.text = raw.footer.text
    if (raw.footer.rule !== undefined) spec.footer.rule = raw.footer.rule === true
  }

  if (raw.frames !== undefined) {
    if (!isObject(raw.frames)) errors.push('frames must be an object')
    else {
      spec.frames = {}
      for (const [name, value] of Object.entries(raw.frames)) {
        if (!THEME_ID_RE.test(name) || name === 'none') {
          errors.push(`frames.${name}: frame names are lower-case letters, digits and dashes, and not "none"`)
          continue
        }
        const frame = parseFrame(value, `frames.${name}`, errors)
        if (frame) spec.frames[name] = frame
      }
    }
  }

  if (isObject(raw.defaults)) {
    const d = raw.defaults
    spec.defaults = {
      scheme: pickEnum(d, 'scheme', SCHEMES, 'defaults', errors),
      accent: pickEnum(d, 'accent', ['yellow', 'red', 'teal', 'navy'] as const, 'defaults', errors),
      transition: pickString(d, 'transition', 'defaults', errors),
      layout: pickEnum(d, 'layout', ['centered', 'document'] as const, 'defaults', errors),
      frame: pickString(d, 'frame', 'defaults', errors),
    }
  }

  if (isObject(raw.constraints)) {
    const c = raw.constraints
    spec.constraints = {}
    if (c.schemes !== undefined) {
      if (Array.isArray(c.schemes) && c.schemes.length > 0 && c.schemes.every((s) => (SCHEMES as readonly unknown[]).includes(s))) spec.constraints.schemes = c.schemes as Scheme[]
      else errors.push('constraints.schemes must be a non-empty list of "dark" and/or "light"')
    }
    if (c.gradients !== undefined) spec.constraints.gradients = c.gradients !== false
  }

  return { spec, errors }
}

const stripUndefined = <T extends object>(o: T): T => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T

/** `override` on top of `base`: objects merge key by key, frames merge per frame, scalars replace. */
export function mergeThemeSpecs(base: ThemeSpec, override: ThemeSpec): ThemeSpec {
  const frames: Record<string, FrameSpec> = { ...(base.frames ?? {}) }
  for (const [name, frame] of Object.entries(override.frames ?? {})) frames[name] = { ...(frames[name] ?? {}), ...stripUndefined(frame) }
  return {
    ...base,
    ...stripUndefined({ name: override.name, description: override.description }),
    extends: undefined,
    tokens: {
      ...base.tokens,
      ...stripUndefined(override.tokens ?? {}),
      accents: { ...base.tokens?.accents, ...stripUndefined(override.tokens?.accents ?? {}) },
      dark: { ...base.tokens?.dark, ...stripUndefined(override.tokens?.dark ?? {}) },
      light: { ...base.tokens?.light, ...stripUndefined(override.tokens?.light ?? {}) },
    },
    fonts: { ...base.fonts, ...stripUndefined(override.fonts ?? {}) },
    logos: { ...base.logos, ...stripUndefined(override.logos ?? {}) },
    logo: override.logo !== undefined ? override.logo : base.logo,
    footer: { ...base.footer, ...stripUndefined(override.footer ?? {}) },
    frames,
    defaults: { ...base.defaults, ...stripUndefined(override.defaults ?? {}) },
    constraints: { ...base.constraints, ...stripUndefined(override.constraints ?? {}) },
  }
}
