import { useEffect } from 'react'
import { AnimatePresence } from 'motion/react'
import { getDisplayKey, getModeLabel, getShortcutsForMode, groupShortcutsByCategory, type AppMode } from '../../utils/keyboardShortcuts'
import { Kbd, Sheet } from '../../ui'

export interface KeyboardShortcutsModalProps {
  isOpen: boolean
  onClose: () => void
  mode: AppMode
  /** Forces a theme: the player and presenter are always dark. */
  theme?: 'light' | 'dark'
}

/** "?" modal listing the shortcuts of the current mode (Part 3 §1.9). */
export function KeyboardShortcutsModal({ isOpen, onClose, mode, theme }: KeyboardShortcutsModalProps) {
  useEffect(() => {
    if (!isOpen) return
    // Capture phase so Esc reaches us before Monaco or the presentation.
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' || event.key === '?') {
        event.preventDefault()
        event.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [isOpen, onClose])

  const groups = groupShortcutsByCategory(getShortcutsForMode(mode))
  return (
    <AnimatePresence>
      {isOpen && (
        <Sheet label="Keyboard shortcuts" theme={theme} onClose={onClose} className="tw:max-w-[720px]">
          <header className="tw:flex tw:items-baseline tw:justify-between tw:gap-4 tw:border-b tw:border-line tw:px-5 tw:py-4">
            <h2 className="tw:font-display tw:text-[22px] tw:font-semibold">Keyboard Shortcuts</h2>
            <span className="tw:text-[13px] tw:text-muted">{getModeLabel(mode)} Mode</span>
          </header>
          <div className="tw:grid tw:max-h-[70vh] tw:grid-cols-[repeat(auto-fit,minmax(280px,1fr))] tw:gap-x-8 tw:gap-y-5 tw:overflow-y-auto tw:px-5 tw:py-4">
            {[...groups].map(([category, shortcuts]) => (
              <section key={category} className="tw:flex tw:flex-col tw:gap-1.5">
                <h3 className="tw:text-[11px] tw:font-semibold tw:tracking-wide tw:text-muted tw:uppercase">{category}</h3>
                {shortcuts.map((shortcut) => (
                  <div className="tw:flex tw:items-center tw:justify-between tw:gap-3 tw:text-[13px] tw:text-fg-2" key={`${shortcut.action}-${shortcut.keys.join('+')}`}>
                    <span>{shortcut.action}</span>
                    <span className="tw:flex tw:shrink-0 tw:gap-1">
                      {shortcut.keys.map((key) => (
                        <Kbd key={key}>{getDisplayKey(key)}</Kbd>
                      ))}
                    </span>
                  </div>
                ))}
              </section>
            ))}
          </div>
        </Sheet>
      )}
    </AnimatePresence>
  )
}
