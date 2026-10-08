/**
 * Entry of the single-file HTML export viewer (Part 4 §8.1). The page embeds the compiled deck,
 * its assets and content-folder themes as JSON; this renders them with no server and no network.
 */
import './styles/global.css'
import { StrictMode, type ComponentType } from 'react'
import { createRoot } from 'react-dom/client'
import * as jsxRuntime from 'react/jsx-runtime'
import { MDXProvider } from '@mdx-js/react'
import type { MDXComponents } from 'mdx/types'
import { assetKey, PAYLOAD_ELEMENT_ID, type ExportPayload } from '@shared/exportPayload.ts'
import { mdxComponentScope } from './components/mdxScope'
import { DeckContext } from './components/slides/deckContext'
import { registerTheme } from './themes/registry'

const decodeBase64Utf8 = (b64: string) => new TextDecoder().decode(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)))

function start() {
  const root = document.getElementById('root')
  if (!root) return
  try {
    const element = document.getElementById(PAYLOAD_ELEMENT_ID)
    if (!element?.textContent) throw new Error('This file contains no presentation.')
    const payload = JSON.parse(element.textContent) as ExportPayload
    for (const theme of payload.themes) registerTheme({ id: theme.id, source: theme.source, raw: theme.raw, baseUrl: '/', assets: theme.assets })

    // The compiled MDX is a function body that takes the JSX runtime (what @mdx-js/mdx `run` does).
    const body = decodeBase64Utf8(payload.code)
    const { default: Content } = new Function(body)({ ...jsxRuntime, baseUrl: document.baseURI }) as { default: ComponentType<{ components?: MDXComponents }> }
    const resolveAsset = (src: string) => (!src || /^(data:|blob:|https?:)/i.test(src) ? src : (payload.assets[assetKey(src, payload.name)] ?? src))
    const scope = mdxComponentScope as MDXComponents
    document.title = payload.name

    createRoot(root).render(
      <StrictMode>
        <DeckContext.Provider value={{ deck: payload.deck, resolveAsset }}>
          <MDXProvider components={scope}>
            <Content components={scope} />
          </MDXProvider>
        </DeckContext.Provider>
      </StrictMode>,
    )
  } catch (error) {
    const pre = document.createElement('pre')
    pre.style.cssText = 'padding:2rem;color:#e0452b;white-space:pre-wrap;font:14px ui-monospace,monospace'
    pre.textContent = `Could not open this presentation:\n${error instanceof Error ? error.stack || error.message : String(error)}`
    root.replaceChildren(pre)
  }
}

start()
