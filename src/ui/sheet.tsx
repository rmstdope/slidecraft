import type { HTMLAttributes, KeyboardEvent, ReactNode } from 'react'
import { motion } from 'motion/react'
import { Search } from 'lucide-react'
import { cn } from './cn'
import { Kbd } from './misc'

/**
 * The scrim and panel of the app's own overlays (command palette, shortcuts, insert palette, image
 * picker): rendered in place, not portalled, so the player can force its own dark theme with
 * `theme="dark"`. Clicking the scrim closes it.
 */
export function Sheet({
  onClose,
  onKeyDown,
  theme,
  label,
  className,
  children,
  animate = true,
  noAdvance = true,
}: {
  onClose(): void
  onKeyDown?: (e: KeyboardEvent) => void
  /** Forces a theme (the player and presenter are always dark). */
  theme?: 'light' | 'dark'
  label: string
  className?: string
  children: ReactNode
  animate?: boolean
  /** Marks the overlay so the presentation does not advance on clicks inside it. */
  noAdvance?: boolean
}) {
  return (
    <motion.div
      data-sc-theme={theme}
      className="sc-app tw:fixed tw:inset-0 tw:z-[1000] tw:flex tw:items-start tw:justify-center tw:overflow-y-auto tw:bg-black/45 tw:px-4 tw:pt-[10vh] tw:pb-8 tw:backdrop-blur-[3px]"
      initial={animate ? { opacity: 0 } : false}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      onClick={onClose}
      onKeyDown={onKeyDown}
      {...(noAdvance ? { 'data-no-advance': true } : {})}
    >
      <div
        role="dialog"
        aria-label={label}
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className={cn('tw:flex tw:w-full tw:max-w-[600px] tw:flex-col tw:overflow-hidden tw:rounded-2xl tw:bg-raised tw:text-fg tw:shadow-[0_0_0_1px_var(--sc-line),0_24px_60px_rgba(0,0,0,0.35)]', className)}
      >
        {children}
      </div>
    </motion.div>
  )
}

/** The search row at the top of a palette. */
export function SheetSearch({ className, ...props }: HTMLAttributes<HTMLInputElement> & { value: string; placeholder: string; inputRef?: React.Ref<HTMLInputElement> }) {
  const { inputRef, ...rest } = props
  return (
    <div className={cn('tw:flex tw:items-center tw:gap-2.5 tw:border-b tw:border-line tw:px-4', className)}>
      <Search className="tw:size-4 tw:shrink-0 tw:text-muted" aria-hidden />
      <input ref={inputRef} className="tw:h-12 tw:min-w-0 tw:flex-1 tw:border-0 tw:bg-transparent tw:text-[15px] tw:text-fg tw:outline-none tw:placeholder:text-muted" {...rest} />
      <Kbd>Esc</Kbd>
    </div>
  )
}

/** A group heading inside a palette list. */
export const SheetGroup = ({ children }: { children: ReactNode }) => (
  <div className="tw:px-3 tw:pt-3 tw:pb-1 tw:text-[11px] tw:font-semibold tw:tracking-wide tw:text-muted tw:uppercase">{children}</div>
)

/** The classes of a selectable row in a palette list. */
export const sheetRowClass = (selected: boolean) =>
  cn('tw:mx-1.5 tw:flex tw:cursor-pointer tw:items-center tw:gap-3 tw:rounded-lg tw:px-2.5 tw:py-2', selected ? 'tw:bg-field tw:text-fg' : 'tw:text-fg-2')
