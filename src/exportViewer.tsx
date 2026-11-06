/**
 * Entry of the single-file HTML export viewer (Part 4 §8.1). The page embeds the compiled deck,
 * its assets, content-folder themes and the vault components it uses as JSON; this renders them
 * with no server and no network.
 */
import './styles/global.css'
import { StrictMode, type ComponentType } from 'react'
import { createRoot } from 'react-dom/client'
import * as jsxRuntime from 'react/jsx-runtime'
import { MDXProvider } from '@mdx-js/react'
import type { MDXComponents } from 'mdx/types'
import { assetKey, PAYLOAD_ELEMENT_ID, type ExportedComponents, type ExportPayload } from '@shared/exportPayload.ts'
import { getMdxScope } from './components/mdxScope'
import { DeckContext } from './components/slides/deckContext'
import { setActiveVault } from './components/slides/defineComponent'
import { registerTheme } from './themes/registry'
import { loadFolder, registerFolders, type LoadedFolder } from './vault-api/loadComponents'
import { installVaultRuntime } from './vault-api/runtime'

const decodeBase64Utf8 = (b64: string) => new TextDecoder().decode(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)))

/**
 * The deck's vault components, registered under their vault as the app does, so one that is
 * missing or fails falls back to the built-in of its name or shows a placeholder. Each bundle is
 * a `data:` module whose bare imports the page's import map sends to the viewer's own modules.
 */
async function registerComponents(exported: ExportedComponents): Promise<void> {
  installVaultRuntime()
  const folders: LoadedFolder[] = []
  // One at a time: each runs inside the registry's capture of what it defines.
  for (const folder of exported.folders) {
    if (folder.code === undefined) folders.push({ name: folder.name, hash: 'export', components: [], error: folder.error })
    else folders.push(await loadFolder(folder.name, 'export', () => import(/* @vite-ignore */ `data:text/javascript;base64,${folder.code}`)))
  }
  registerFolders(exported.vault, folders)
  setActiveVault(exported.vault)
}

async function start() {
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
    if (payload.components) await registerComponents(payload.components)
    const scope = getMdxScope(payload.components?.vault ?? null) as MDXComponents
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

void start()
