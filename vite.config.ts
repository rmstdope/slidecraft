import { fileURLToPath } from 'node:url'
import mdx from '@mdx-js/rollup'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import { stripMdxFrontmatter } from './shared/frontmatter.ts'
import { API_URL, CLIENT_PORT } from './shared/ports.ts'

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url))

/** Strip YAML frontmatter from .mdx modules before MDX sees them (Part 1 §13.4). */
function stripFrontmatterPlugin(): Plugin {
  return {
    name: 'slidecraft:strip-mdx-frontmatter',
    enforce: 'pre',
    transform(code, id) {
      if (!id.split('?')[0].endsWith('.mdx')) return null
      const body = stripMdxFrontmatter(code)
      return body === code ? null : { code: body, map: null }
    },
  }
}

/** Requests for modules Vite must compile itself; everything else under /content goes to the API. */
const isModuleRequest = (url = '') => /\.(mdx|tsx?|jsx)(\?|$)/.test(url) || /[?&]import\b/.test(url)

export default defineConfig(({ command }) => {
  // Decks under content/ are bundled (HMR, local .tsx imports) in dev, or on request for the static site.
  const bundleContent = command === 'serve' || process.env.SLIDECRAFT_BUNDLE_CONTENT === '1'

  return {
    base: process.env.VITE_BASE ?? '/',
    plugins: [
      stripFrontmatterPlugin(),
      { enforce: 'pre', ...mdx({ providerImportSource: '@mdx-js/react' }) },
      react({ include: /\.(mdx|js|jsx|ts|tsx)$/ }),
    ],
    resolve: {
      dedupe: ['react', 'react-dom'],
      alias: [
        ...(bundleContent ? [] : [{ find: /^(?:\.\/|@\/)bundledDecks$/, replacement: r('./src/bundledDecks.empty.ts') }]),
        { find: /^@components$/, replacement: r('./src/components/index.ts') },
        { find: /^@components\//, replacement: r('./src/components') + '/' },
        { find: /^@content\//, replacement: r('./content') + '/' },
        { find: /^@shared\//, replacement: r('./shared') + '/' },
        { find: /^@\//, replacement: r('./src') + '/' },
      ],
    },
    server: {
      // Some macOS setups deliver no events to directory watchers when an existing file changes,
      // which leaves Vite serving stale modules. SLIDECRAFT_WATCH_POLLING=1 switches to polling.
      watch: process.env.SLIDECRAFT_WATCH_POLLING === '1' ? { usePolling: true, interval: 200 } : undefined,
      port: CLIENT_PORT,
      strictPort: true, // never move to another port: a running server is reused instead (Part 4 §10.2)
      proxy: {
        '/api': { target: API_URL, changeOrigin: true },
        '/content-source': { target: API_URL, changeOrigin: true },
        '/images/library': { target: API_URL, changeOrigin: true },
        '/content': {
          target: API_URL,
          changeOrigin: true,
          bypass: (req) => (isModuleRequest(req.url) ? req.url : undefined),
        },
      },
    },
  }
})
