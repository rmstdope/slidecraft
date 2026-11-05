/**
 * The app's appearance (docs/plans/ui-redesign-plan.md): light, dark or following the system, and
 * the accent used in dark mode. Stored per person in the browser, never in config.json. The tokens
 * themselves are CSS (src/styles/app.css); this module only sets the two attributes they key on.
 *
 * index.html repeats `readAppearance` plus `applyAppearance` as an inline script so the first paint
 * already has the right theme; tests/appearance.test.ts keeps the two in step.
 */

export type ThemeChoice = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'

export const DARK_ACCENTS = [
  { id: 'violet', label: 'Violet', value: '#9b8afb' },
  { id: 'indigo', label: 'Indigo', value: '#818cf8' },
  { id: 'coral', label: 'Coral', value: '#ff8a65' },
  { id: 'mint', label: 'Mint', value: '#5eead4' },
] as const

export type DarkAccent = (typeof DARK_ACCENTS)[number]['id']

export interface Appearance {
  theme: ThemeChoice
  darkAccent: DarkAccent
}

export const APPEARANCE_STORAGE_KEY = 'slidecraft.appearance'
export const DEFAULT_APPEARANCE: Appearance = { theme: 'system', darkAccent: 'violet' }
export const DARK_QUERY = '(prefers-color-scheme: dark)'

const THEMES: readonly ThemeChoice[] = ['light', 'dark', 'system']
const isAccent = (v: unknown): v is DarkAccent => DARK_ACCENTS.some((a) => a.id === v)

/** A stored value, or the defaults for anything missing, unknown or unreadable. */
export function parseAppearance(raw: string | null | undefined): Appearance {
  let value: unknown
  try {
    value = raw ? JSON.parse(raw) : {}
  } catch {
    value = {}
  }
  const v = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>
  return {
    theme: THEMES.includes(v.theme as ThemeChoice) ? (v.theme as ThemeChoice) : DEFAULT_APPEARANCE.theme,
    darkAccent: isAccent(v.darkAccent) ? v.darkAccent : DEFAULT_APPEARANCE.darkAccent,
  }
}

export const resolveTheme = (choice: ThemeChoice, systemDark: boolean): ResolvedTheme =>
  choice === 'system' ? (systemDark ? 'dark' : 'light') : choice

/** Sets `data-sc-theme` and `data-sc-accent` on the root element. */
export function applyAppearance(root: HTMLElement, appearance: Appearance, systemDark: boolean): ResolvedTheme {
  const theme = resolveTheme(appearance.theme, systemDark)
  root.dataset.scTheme = theme
  root.dataset.scAccent = appearance.darkAccent
  return theme
}

/** Reads storage, never throws: a blocked localStorage means the defaults. */
export function readAppearance(storage: Pick<Storage, 'getItem'> | undefined = safeStorage()): Appearance {
  try {
    return parseAppearance(storage?.getItem(APPEARANCE_STORAGE_KEY))
  } catch {
    return { ...DEFAULT_APPEARANCE }
  }
}

/** Writes storage; returns false when the browser refuses (private mode, blocked site data). */
export function writeAppearance(appearance: Appearance, storage: Pick<Storage, 'setItem'> | undefined = safeStorage()): boolean {
  try {
    if (!storage) return false
    storage.setItem(APPEARANCE_STORAGE_KEY, JSON.stringify(appearance))
    return true
  } catch {
    return false
  }
}

function safeStorage(): Storage | undefined {
  try {
    return typeof localStorage === 'undefined' ? undefined : localStorage
  } catch {
    return undefined
  }
}
