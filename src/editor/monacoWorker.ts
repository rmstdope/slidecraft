/**
 * Monaco's base editor worker. A local entry, imported with `?worker`, so Vite's dev dependency
 * pre-bundler never sees the `?worker` query (it drops it for imports that resolve into node_modules).
 */
import 'monaco-editor-esm/editor/editor.worker.js'
