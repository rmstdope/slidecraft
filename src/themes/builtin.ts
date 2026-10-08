import corporate from './builtin/corporate/theme.json'
import paper from './builtin/paper/theme.json'
import slidecraft from './builtin/slidecraft/theme.json'

export interface BuiltinTheme {
  id: string
  raw: unknown
  /** Theme-relative asset path → URL, resolved by the bundler (inlined in the export viewer). */
  assets: Record<string, string>
}

/** Themes that ship with the app. They use the same folder format as content-directory themes. */
export const BUILTIN_THEMES: BuiltinTheme[] = [
  { id: 'slidecraft', raw: slidecraft, assets: {} },
  {
    id: 'corporate',
    raw: corporate,
    assets: {
      'frames/title.svg': new URL('./builtin/corporate/frames/title.svg', import.meta.url).href,
      'frames/section.svg': new URL('./builtin/corporate/frames/section.svg', import.meta.url).href,
      'frames/content.svg': new URL('./builtin/corporate/frames/content.svg', import.meta.url).href,
    },
  },
  { id: 'paper', raw: paper, assets: {} },
]
