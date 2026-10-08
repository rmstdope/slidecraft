import { defineConfig, mergeConfig, type UserConfig } from 'vite'
import baseConfig from './vite.config.ts'

/**
 * Single-file export viewer: one IIFE plus one CSS file with every asset inlined
 * (Part 4 §8.1). The entry is a stub until Phase 9.
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
    define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  }
  return mergeConfig(base as UserConfig, viewer)
})
