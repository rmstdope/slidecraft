/**
 * Platform-agnostic language-service types (Part 3 §5.1): 0-based positions, LSP-like shapes.
 * Nothing here imports Monaco; a VS Code extension could reuse the core unchanged.
 */
export interface Position {
  line: number
  character: number
}

export interface Range {
  start: Position
  end: Position
}

export type Severity = 'error' | 'warning' | 'info'

export interface Diagnostic {
  range: Range
  message: string
  severity: Severity
  code: 'raw-html-element' | 'unknown-component' | 'invalid-prop-value' | 'unknown-prop'
  source: 'slidecraft'
  data?: Record<string, unknown>
}

export type CompletionKind = 'component' | 'property' | 'value' | 'closing-tag'

export interface CompletionItem {
  label: string
  kind: CompletionKind
  detail?: string
  documentation?: string
  insertText: string
  /** `snippet` uses $1/$0 placeholders. */
  format: 'plain' | 'snippet'
  sortText?: string
  /** Text the item replaces; defaults to the word before the cursor. */
  range?: Range
}

export interface Hover {
  contents: string
  range: Range
}

export interface TextEdit {
  range: Range
  newText: string
}

export interface CodeAction {
  title: string
  edits: TextEdit[]
  isPreferred?: boolean
  diagnostic: Diagnostic
}

export type PropType =
  | { kind: 'string' }
  | { kind: 'boolean' }
  | { kind: 'number' }
  | { kind: 'union'; values: string[] }
  | { kind: 'array'; elementType?: string }
  | { kind: 'object' }
  | { kind: 'function' }
  | { kind: 'ReactNode' }
  | { kind: 'unknown'; rawType: string }

export interface PropInfo {
  name: string
  type: PropType
  rawType: string
  required: boolean
  defaultValue?: string
  description?: string
}

export interface ComponentInfo {
  name: string
  description: string
  props: PropInfo[]
  snippet: string
  keywords: string[]
  useCases: string[]
  hasChildren: boolean
}

export interface ToolbarOption {
  prop: string
  type: 'boolean' | 'select' | 'number' | 'image'
  options?: string[]
}

/** Values the registry cannot know: theme ids, a theme's frame names. */
export type DynamicValues = (component: string, prop: string) => string[] | undefined

export interface LanguageServiceData {
  components: ComponentInfo[]
  toolbar: (component: string) => ToolbarOption[] | undefined
  dynamicValues?: DynamicValues
}
