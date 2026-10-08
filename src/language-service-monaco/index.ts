/**
 * Monaco adapters for the language service (Part 3 §5): a dedicated `mdx` language, providers
 * for completion, hover and quick fixes, and markers for diagnostics. Converts between the core's
 * 0-based positions and Monaco's 1-based ones.
 */
import type * as Monaco from 'monaco-editor-esm/editor/editor.api.js'
import type { LanguageService } from '../language-service/service'
import type { CompletionKind, Diagnostic, Range } from '../language-service/types'

export const LANGUAGE_ID = 'mdx'
const OWNER = 'slidecraft'

type M = typeof Monaco

const toMonacoRange = (monaco: M, r: Range) => new monaco.Range(r.start.line + 1, r.start.character + 1, r.end.line + 1, r.end.character + 1)

const FOLDING_TAGS = 'Presentation|Slide|Card|TwoColumn|FourColumn|Stack|List|Quote|Step|PersonRow|Notes|Callout|Code'

function registerLanguage(monaco: M): void {
  if (monaco.languages.getLanguages().some((l) => l.id === LANGUAGE_ID)) return
  monaco.languages.register({ id: LANGUAGE_ID, extensions: ['.mdx'], aliases: ['MDX'] })
  monaco.languages.setMonarchTokensProvider(LANGUAGE_ID, {
    defaultToken: '',
    tokenizer: {
      root: [
        [/\{\/\*/, 'comment', '@comment'],
        [/^\s*(import|export)\b/, 'keyword', '@esm'],
        [/^---$/, 'meta', '@frontmatter'],
        [/<\/?[A-Z][\w.]*/, 'type.identifier', '@tag'],
        [/<\/?[a-z][\w-]*/, 'tag', '@tag'],
        [/^#{1,6}\s.*$/, 'keyword'],
        [/\*\*[^*]+\*\*/, 'strong'],
        [/\{/, 'delimiter.bracket', '@expression'],
      ],
      comment: [
        [/\*\/\}/, 'comment', '@pop'],
        [/./, 'comment'],
      ],
      frontmatter: [
        [/^---$/, 'meta', '@pop'],
        [/.*/, 'meta'],
      ],
      esm: [
        [/'[^']*'|"[^"]*"/, 'string'],
        [/\b(from|as)\b/, 'keyword'],
        [/$/, '', '@pop'],
        [/./, ''],
      ],
      tag: [
        [/\/?>/, 'type.identifier', '@pop'],
        [/[\w-]+(?==)/, 'attribute.name'],
        [/[\w-]+/, 'attribute.name'],
        [/=/, 'delimiter'],
        [/"[^"]*"|'[^']*'/, 'attribute.value'],
        [/\{/, 'delimiter.bracket', '@expression'],
        [/\s+/, ''],
      ],
      expression: [
        [/\{/, 'delimiter.bracket', '@push'],
        [/\}/, 'delimiter.bracket', '@pop'],
        [/`/, 'string', '@template'],
        [/"[^"]*"|'[^']*'/, 'string'],
        [/\b\d+(\.\d+)?\b/, 'number'],
        [/\b(true|false|null|undefined)\b/, 'keyword'],
        [/./, ''],
      ],
      template: [
        [/`/, 'string', '@pop'],
        [/./, 'string'],
      ],
    },
  })
  monaco.languages.setLanguageConfiguration(LANGUAGE_ID, {
    comments: { blockComment: ['{/*', '*/}'] },
    brackets: [
      ['{', '}'],
      ['[', ']'],
      ['(', ')'],
    ],
    autoClosingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: '"', close: '"', notIn: ['string'] },
      { open: "'", close: "'", notIn: ['string'] },
      { open: '`', close: '`', notIn: ['string'] },
      { open: '{/*', close: ' */}' },
    ],
    surroundingPairs: [
      { open: '{', close: '}' },
      { open: '"', close: '"' },
      { open: "'", close: "'" },
      { open: '`', close: '`' },
    ],
    folding: { markers: { start: new RegExp(`^\\s*<(${FOLDING_TAGS})\\b(?![^>]*/>)`), end: new RegExp(`^\\s*</(${FOLDING_TAGS})>`) } },
    indentationRules: {
      increaseIndentPattern: /^\s*<([A-Z][\w.]*)(?![^>]*\/>)[^>]*>\s*$/,
      decreaseIndentPattern: /^\s*<\/[A-Z][\w.]*>/,
    },
    onEnterRules: [
      { beforeText: /<([A-Z][\w.]*)[^/>]*>\s*$/, afterText: /^<\/[A-Z][\w.]*>/, action: { indentAction: monaco.languages.IndentAction.IndentOutdent } },
      { beforeText: /^\s*<([A-Z][\w.]*)(?![^>]*\/>)[^>]*>\s*$/, action: { indentAction: monaco.languages.IndentAction.Indent } },
    ],
    wordPattern: /(-?\d*\.\d\w*)|([^`~!@#%^&*()=+[{\]}\\|;:'",.<>/?\s]+)/g,
  })
}

const KIND: (monaco: M) => Record<CompletionKind, Monaco.languages.CompletionItemKind> = (monaco) => ({
  component: monaco.languages.CompletionItemKind.Class,
  property: monaco.languages.CompletionItemKind.Property,
  value: monaco.languages.CompletionItemKind.EnumMember,
  'closing-tag': monaco.languages.CompletionItemKind.Keyword,
})

const SEVERITY = (monaco: M, s: Diagnostic['severity']) =>
  s === 'error' ? monaco.MarkerSeverity.Error : s === 'warning' ? monaco.MarkerSeverity.Warning : monaco.MarkerSeverity.Info

let registrations: Monaco.IDisposable[] = []

/** Register the language and providers once per page; re-registering replaces the providers. */
export function registerMdxLanguageFeatures(monaco: M, getService: () => LanguageService): void {
  registerLanguage(monaco)
  registrations.forEach((d) => d.dispose())
  const kinds = KIND(monaco)
  registrations = [
    monaco.languages.registerCompletionItemProvider(LANGUAGE_ID, {
      triggerCharacters: ['<', '"', "'", '=', ' ', '/'],
      provideCompletionItems(model, position) {
        const word = model.getWordUntilPosition(position)
        const fallback = new monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn)
        const items = getService().completions(model.getValue(), { line: position.lineNumber - 1, character: position.column - 1 })
        return {
          suggestions: items.map((item) => ({
            label: item.label,
            kind: kinds[item.kind],
            detail: item.detail,
            documentation: item.documentation ? { value: item.documentation, isTrusted: true } : undefined,
            insertText: item.insertText,
            insertTextRules: item.format === 'snippet' ? monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet : undefined,
            sortText: item.sortText,
            range: item.range ? toMonacoRange(monaco, item.range) : fallback,
          })),
        }
      },
    }),
    monaco.languages.registerHoverProvider(LANGUAGE_ID, {
      provideHover(model, position) {
        const hover = getService().hover(model.getValue(), { line: position.lineNumber - 1, character: position.column - 1 })
        return hover ? { contents: [{ value: hover.contents, isTrusted: true }], range: toMonacoRange(monaco, hover.range) } : null
      },
    }),
    monaco.languages.registerCodeActionProvider(LANGUAGE_ID, {
      provideCodeActions(model, range) {
        // Recompute: Monaco markers drop the diagnostics' data.
        const text = model.getValue()
        const service = getService()
        const relevant = service.diagnostics(text).filter((d) => toMonacoRange(monaco, d.range).intersectRanges(range))
        const actions = service.codeActions(text, relevant).map((action) => ({
          title: action.title,
          kind: 'quickfix',
          isPreferred: action.isPreferred,
          diagnostics: [],
          edit: {
            edits: action.edits.map((e) => ({ resource: model.uri, versionId: model.getVersionId(), textEdit: { range: toMonacoRange(monaco, e.range), text: e.newText } })),
          },
        }))
        return { actions, dispose: () => {} }
      },
    }),
  ]
}

/** Keep markers current for one editor, recomputed 300 ms after each change. */
export function setupDiagnostics(monaco: M, editor: Monaco.editor.IStandaloneCodeEditor, getService: () => LanguageService): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined
  const update = () => {
    const model = editor.getModel()
    if (!model) return
    monaco.editor.setModelMarkers(
      model,
      OWNER,
      getService()
        .diagnostics(model.getValue())
        .map((d) => ({ startLineNumber: d.range.start.line + 1, startColumn: d.range.start.character + 1, endLineNumber: d.range.end.line + 1, endColumn: d.range.end.character + 1, message: d.message, severity: SEVERITY(monaco, d.severity), code: d.code, source: 'slidecraft' })),
    )
  }
  update()
  const sub = editor.onDidChangeModelContent(() => {
    clearTimeout(timer)
    timer = setTimeout(update, 300)
  })
  return () => {
    clearTimeout(timer)
    sub.dispose()
    const model = editor.getModel()
    if (model) monaco.editor.setModelMarkers(model, OWNER, [])
  }
}
