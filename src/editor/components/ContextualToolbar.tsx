import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { Trash2 } from 'lucide-react'
import { useRegistryVersion } from '../../hooks/useRegistryVersion'
import { getAllComponents, getComponentById, getToolbarConfig, type ToolbarPropEditor } from '../../components/slides/defineComponent'
import { cn, Kbd, NativeSelect } from '../../ui'
import type { CursorContext } from '../cursorContext'

const getComponentByName = (name: string) => getAllComponents().find((c) => c.registry.name === name)

/** The pieces of the bar, so each control reads the same. */
const fieldClass = 'tw:flex tw:items-center tw:gap-1.5 tw:text-[12px] tw:text-muted'
const buttonClass =
  'tw:inline-flex tw:h-7 tw:items-center tw:gap-1.5 tw:rounded-md tw:px-2 tw:text-[12px] tw:font-medium tw:whitespace-nowrap tw:text-fg-2 tw:hover:bg-field tw:hover:text-fg'
const labelClass = 'tw:mr-1 tw:rounded-md tw:bg-accent-tint tw:px-2 tw:py-0.5 tw:text-[11px] tw:font-semibold tw:tracking-wide tw:text-on-accent-tint tw:uppercase'

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
      className="tw:h-7 tw:w-16 tw:rounded-md tw:border-0 tw:bg-field tw:px-2 tw:text-[12px] tw:text-fg tw:outline-none tw:focus-visible:shadow-[0_0_0_2px_var(--sc-focus)]"
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
  useRegistryVersion()
  const { context } = props
  return (
    <div className="tw:flex tw:h-11 tw:shrink-0 tw:items-center tw:overflow-x-auto tw:overflow-y-hidden tw:border-b tw:border-line tw:px-3">
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={context.type} className="tw:flex tw:min-w-full tw:items-center tw:gap-2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
          {context.type === 'slide' && (
            <>
              <span className={labelClass}>Slide</span>
              {SLIDE_SELECTS.map(({ prop, label, options }) => (
                <label key={prop} className={fieldClass}>
                  <span>{label}</span>
                  <NativeSelect size="sm" value={context.props[prop] ?? options[0]} onChange={(e) => props.onSlideProp(prop, e.target.value)}>
                    {options.map((o) => (
                      <option key={o} value={o}>
                        {title(o)}
                      </option>
                    ))}
                  </NativeSelect>
                  {prop === 'accent' && <span className={`accent-${context.props.accent ?? 'yellow'} tw:size-2.5 tw:rounded-full tw:bg-(--accent)`} aria-hidden />}
                </label>
              ))}
              {props.frames.length > 0 && (
                <label className={fieldClass}>
                  <span>Frame</span>
                  <NativeSelect size="sm" value={context.props.frame ?? ''} onChange={(e) => props.onSlideProp('frame', e.target.value)}>
                    <option value="">Theme default</option>
                    <option value="none">None</option>
                    {props.frames.map((f) => (
                      <option key={f} value={f}>
                        {title(f)}
                      </option>
                    ))}
                  </NativeSelect>
                </label>
              )}
            </>
          )}
          {context.type === 'insert' && (
            <>
              <span className={labelClass}>Insert{context.parentComponent ? ` in ${context.parentComponent}` : ''}</span>
              {QUICK_INSERT.map(([id, glyph, label]) => (
                <button key={id} type="button" className={buttonClass} onClick={() => props.onInsert(getComponentById(id)?.registry.snippet ?? '')}>
                  <span aria-hidden className="tw:text-muted">
                    {glyph}
                  </span>
                  {label}
                </button>
              ))}
              <button type="button" className={buttonClass} onClick={props.onOpenPalette}>
                More <Kbd>⌘K</Kbd>
              </button>
            </>
          )}
          {context.type === 'component' && (
            <>
              <span className={labelClass}>{context.name}</span>
              {(getToolbarConfig(context.name) ?? []).map((editor) => {
                const prop = String(editor.prop)
                const value = context.props[prop]
                if (editor.type === 'boolean') {
                  // An absent attribute means the registry default (e.g. Stat countUp is on unless set).
                  const declared = getComponentByName(context.name)?.registry.props.find((p) => p.name === prop)?.default
                  const on = value === undefined ? declared === 'true' : value === '' || value === 'true'
                  return (
                    <button key={prop} type="button" aria-pressed={on} className={cn(buttonClass, on && 'tw:bg-field tw:text-fg')} onClick={() => props.onComponentProp(prop, on ? 'false' : 'true')}>
                      {prop}: {on ? 'On' : 'Off'}
                    </button>
                  )
                }
                if (editor.type === 'select') {
                  return (
                    <label key={prop} className={fieldClass}>
                      <span>{prop}</span>
                      <NativeSelect size="sm" value={value ?? ''} onChange={(e) => props.onComponentProp(prop, e.target.value)}>
                        <option value="">—</option>
                        {(editor.options ?? []).map((o) => (
                          <option key={o} value={o}>
                            {title(o)}
                          </option>
                        ))}
                      </NativeSelect>
                    </label>
                  )
                }
                if (editor.type === 'number') {
                  return (
                    <label key={prop} className={fieldClass}>
                      <span>{prop}</span>
                      <NumberInput value={(value ?? '').replace(/^\{|\}$/g, '')} editor={editor} onCommit={(v) => props.onComponentProp(prop, v)} />
                    </label>
                  )
                }
                return (
                  <button key={prop} type="button" className={buttonClass} onClick={() => props.onPickImage(prop)}>
                    {prop}: {value ? value.split('/').pop() : 'Select image'}
                  </button>
                )
              })}
              <span className="tw:flex-1" />
              <button type="button" className={cn(buttonClass, 'tw:hover:text-removed tw:[&_svg]:size-3.5')} onClick={props.onDeleteComponent}>
                <Trash2 aria-hidden />
                Delete
              </button>
            </>
          )}
          {context.type === 'none' && <span className="tw:text-[12px] tw:text-muted">Select a slide or put the cursor in the editor</span>}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
