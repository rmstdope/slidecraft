/** Theme folders in content directories: `<source>/themes/<id>/theme.json` (plan Phase 4b). */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseThemeSpec, THEME_ID_RE } from '../../shared/themes.ts'
import type { ContentSource } from './contentSources.ts'

export interface ContentTheme {
  id: string
  source: string
  /** The theme.json value as written; the client registers and resolves it. */
  raw: unknown
  /** Validation problems, for the editor and for agents. */
  errors: string[]
  /** URL of the theme folder. */
  baseUrl: string
}

export const THEMES_DIR = 'themes'

export const themeBaseUrl = (sourceId: string, themeId: string) =>
  `/content-source/${encodeURIComponent(sourceId)}/${THEMES_DIR}/${encodeURIComponent(themeId)}/`

export function discoverThemes(source: ContentSource): ContentTheme[] {
  const dir = join(source.path, THEMES_DIR)
  if (!existsSync(dir)) return []
  const themes: ContentTheme[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue
    const file = join(dir, entry.name, 'theme.json')
    if (!existsSync(file)) continue
    const id = entry.name
    let raw: unknown = null
    const errors: string[] = []
    if (!THEME_ID_RE.test(id)) errors.push(`Theme folder "${id}" must be lower-case letters, digits and dashes`)
    try {
      raw = JSON.parse(readFileSync(file, 'utf8'))
      errors.push(...parseThemeSpec(raw).errors)
    } catch (error) {
      errors.push(`theme.json is not valid JSON: ${(error as Error).message}`)
    }
    themes.push({ id, source: source.id, raw, errors, baseUrl: themeBaseUrl(source.id, id) })
  }
  return themes.sort((a, b) => a.id.localeCompare(b.id))
}
