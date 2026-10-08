/**
 * Runtime deck compilation (Part 1 §14.2): fetch the MDX from the server and compile it in the
 * browser. Used for every deck that Vite did not bundle (external content folders, folder mode,
 * the release binary). Such decks may import only from '@components' and relative asset files.
 */
import type { ComponentType } from 'react'
import * as jsxRuntime from 'react/jsx-runtime'
import { compile, run } from '@mdx-js/mdx'
import { BUILT_IN_SOURCE_ID, deckName, type DeckRef } from '@shared/decks.ts'
import { stripMdxFrontmatter } from '@shared/frontmatter.ts'
import { contentAssetUrl, rewriteDeckImports, sourceContentAssetUrl } from '@shared/mdxImports.ts'
import { fetchDeckSource } from './api'
import { appPath } from './basePath'
import { mdxComponentScope } from './components/mdxScope'
import { DeckNotFoundError } from './deckLoading'
import type { DeckModule } from './deckTypes'

export async function compileDeck(deck: DeckRef, source: string, defaultSource = BUILT_IN_SOURCE_ID): Promise<ComponentType> {
  const compiled = await compile(stripMdxFrontmatter(source), {
    outputFormat: 'function-body',
    development: false,
    remarkPlugins: [
      [
        rewriteDeckImports,
        {
          deckName: deckName(deck),
          knownComponents: Object.keys(mdxComponentScope),
          resolveAsset: (_name: string, asset: string) =>
            appPath(deck.source === defaultSource ? contentAssetUrl(deck.path, asset) : sourceContentAssetUrl(deck.source, deck.path, asset)),
        },
      ],
    ],
  })
  const { default: Raw } = await run(compiled, { ...(jsxRuntime as Parameters<typeof run>[1]), baseUrl: import.meta.url })
  const Deck = (props: Record<string, unknown>) => <Raw components={mdxComponentScope} {...props} />
  return Deck
}

export async function loadDeck(deck: DeckRef, defaultSource?: string): Promise<DeckModule> {
  const result = await fetchDeckSource(deck)
  if (result.status === 404) throw new DeckNotFoundError(deck)
  if (!result.data) throw new Error(result.error ?? 'Could not load the presentation')
  return { default: (await compileDeck(deck, result.data.content, defaultSource)) as DeckModule['default'] }
}
