import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { getDisplayKey } from '../../utils/keyboardShortcuts'

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
export function GlobalCommandPalette({ isOpen, onClose, mode, commands }: GlobalCommandPaletteProps) {
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
        <motion.div
          className="palette-scrim"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={onClose}
          onKeyDown={onKeyDown}
          data-no-advance
        >
          <div className="palette" role="dialog" aria-label="Command palette" onClick={(e) => e.stopPropagation()}>
            <div className="palette__search">
              <span aria-hidden className="palette__icon">⌕</span>
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`Search commands in ${mode}...`}
                aria-label="Search commands"
              />
              <kbd>Esc</kbd>
            </div>
            <div className="palette__list" ref={listRef} role="listbox">
              {items.length === 0 && <div className="palette__empty">No matching commands</div>}
              {GROUPS.map(({ category, label }) => {
                const group = items.filter((c) => c.category === category)
                if (group.length === 0) return null
                return (
                  <div key={category}>
                    <div className="palette__group">{label}</div>
                    {group.map((item) => {
                      index += 1
                      const i = index
                      return (
                        <div
                          key={item.id}
                          data-index={i}
                          role="option"
                          aria-selected={i === selected}
                          className={`palette__row${i === selected ? ' is-selected' : ''}`}
                          onMouseEnter={() => setSelected(i)}
                          onClick={() => run(item)}
                        >
                          {item.icon && <span className="palette__row-icon">{item.icon}</span>}
                          <span className="palette__row-name">{item.name}</span>
                          {item.description && <span className="palette__row-description">{item.description}</span>}
                          {item.shortcut && (
                            <span className="palette__row-keys">
                              {item.shortcut.map((key) => (
                                <kbd key={key}>{getDisplayKey(key)}</kbd>
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
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
