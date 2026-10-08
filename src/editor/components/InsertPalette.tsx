import { useEffect, useMemo, useRef, useState } from 'react'
import { getAllComponents, getAllTemplates, type RegistryConfig } from '../../components/slides/defineComponent'
import type { CompileTarget } from '../compileSlide'
import { SlideStill } from './SlideStill'

export function filterItems(items: RegistryConfig[], query: string): RegistryConfig[] {
  const q = query.trim().toLowerCase()
  if (!q) return items
  return items.filter((i) => i.name.toLowerCase().includes(q) || i.description.toLowerCase().includes(q) || (i.keywords ?? []).some((k) => k.toLowerCase().includes(q)))
}

export interface InsertPaletteProps {
  isOpen: boolean
  filter: 'all' | 'templates'
  target: CompileTarget
  theme?: string
  onClose(): void
  onInsert(snippet: string): void
}

/** Command palette for inserting components and templates (Part 3 §2.13). */
export function InsertPalette({ isOpen, filter, target, theme, onClose, onInsert }: InsertPaletteProps) {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const items = useMemo(() => {
    const components = filter === 'templates' ? [] : filterItems(getAllComponents().map((c) => c.registry).filter((r) => r.name !== 'Presentation'), query)
    const templates = filterItems([...getAllTemplates()], query)
    return [...components, ...templates]
  }, [filter, query])

  useEffect(() => {
    if (!isOpen) return
    setQuery('')
    setSelected(0)
    const t = setTimeout(() => inputRef.current?.focus(), 50)
    return () => clearTimeout(t)
  }, [isOpen])
  useEffect(() => setSelected(0), [query])
  useEffect(() => listRef.current?.querySelector(`[data-index="${selected}"]`)?.scrollIntoView({ block: 'nearest' }), [selected])

  if (!isOpen) return null
  const item = items[selected]
  const insert = (i: RegistryConfig | undefined) => {
    if (!i) return
    onInsert(i.snippet)
    onClose()
  }
  const groups = [
    { label: 'Components', list: items.filter((i) => i.category === 'component') },
    { label: 'Templates', list: items.filter((i) => i.category === 'template') },
  ]
  let index = -1

  return (
    <div className="palette-scrim" onClick={onClose}>
      <div
        className="palette insert-palette"
        role="dialog"
        aria-label="Insert"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          e.stopPropagation()
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setSelected((s) => Math.min(items.length - 1, s + 1))
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setSelected((s) => Math.max(0, s - 1))
          } else if (e.key === 'Enter') {
            e.preventDefault()
            insert(item)
          } else if (e.key === 'Escape') {
            e.preventDefault()
            onClose()
          }
        }}
      >
        <div className="palette__search">
          <span aria-hidden className="palette__icon">⌕</span>
          <input ref={inputRef} value={query} onChange={(e) => setQuery(e.target.value)} placeholder={filter === 'templates' ? 'Search slide templates…' : 'Search components and templates…'} aria-label="Search" />
          <kbd>Esc</kbd>
        </div>
        <div className="insert-palette__body">
          <div className="insert-palette__list" ref={listRef}>
            {groups.map(({ label, list }) =>
              list.length === 0 ? null : (
                <div key={label}>
                  <div className="palette__group">{label}</div>
                  {list.map((i) => {
                    index += 1
                    const n = index
                    return (
                      <div key={i.id} data-index={n} className={`palette__row${n === selected ? ' is-selected' : ''}`} onClick={() => setSelected(n)} onDoubleClick={() => insert(i)}>
                        <span className="palette__row-name">{i.name}</span>
                        <span className="palette__row-description">{i.description}</span>
                      </div>
                    )
                  })}
                </div>
              ),
            )}
            {items.length === 0 && <div className="palette__empty">Nothing matches</div>}
          </div>
          {item && (
            <div className="insert-palette__detail">
              <div className="insert-palette__preview">
                <SlideStill source={item.previewCode} target={target} theme={theme} />
              </div>
              <p>{item.description}</p>
              {item.props.length > 0 && (
                <ul className="insert-palette__props">
                  {item.props.map((p) => (
                    <li key={p.name}>
                      <code>{p.name}</code> : {p.type}
                      {p.default ? ` = ${p.default}` : ''}
                    </li>
                  ))}
                </ul>
              )}
              <pre className="insert-palette__code">{item.snippet}</pre>
              <button type="button" className="editor-button is-primary" onClick={() => insert(item)}>
                Insert ⏎
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
