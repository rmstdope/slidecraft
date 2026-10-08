/**
 * Single-file HTML export (Part 4 §8.2): the deck compiled on the server, every asset and
 * content-folder theme it uses as data URLs, and the prebuilt viewer, in one offline HTML file.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { compile } from '@mdx-js/mdx'
import { deckName, type DeckRef } from '../../shared/decks.ts'
import { assetKey, mimeType, PAYLOAD_ELEMENT_ID, type ExportedTheme, type ExportPayload } from '../../shared/exportPayload.ts'
import { stripMdxFrontmatter } from '../../shared/frontmatter.ts'
import { ASSET_IMPORT_RE, DeckImportError, resolveDeckRelative, rewriteDeckImports } from '../../shared/mdxImports.ts'
import { readAppBytes, readAppText } from './appFiles.ts'
import { resolveDeckFile, resolveDeckRefInSources, type ResolvedDeck } from './decks.ts'
import { readDeckSource } from './deckStore.ts'
import { discoverThemes, THEMES_DIR } from './themes.ts'

export class ExportError extends Error {
  constructor(
    message: string,
    readonly status = 500,
  ) {
    super(message)
  }
}

const dataUrl = (file: string): string => `data:${mimeType(file)};base64,${readFileSync(file).toString('base64')}`
const PLACEHOLDER = (n: number) => `__SLIDECRAFT_ASSET_${n}__`

/** Deck-relative media paths written as string props: `src="images/a.png"`. */
const STRING_ASSET_RE = /(["'`])((?:\.\/)?[\w.-][\w./ -]*\.(?:png|jpe?g|gif|webp|avif|svg|mp4|webm|mp3|wav))\1/gi

let viewerCache: { js: string; css: string } | null = null
export const resetViewerCache = () => {
  viewerCache = null
}

/** The prebuilt viewer, with references to the app's own public images (logos) inlined. */
function loadViewer(): { js: string; css: string } {
  if (viewerCache) return viewerCache
  let js = readAppText('dist/viewer/viewer.js')
  const css = readAppText('dist/viewer/viewer.css') ?? ''
  if (!js) throw new ExportError('Export viewer not built. Run "bun run build" first.')
  js = js.replace(/([`"'])\/([\w.-]+\.(?:svg|png|jpe?g|gif|webp|avif))\1/g, (literal, quote: string, name: string) => {
    const bytes = readAppBytes(`dist/${name}`) ?? readAppBytes(`public/${name}`)
    return bytes ? `${quote}data:${mimeType(name)};base64,${bytes.toString('base64')}${quote}` : literal
  })
  viewerCache = { js, css }
  return viewerCache
}

function filesUnder(dir: string): string[] {
  const out: string[] = []
  const walk = (d: string) => {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      if (entry.name.startsWith('.')) continue
      const full = join(d, entry.name)
      if (entry.isDirectory()) walk(full)
      else out.push(full)
    }
  }
  if (existsSync(dir)) walk(dir)
  return out
}

/** Content-folder themes the deck names (on Presentation or any Slide), with what they extend. */
function exportedThemes(resolved: ResolvedDeck, source: string): ExportedTheme[] {
  const available = new Map(discoverThemes(resolved.source).map((t) => [t.id, t]))
  const wanted = new Set([...source.matchAll(/\btheme=["']([a-z0-9-]+)["']/g)].map((m) => m[1]))
  const out: ExportedTheme[] = []
  const seen = new Set<string>()
  const add = (id: string) => {
    const theme = available.get(id)
    if (!theme || seen.has(id) || !theme.raw) return
    seen.add(id)
    const dir = join(resolved.source.path, THEMES_DIR, id)
    const assets: Record<string, string> = {}
    for (const file of filesUnder(dir)) {
      if (file === join(dir, 'theme.json') || statSync(file).size > 20 * 1024 * 1024) continue
      assets[relative(dir, file).split(sep).join('/')] = dataUrl(file)
    }
    out.push({ id, source: resolved.source.id, raw: theme.raw, assets })
    const parent = (theme.raw as { extends?: unknown }).extends
    if (typeof parent === 'string') add(parent)
  }
  wanted.forEach(add)
  return out
}

const toBase64 = (text: string) => Buffer.from(text, 'utf8').toString('base64')
const escapeHtml = (text: string) => text.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)

export interface ExportOptions {
  /** Viewer code and CSS; the prebuilt `dist/viewer` files by default. */
  viewer?: { js: string; css: string }
}

export async function exportDeck(ref: DeckRef, options: ExportOptions = {}): Promise<{ html: string; name: string }> {
  const name = deckName(ref)
  const resolved = resolveDeckRefInSources(ref)
  const mdx = resolved ? await readDeckSource(resolved) : null
  if (!resolved || mdx === null) throw new ExportError(`Presentation "${name}" not found`, 404)

  // 1. Compile, with imported assets as placeholders (the remark plugin is synchronous).
  const imported: string[] = []
  let code: string
  try {
    const compiled = await compile(stripMdxFrontmatter(mdx), {
      outputFormat: 'function-body',
      development: false,
      remarkPlugins: [
        [
          rewriteDeckImports,
          {
            deckName: name,
            resolveAsset: (_deck: string, asset: string) => {
              const file = resolveDeckFile(resolved, resolveDeckRelative(asset))
              if (!file || !existsSync(file)) throw new DeckImportError(`The presentation imports "${asset}" but the file does not exist`)
              imported.push(file)
              return PLACEHOLDER(imported.length - 1)
            },
          },
        ],
      ],
    })
    code = String(compiled)
  } catch (error) {
    throw new ExportError(`Could not compile "${name}": ${(error as Error).message}`)
  }
  imported.forEach((file, i) => {
    code = code.split(PLACEHOLDER(i)).join(dataUrl(file))
  })

  // 2. String props that name files in the deck folder.
  const assets: Record<string, string> = {}
  for (const match of code.matchAll(STRING_ASSET_RE)) {
    const key = assetKey(match[2], name)
    if (assets[key] || key.startsWith('data:')) continue
    let file: string | null = null
    try {
      file = resolveDeckFile(resolved, resolveDeckRelative(key))
    } catch {
      continue
    }
    if (file && existsSync(file) && statSync(file).isFile() && ASSET_IMPORT_RE.test(file)) assets[key] = dataUrl(file)
  }

  // 3. Payload and viewer in one HTML file. The payload is JSON with "<" escaped; the viewer is
  // base64, so no deck text or library code can end the script element early.
  const payload: ExportPayload = { name, deck: ref, code: toBase64(code), assets, themes: exportedThemes(resolved, mdx) }
  const json = JSON.stringify(payload).replace(/</g, '\\u003c')
  const viewer = options.viewer ?? loadViewer()
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(name)}</title>
<style>${viewer.css.replace(/<\/style/gi, '<\\/style')}</style>
</head>
<body>
<div id="root"></div>
<script type="application/json" id="${PAYLOAD_ELEMENT_ID}">${json}</script>
<script>(function(){var b=atob('${toBase64(viewer.js)}');var u=new Uint8Array(b.length);for(var i=0;i<b.length;i++)u[i]=b.charCodeAt(i);var s=document.createElement('script');s.textContent=new TextDecoder().decode(u);document.body.appendChild(s)})()</script>
</body>
</html>
`
  return { html, name }
}
