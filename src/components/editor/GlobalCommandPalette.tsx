import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence } from 'motion/react'
import { getDisplayKey } from '../../utils/keyboardShortcuts'
import { Kbd, Sheet, SheetGroup, SheetSearch, sheetRowClass } from '../../ui'

export interface CommandItem {
  id: string
  name: string
  description?: string
  category: 'navigation' | 'action' | 'view'
  icon?: ReactNode
  shortcut?: string[]
  action: () => void
}

export interface GlobalCommandPaletteProps {
  isOpen: boolean
  onClose: () => void
  /** Shown in the placeholder: "Search commands in <mode>...". */
  mode: string
  commands: CommandItem[]
  /** Forces a theme: the player and presenter are always dark. */
  theme?: 'light' | 'dark'
}

const GROUPS: { category: CommandItem['category']; label: string }[] = [
  { category: 'navigation', label: 'Go to' },
  { category: 'action', label: 'Actions' },
  { category: 'view', label: 'Views' },
]

export function filterCommands(commands: CommandItem[], query: string): CommandItem[] {
  const q = query.trim().toLowerCase()
  const matching = q
    ? commands.filter((c) => `${c.name} ${c.description ?? ''} ${(c.shortcut ?? []).join(' ')}`.toLowerCase().includes(q))
    : commands
  // flat list in group order, for keyboard navigation
  return GROUPS.flatMap((g) => matching.filter((c) => c.category === g.category))
}

/** Cmd/Ctrl+K palette shared by home, presentation and editor (Part 3 §1.8). */
export function GlobalCommandPalette({ isOpen, onClose, mode, commands, theme }: GlobalCommandPaletteProps) {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)
  const [hasNavigated, setHasNavigated] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const items = useMemo(() => filterCommands(commands, query), [commands, query])

  useEffect(() => {
    if (!isOpen) return
    setQuery('')
    setSelected(0)
    setHasNavigated(false)
    const timer = setTimeout(() => inputRef.current?.focus(), 50)
    return () => clearTimeout(timer)
  }, [isOpen])

  useEffect(() => setSelected(0), [query])

  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${selected}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [selected])

  const run = (item: CommandItem | undefined) => {
    if (!item) return
    onClose()
    setTimeout(item.action, 50)
  }

  const onKeyDown = (event: React.KeyboardEvent) => {
    event.stopPropagation()
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setHasNavigated(true)
      setSelected((i) => Math.min(items.length - 1, i + 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setHasNavigated(true)
      setSelected((i) => Math.max(0, i - 1))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      run(items[selected])
    } else if (event.key === 'Escape') {
      event.preventDefault()
      if (hasNavigated) {
        setHasNavigated(false)
        setSelected(0)
        inputRef.current?.focus()
      } else onClose()
    }
  }

  let index = -1
  return (
    <AnimatePresence>
      {isOpen && (
        <Sheet label="Command palette" theme={theme} onClose={onClose} onKeyDown={onKeyDown}>
          <SheetSearch inputRef={inputRef} value={query} onChange={(e) => setQuery((e.target as HTMLInputElement).value)} placeholder={`Search commands in ${mode}...`} aria-label="Search commands" />
          <div className="tw:max-h-[min(420px,60vh)] tw:overflow-y-auto tw:pb-1.5" ref={listRef} role="listbox" aria-label="Commands">
            {items.length === 0 && <div className="tw:px-4 tw:py-6 tw:text-center tw:text-muted">No matching commands</div>}
            {GROUPS.map(({ category, label }) => {
              const group = items.filter((c) => c.category === category)
              if (group.length === 0) return null
              return (
                <div key={category} role="group" aria-label={label}>
                  <SheetGroup>{label}</SheetGroup>
                  {group.map((item) => {
                    index += 1
                    const i = index
                    return (
                      <div key={item.id} data-index={i} role="option" aria-selected={i === selected} className={sheetRowClass(i === selected)} onMouseEnter={() => setSelected(i)} onClick={() => run(item)}>
                        {item.icon && <span className="tw:text-muted tw:[&_svg]:size-4">{item.icon}</span>}
                        <span className="tw:shrink-0 tw:font-medium">{item.name}</span>
                        {item.description && <span className="tw:min-w-0 tw:flex-1 tw:truncate tw:text-[12px] tw:text-muted">{item.description}</span>}
                        {item.shortcut && (
                          <span className="tw:ml-auto tw:flex tw:gap-1">
                            {item.shortcut.map((key) => (
                              <Kbd key={key}>{getDisplayKey(key)}</Kbd>
                            ))}
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </Sheet>
      )}
    </AnimatePresence>
  )
}
