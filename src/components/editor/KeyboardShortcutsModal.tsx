import { useEffect } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { getDisplayKey, getModeLabel, getShortcutsForMode, groupShortcutsByCategory, type AppMode } from '../../utils/keyboardShortcuts'

export interface KeyboardShortcutsModalProps {
  isOpen: boolean
  onClose: () => void
  mode: AppMode
}

/** "?" modal listing the shortcuts of the current mode (Part 3 §1.9). */
export function KeyboardShortcutsModal({ isOpen, onClose, mode }: KeyboardShortcutsModalProps) {
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
        <motion.div
          className="shortcuts-scrim"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={onClose}
          data-no-advance
        >
          <div className="shortcuts" role="dialog" aria-label="Keyboard shortcuts" onClick={(e) => e.stopPropagation()}>
            <header className="shortcuts__header">
              <h2>Keyboard Shortcuts</h2>
              <span>{getModeLabel(mode)} Mode</span>
            </header>
            <div className="shortcuts__body">
              {[...groups].map(([category, shortcuts]) => (
                <section key={category}>
                  <h3>{category}</h3>
                  {shortcuts.map((shortcut) => (
                    <div className="shortcuts__row" key={`${shortcut.action}-${shortcut.keys.join('+')}`}>
                      <span>{shortcut.action}</span>
                      <span className="shortcuts__keys">
                        {shortcut.keys.map((key) => (
                          <kbd key={key}>{getDisplayKey(key)}</kbd>
                        ))}
                      </span>
                    </div>
                  ))}
                </section>
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
