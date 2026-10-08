/**
 * Monaco from the local package (no CDN), so the editor works offline and in the binary. Only the
 * base editor worker is needed: the `mdx` language runs on the main thread.
 */
import { loader } from '@monaco-editor/react'
import * as monaco from './monacoCore'
import EditorWorker from './monacoWorker.ts?worker'

self.MonacoEnvironment = { getWorker: () => new EditorWorker() }
loader.config({ monaco: monaco as unknown as Parameters<typeof loader.config>[0]['monaco'] })

export { monaco }
