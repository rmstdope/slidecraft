/**
 * Deck import rewriting (Part 1 §13.5, Part 4 §7.5): a remark plugin that lets a deck run
 * without a bundler. Used by the browser runtime loader and the server exporter, not by Vite.
 *
 * - `import { X } from '@components'` is removed; components come from the MDX scope.
 * - `import pic from './pic.png'` becomes `const pic = "<resolved url>"`.
 * - anything else throws, or is kept when `unsupported: 'keep'`.
 */
import type { ImportDeclaration, Program, VariableDeclaration } from 'estree'
import type { Root, RootContent } from 'mdast'
import type {} from 'mdast-util-mdxjs-esm'

export const ASSET_IMPORT_RE = /\.(svg|png|jpe?g|gif|webp|avif|mp4|webm|mp3|wav|pdf)$/i
export const COMPONENTS_MODULE = '@components'

export class DeckImportError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DeckImportError'
  }
}

export interface RewriteDeckImportsOptions {
  deckName: string
  resolveAsset: (deckName: string, source: string) => string
  /** When given, importing an unknown name from '@components' throws. */
  knownComponents?: readonly string[]
  unsupported?: 'throw' | 'keep'
}

/** Normalise a deck-relative asset path ('./images/a.png' → 'images/a.png'). Throws when it escapes the deck. */
export function resolveDeckRelative(asset: string): string {
  const out: string[] = []
  for (const segment of asset.replace(/\\/g, '/').split('/')) {
    if (segment === '' || segment === '.') continue
    if (segment === '..') {
      if (out.length === 0) throw new DeckImportError(`Asset "${asset}" points outside the presentation folder`)
      out.pop()
    } else out.push(segment)
  }
  return out.join('/')
}

const encodePath = (path: string) => path.split('/').map(encodeURIComponent).join('/')

/** `/content/<deck>/<asset>`: an asset of a deck in the default content source. */
export function contentAssetUrl(deckPath: string, asset: string): string {
  return `/content/${encodePath(deckPath)}/${encodePath(resolveDeckRelative(asset))}`
}

/** `/content-source/<id>/<deckPath>/<asset>`: an asset of a deck in any mounted source. */
export function sourceContentAssetUrl(sourceId: string, deckPath: string, asset: string): string {
  return `/content-source/${encodeURIComponent(sourceId)}/${encodePath(deckPath)}/${encodePath(resolveDeckRelative(asset))}`
}

const isRelative = (source: string) => source.startsWith('./') || source.startsWith('../')

function rewriteImport(node: ImportDeclaration, options: RewriteDeckImportsOptions): VariableDeclaration | null | 'keep' {
  const source = String(node.source.value)

  if (source === COMPONENTS_MODULE) {
    if (options.knownComponents) {
      const known = new Set(options.knownComponents)
      for (const specifier of node.specifiers) {
        const name = specifier.type === 'ImportSpecifier' && specifier.imported.type === 'Identifier' ? specifier.imported.name : specifier.local.name
        if (specifier.type !== 'ImportSpecifier' || !known.has(name)) {
          throw new DeckImportError(`Presentation "${options.deckName}" imports "${name}" from '${COMPONENTS_MODULE}', but no such component exists.`)
        }
      }
    }
    return null
  }

  if (isRelative(source) && ASSET_IMPORT_RE.test(source)) {
    const specifier = node.specifiers[0]
    if (node.specifiers.length !== 1 || specifier.type !== 'ImportDefaultSpecifier') {
      throw new DeckImportError(`Import the file "${source}" with a default import, e.g. import pic from '${source}'`)
    }
    const url = options.resolveAsset(options.deckName, source)
    return {
      type: 'VariableDeclaration',
      kind: 'const',
      declarations: [
        {
          type: 'VariableDeclarator',
          id: { type: 'Identifier', name: specifier.local.name },
          init: { type: 'Literal', value: url, raw: JSON.stringify(url) },
        },
      ],
    }
  }

  if (options.unsupported === 'keep') return 'keep'
  throw new DeckImportError(
    `Cannot import "${source}" in presentation "${options.deckName}": decks can only import from '${COMPONENTS_MODULE}' and relative image files.`,
  )
}

export function rewriteDeckImports(options: RewriteDeckImportsOptions) {
  return (tree: Root): void => {
    const children: RootContent[] = []
    for (const node of tree.children) {
      if (node.type !== 'mdxjsEsm' || !node.data?.estree) {
        children.push(node)
        continue
      }
      const program: Program = node.data.estree
      const body: Program['body'] = []
      for (const statement of program.body) {
        if (statement.type !== 'ImportDeclaration') {
          body.push(statement)
          continue
        }
        const replacement = rewriteImport(statement, options)
        if (replacement === 'keep') body.push(statement)
        else if (replacement) body.push(replacement)
      }
      program.body = body
      if (body.length > 0) children.push(node)
    }
    tree.children = children
  }
}
