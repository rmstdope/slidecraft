/**
 * Monaco from the local package (no CDN), so the editor works offline and in the binary. Only the
 * base editor worker is needed: the `mdx` language runs on the main thread.
 */
import { loader } from '@monaco-editor/react'
import * as monaco from './monacoCore'
import EditorWorker from './monacoWorker.ts?worker'

self.MonacoEnvironment = { getWorker: () => new EditorWorker() }
loader.config({ monaco: monaco as unknown as Parameters<typeof loader.config>[0]['monaco'] })

/** Editor themes that sit on the app's panels (src/styles/app.css), one per app theme. */
export const MONACO_THEMES = { light: 'slidecraft-light', dark: 'slidecraft-dark' } as const
monaco.editor.defineTheme(MONACO_THEMES.light, {
  base: 'vs',
  inherit: true,
  rules: [],
  colors: {
    'editor.background': '#ffffff',
    'editorGutter.background': '#ffffff',
    'editor.lineHighlightBackground': '#f7f7f5',
    'editor.lineHighlightBorder': '#00000000',
    'editorLineNumber.foreground': '#a1a1aa',
    'editorLineNumber.activeForeground': '#3f3f46',
    'editor.selectionBackground': '#f5b40040',
    'editorCursor.foreground': '#0a0a0a',
    'editorIndentGuide.background1': '#ededea',
    'scrollbarSlider.background': '#0a0a0a1f',
  },
})
monaco.editor.defineTheme(MONACO_THEMES.dark, {
  base: 'vs-dark',
  inherit: true,
  rules: [],
  colors: {
    'editor.background': '#121214',
    'editorGutter.background': '#121214',
    'editor.lineHighlightBackground': '#1c1c1f',
    'editor.lineHighlightBorder': '#00000000',
    'editorLineNumber.foreground': '#52525b',
    'editorLineNumber.activeForeground': '#d4d4d8',
    'editor.selectionBackground': '#9b8afb40',
    'editorCursor.foreground': '#f4f4f5',
    'editorIndentGuide.background1': '#1f1f23',
    'scrollbarSlider.background': '#ffffff1f',
  },
})

export { monaco }
