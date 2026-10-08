import { createContext, useContext, useSyncExternalStore, type ReactNode } from 'react'
import { useDeck } from '../components/slides/deckContext'
import { DEFAULT_THEME_ID, getThemesVersion, resolveTheme, subscribeThemes, type ResolvedTheme } from './registry'
import { themeCssVars, useThemeFonts } from './themeStyle'

export const ThemeContext = createContext<ResolvedTheme>(resolveTheme(DEFAULT_THEME_ID))

export const useTheme = (): ResolvedTheme => useContext(ThemeContext)

/** Re-render when themes are registered (content-directory themes arrive asynchronously). */
export const useThemesVersion = (): number => useSyncExternalStore(subscribeThemes, getThemesVersion, getThemesVersion)

/** The named theme for the current deck's content source, or the surrounding theme. */
export function useResolvedTheme(id?: string): ResolvedTheme {
  const parent = useContext(ThemeContext)
  const { deck } = useDeck()
  useThemesVersion()
  return id ? resolveTheme(id, deck?.source) : parent
}

export interface ThemeScopeProps {
  theme?: string
  children?: ReactNode
}

/** Applies a theme to everything inside: context for components, CSS variables for styles. */
export function ThemeScope({ theme: id, children }: ThemeScopeProps) {
  const theme = useResolvedTheme(id)
  useThemeFonts(theme)
  return (
    <ThemeContext.Provider value={theme}>
      <div className="theme-scope" data-theme={theme.id} style={{ display: 'contents', ...themeCssVars(theme) }}>
        {children}
      </div>
    </ThemeContext.Provider>
  )
}
