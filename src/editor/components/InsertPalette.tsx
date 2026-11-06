import { useEffect, useMemo, useRef, useState } from 'react'
import { useRegistryVersion } from '../../hooks/useRegistryVersion'
import { getAllComponents, getAllTemplates, type RegistryConfig } from '../../components/slides/defineComponent'
import { Button, Sheet, SheetGroup, SheetSearch, sheetRowClass } from '../../ui'
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

  const registryVersion = useRegistryVersion()
  const items = useMemo(() => {
    // Parts (SignalNode, ListItem…) appear only when searched for; the parent's snippet already contains them.
    const listed = getAllComponents()
      .map((c) => c.registry)
      .filter((r) => r.name !== 'Presentation' && (query.trim() !== '' || !r.parent))
    const components = filter === 'templates' ? [] : filterItems(listed, query)
    const templates = filterItems([...getAllTemplates()], query)
    return [...components, ...templates]
  }, [filter, query, registryVersion])

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
    <Sheet
      label="Insert"
      onClose={onClose}
      animate={false}
      className="tw:max-w-[960px]"
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
      <SheetSearch
        inputRef={inputRef}
        value={query}
        onChange={(e) => setQuery((e.target as HTMLInputElement).value)}
        placeholder={filter === 'templates' ? 'Search slide templates…' : 'Search components and templates…'}
        aria-label="Search"
      />
      <div className="tw:flex tw:h-[min(560px,70vh)] tw:min-h-0">
        <div className="tw:w-[320px] tw:shrink-0 tw:overflow-y-auto tw:border-r tw:border-line tw:pb-1.5" ref={listRef} role="listbox" aria-label="Components and templates">
          {groups.map(({ label, list }) =>
            list.length === 0 ? null : (
              <div key={label} role="group" aria-label={label}>
                <SheetGroup>{label}</SheetGroup>
                {list.map((i) => {
                  index += 1
                  const n = index
                  return (
                    <div key={i.id} data-index={n} role="option" aria-selected={n === selected} className={`${sheetRowClass(n === selected)} tw:flex-col tw:items-start tw:gap-0.5`} onClick={() => setSelected(n)} onDoubleClick={() => insert(i)}>
                      <span className="tw:font-medium">{i.name}</span>
                      <span className="tw:line-clamp-1 tw:text-[12px] tw:text-muted">{i.description}</span>
                    </div>
                  )
                })}
              </div>
            ),
          )}
          {items.length === 0 && <div className="tw:px-4 tw:py-6 tw:text-center tw:text-muted">Nothing matches</div>}
        </div>
        {item && (
          <div className="tw:flex tw:min-w-0 tw:flex-1 tw:flex-col tw:gap-3 tw:overflow-y-auto tw:p-4">
            <div className="tw:relative tw:aspect-video tw:w-full tw:shrink-0 tw:overflow-hidden tw:rounded-lg tw:bg-black tw:shadow-hairline">
              <SlideStill source={item.previewCode} target={target} theme={theme} />
            </div>
            <p className="tw:text-fg-2">{item.description}</p>
            {item.props.length > 0 && (
              <ul className="tw:flex tw:flex-col tw:gap-0.5 tw:text-[12px] tw:text-fg-2">
                {item.props.map((p) => (
                  <li key={p.name}>
                    <code className="tw:font-mono tw:text-fg">{p.name}</code> : {p.type}
                    {p.default ? ` = ${p.default}` : ''}
                  </li>
                ))}
              </ul>
            )}
            <pre className="tw:m-0 tw:overflow-x-auto tw:rounded-lg tw:bg-field tw:p-3 tw:font-mono tw:text-[12px] tw:text-fg-2">{item.snippet}</pre>
            <Button variant="primary" className="tw:self-start" onClick={() => insert(item)}>
              Insert ⏎
            </Button>
          </div>
        )}
      </div>
    </Sheet>
  )
}
