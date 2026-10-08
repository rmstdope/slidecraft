import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { getAllComponents, getComponentById, getToolbarConfig, type ToolbarPropEditor } from '../../components/slides/defineComponent'

const getComponentByName = (name: string) => getAllComponents().find((c) => c.registry.name === name)
import type { CursorContext } from '../cursorContext'

const QUICK_INSERT = [
  ['title', 'T', 'Title'],
  ['subtitle', 'S', 'Subtitle'],
  ['text', '¶', 'Text'],
  ['list', '•', 'List'],
  ['card', '▢', 'Card'],
  ['twocolumn', '▥', 'Two columns'],
  ['quote', '❝', 'Quote'],
  ['step', '↳', 'Step'],
] as const

const SLIDE_SELECTS: { prop: string; label: string; options: string[] }[] = [
  { prop: 'scheme', label: 'Scheme', options: ['dark', 'light'] },
  { prop: 'accent', label: 'Accent', options: ['yellow', 'red', 'teal', 'navy'] },
  { prop: 'gradient', label: 'Gradient', options: ['none', 'radial', 'radial-accent', 'diagonal', 'spotlight'] },
  { prop: 'layout', label: 'Layout', options: ['centered', 'document'] },
]

const title = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).replace(/-/g, ' ')

export interface ContextualToolbarProps {
  context: CursorContext
  /** Frames of the deck theme, for the slide's frame picker. */
  frames: string[]
  onSlideProp(prop: string, value: string): void
  onComponentProp(prop: string, value: string): void
  onInsert(snippet: string): void
  onOpenPalette(): void
  onDeleteComponent(): void
  onPickImage(prop: string): void
}

/** Commits on blur or Enter, so typing a number never loses focus mid-way. */
function NumberInput({ value, editor, onCommit }: { value: string; editor: ToolbarPropEditor; onCommit(v: string): void }) {
  const [local, setLocal] = useState(value)
  useEffect(() => setLocal(value), [value])
  return (
    <input
      type="number"
      className="ctx-input"
      value={local}
      min={editor.min}
      max={editor.max}
      step={editor.step}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => local !== value && onCommit(local)}
      onKeyDown={(e) => {
        e.stopPropagation()
        if (e.key === 'Enter') onCommit(local)
      }}
    />
  )
}

/** The bar above the code editor (Part 3 §2.10): edits props of whatever the cursor is on. */
export function ContextualToolbar(props: ContextualToolbarProps) {
  const { context } = props
  return (
    <div className="ctx-toolbar">
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={context.type} className="ctx-toolbar__inner" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
          {context.type === 'slide' && (
            <>
              <span className="ctx-label">Slide</span>
              {SLIDE_SELECTS.map(({ prop, label, options }) => (
                <label key={prop} className="ctx-field">
                  <span>{label}</span>
                  <select value={context.props[prop] ?? options[0]} onChange={(e) => props.onSlideProp(prop, e.target.value)}>
                    {options.map((o) => (
                      <option key={o} value={o}>
                        {title(o)}
                      </option>
                    ))}
                  </select>
                  {prop === 'accent' && <span className={`ctx-swatch accent-${context.props.accent ?? 'yellow'}`} aria-hidden />}
                </label>
              ))}
              {props.frames.length > 0 && (
                <label className="ctx-field">
                  <span>Frame</span>
                  <select value={context.props.frame ?? ''} onChange={(e) => props.onSlideProp('frame', e.target.value)}>
                    <option value="">Theme default</option>
                    <option value="none">None</option>
                    {props.frames.map((f) => (
                      <option key={f} value={f}>
                        {title(f)}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </>
          )}
          {context.type === 'insert' && (
            <>
              <span className="ctx-label">Insert{context.parentComponent ? ` in ${context.parentComponent}` : ''}</span>
              {QUICK_INSERT.map(([id, glyph, label]) => (
                <button key={id} type="button" className="ctx-button" onClick={() => props.onInsert(getComponentById(id)?.registry.snippet ?? '')}>
                  <span aria-hidden>{glyph}</span> {label}
                </button>
              ))}
              <button type="button" className="ctx-button" onClick={props.onOpenPalette}>
                More <kbd>⌘K</kbd>
              </button>
            </>
          )}
          {context.type === 'component' && (
            <>
              <span className="ctx-label">{context.name}</span>
              {(getToolbarConfig(context.name) ?? []).map((editor) => {
                const prop = String(editor.prop)
                const value = context.props[prop]
                if (editor.type === 'boolean') {
                  // An absent attribute means the registry default (e.g. Stat countUp is on unless set).
                  const declared = getComponentByName(context.name)?.registry.props.find((p) => p.name === prop)?.default
                  const on = value === undefined ? declared === 'true' : value === '' || value === 'true'
                  return (
                    <button key={prop} type="button" className={`ctx-toggle${on ? ' is-on' : ''}`} onClick={() => props.onComponentProp(prop, on ? 'false' : 'true')}>
                      {prop}: {on ? 'On' : 'Off'}
                    </button>
                  )
                }
                if (editor.type === 'select') {
                  return (
                    <label key={prop} className="ctx-field">
                      <span>{prop}</span>
                      <select value={value ?? ''} onChange={(e) => props.onComponentProp(prop, e.target.value)}>
                        <option value="">—</option>
                        {(editor.options ?? []).map((o) => (
                          <option key={o} value={o}>
                            {title(o)}
                          </option>
                        ))}
                      </select>
                    </label>
                  )
                }
                if (editor.type === 'number') {
                  return (
                    <label key={prop} className="ctx-field">
                      <span>{prop}</span>
                      <NumberInput value={(value ?? '').replace(/^\{|\}$/g, '')} editor={editor} onCommit={(v) => props.onComponentProp(prop, v)} />
                    </label>
                  )
                }
                return (
                  <button key={prop} type="button" className="ctx-button" onClick={() => props.onPickImage(prop)}>
                    {prop}: {value ? value.split('/').pop() : 'Select image'}
                  </button>
                )
              })}
              <button type="button" className="ctx-button is-danger ctx-right" onClick={props.onDeleteComponent}>
                Delete
              </button>
            </>
          )}
          {context.type === 'none' && <span className="ctx-hint">Select a slide or put the cursor in the editor</span>}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
