import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import Editor, { type OnMount } from '@monaco-editor/react'
import type * as Monaco from 'monaco-editor-esm/editor/editor.api.js'
import type { LanguageService } from '../../language-service/service'
import { LANGUAGE_ID, registerMdxLanguageFeatures, setupDiagnostics } from '../../language-service-monaco'
import { monaco } from '../monacoSetup'

export interface SelectionInfo {
  text: string
  position: { top: number; left: number }
}

export interface SlideEditorHandle {
  insertAtCursor(text: string): void
  wrapSelection(before: string, after: string): void
  /** Replace the whole value through a minimal edit, keeping the cursor and the undo stack. */
  applyText(next: string): void
  getCursorOffset(): number
  focus(): void
}

export interface SlideEditorProps {
  /** Monaco model path: one model (and undo history) per slide. */
  path: string
  value: string
  readOnly: boolean
  service: () => LanguageService
  onChange(value: string): void
  onSave(): void
  onCursor(offset: number): void
  onSelection(info: SelectionInfo | null): void
}

/** Common prefix and suffix: the smallest range that turns `a` into `b`. */
export function minimalEdit(a: string, b: string): { start: number; end: number; text: string } {
  let start = 0
  while (start < a.length && start < b.length && a[start] === b[start]) start++
  let endA = a.length
  let endB = b.length
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA--
    endB--
  }
  return { start, end: endA, text: b.slice(start, endB) }
}

export const SlideEditor = forwardRef<SlideEditorHandle, SlideEditorProps>(function SlideEditor(props, ref) {
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null)
  const callbacks = useRef(props)
  callbacks.current = props
  const cleanup = useRef<(() => void) | null>(null)

  useImperativeHandle(ref, () => ({
    insertAtCursor(text) {
      const editor = editorRef.current
      const selection = editor?.getSelection()
      if (!editor || !selection) return
      editor.executeEdits('insert', [{ range: selection, text, forceMoveMarkers: true }])
      // Put the cursor inside the inserted tag so the contextual toolbar shows that component.
      const firstLine = text.split('\n')[0]
      const lt = firstLine.indexOf('<')
      if (lt >= 0) editor.setPosition({ lineNumber: selection.startLineNumber, column: selection.startColumn + lt + 2 })
      editor.focus()
    },
    wrapSelection(before, after) {
      const editor = editorRef.current
      const selection = editor?.getSelection()
      const model = editor?.getModel()
      if (!editor || !selection || !model) return
      editor.executeEdits('wrap', [{ range: selection, text: `${before}${model.getValueInRange(selection)}${after}`, forceMoveMarkers: true }])
      editor.focus()
    },
    applyText(next) {
      const editor = editorRef.current
      const model = editor?.getModel()
      if (!editor || !model) return
      const current = model.getValue()
      if (current === next) return
      const { start, end, text } = minimalEdit(current, next)
      const from = model.getPositionAt(start)
      const to = model.getPositionAt(end)
      editor.executeEdits('toolbar', [{ range: new monaco.Range(from.lineNumber, from.column, to.lineNumber, to.column), text }])
    },
    getCursorOffset() {
      const editor = editorRef.current
      const position = editor?.getPosition()
      return editor && position ? (editor.getModel()?.getOffsetAt(position) ?? 0) : 0
    },
    focus: () => editorRef.current?.focus(),
  }))

  useEffect(() => () => cleanup.current?.(), [])

  const onMount: OnMount = (editor) => {
    editorRef.current = editor
    registerMdxLanguageFeatures(monaco, () => callbacks.current.service())
    cleanup.current?.()
    const stopDiagnostics = setupDiagnostics(monaco, editor, () => callbacks.current.service())
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => callbacks.current.onSave())
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Space, () => editor.trigger('keyboard', 'editor.action.triggerSuggest', {}))
    const cursor = editor.onDidChangeCursorPosition((e) => callbacks.current.onCursor(editor.getModel()?.getOffsetAt(e.position) ?? 0))
    const selection = editor.onDidChangeCursorSelection((e) => {
      const model = editor.getModel()
      if (!model || e.selection.isEmpty()) return callbacks.current.onSelection(null)
      const visible = editor.getScrolledVisiblePosition(e.selection.getEndPosition())
      const box = editor.getDomNode()?.getBoundingClientRect()
      if (!visible || !box) return
      callbacks.current.onSelection({ text: model.getValueInRange(e.selection), position: { top: box.top + visible.top, left: box.left + visible.left } })
    })
    cleanup.current = () => {
      stopDiagnostics()
      cursor.dispose()
      selection.dispose()
    }
    editor.focus()
    callbacks.current.onCursor(editor.getModel()?.getOffsetAt(editor.getPosition() ?? { lineNumber: 1, column: 1 }) ?? 0)
  }

  return (
    <Editor
      path={props.path}
      value={props.value}
      language={LANGUAGE_ID}
      theme="vs-dark"
      onChange={(value) => props.onChange(value ?? '')}
      onMount={onMount}
      options={{
        readOnly: props.readOnly,
        fontSize: 14,
        fontFamily: "ui-monospace, 'JetBrains Mono', Menlo, monospace",
        minimap: { enabled: false },
        lineNumbers: 'on',
        wordWrap: 'on',
        scrollBeyondLastLine: false,
        tabSize: 2,
        automaticLayout: true,
        padding: { top: 16, bottom: 16 },
        renderLineHighlight: 'line',
        smoothScrolling: true,
        cursorSmoothCaretAnimation: 'on',
        bracketPairColorization: { enabled: true },
        quickSuggestions: { other: true, comments: false, strings: true },
        suggestOnTriggerCharacters: true,
        acceptSuggestionOnCommitCharacter: true,
        wordBasedSuggestions: 'off',
        suggest: { showKeywords: false, showSnippets: true, showClasses: true, showProperties: true, showValues: true, insertMode: 'replace', filterGraceful: true, snippetsPreventQuickSuggestions: false },
      }}
    />
  )
})
