import { defineConfig, mergeConfig, type UserConfig } from 'vite'
import baseConfig from './vite.config.ts'

/**
 * Single-file export viewer: one IIFE plus one CSS file with every asset inlined
 * (Part 4 §8.1).
 */
export default defineConfig((env) => {
  const base = typeof baseConfig === 'function' ? baseConfig(env) : baseConfig
  const viewer: UserConfig = {
    publicDir: false,
    build: {
      outDir: 'dist/viewer',
      emptyOutDir: true,
      assetsInlineLimit: 50 * 1024 * 1024,
      cssCodeSplit: false,
      lib: {
        entry: 'src/exportViewer.tsx',
        formats: ['iife'],
        name: 'SlidecraftViewer',
        fileName: () => 'viewer.js',
        cssFileName: 'viewer',
      },
    },
    define: {
      'process.env.NODE_ENV': JSON.stringify('production'),
      // An IIFE has no import.meta; `new URL(asset, import.meta.url)` still needs a valid base.
      // The assets themselves are inlined as data URLs, so the base is never used to fetch.
      'import.meta.url': JSON.stringify('file:///slidecraft-viewer/'),
    },
  }
  return mergeConfig(base as UserConfig, viewer)
})
