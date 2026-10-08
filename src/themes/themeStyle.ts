import { useEffect, type CSSProperties } from 'react'
import type { ThemeFont } from '@shared/themes.ts'
import type { ResolvedTheme } from './registry'

const sanitize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-')

/** Fonts with files load under a theme-private family name, so two themes never collide. */
export function fontFamilyName(theme: ResolvedTheme, role: 'display' | 'body'): string | undefined {
  const font = theme.spec.fonts?.[role]
  if (!font) return undefined
  return font.files?.length ? `st-${sanitize(theme.key)}-${role}` : font.family
}

const stack = (theme: ResolvedTheme, role: 'display' | 'body', font: ThemeFont | undefined) => {
  const name = fontFamilyName(theme, role)
  return name ? `'${name}'${font?.fallback ? `, ${font.fallback}` : ''}` : undefined
}

/**
 * The theme's tokens as CSS custom properties, set on a deck or slide root. Components only read
 * these variables, so differently themed decks render side by side (e.g. home-page thumbnails).
 */
export function themeCssVars(theme: ResolvedTheme): CSSProperties {
  const t = theme.spec.tokens ?? {}
  const a = t.accents ?? {}
  const vars: Record<string, string | undefined> = {
    '--brand-yellow': a.yellow,
    '--brand-red': a.red,
    '--accent-teal': a.teal,
    '--accent-navy-base': a.navy,
    '--accent-navy-light': a.navyOnDark,
    '--accent-gray': a.gray,
    '--dark-bg': t.dark?.bg,
    '--dark-text': t.dark?.text,
    '--dark-muted': t.dark?.muted,
    '--light-bg': t.light?.bg,
    '--light-text': t.light?.text,
    '--light-muted': t.light?.muted,
    '--ink': t.ink,
    '--theme-bar': t.bar,
    '--font-display': stack(theme, 'display', theme.spec.fonts?.display),
    '--font-body': stack(theme, 'body', theme.spec.fonts?.body),
  }
  return Object.fromEntries(Object.entries(vars).filter(([, v]) => v !== undefined)) as CSSProperties
}

export function fontFaceCss(theme: ResolvedTheme): string {
  const rules: string[] = []
  for (const role of ['display', 'body'] as const) {
    const font = theme.spec.fonts?.[role]
    const family = fontFamilyName(theme, role)
    for (const file of font?.files ?? []) {
      rules.push(`@font-face { font-family: '${family}'; src: url("${file.src}"); font-weight: ${file.weight ?? 'normal'}; font-style: ${file.style ?? 'normal'}; font-display: swap; }`)
    }
  }
  return rules.join('\n')
}

/** Inject the theme's @font-face rules once per document. */
export function ensureThemeFonts(theme: ResolvedTheme): void {
  if (typeof document === 'undefined') return
  const css = fontFaceCss(theme)
  if (!css || document.head.querySelector(`style[data-theme-fonts="${theme.key}"]`)) return
  const style = document.createElement('style')
  style.dataset.themeFonts = theme.key
  style.textContent = css
  document.head.appendChild(style)
}

export function useThemeFonts(theme: ResolvedTheme): void {
  useEffect(() => ensureThemeFonts(theme), [theme])
}
