import type { ReactNode } from 'react'
import { Dialog as D, DropdownMenu as M } from 'radix-ui'
import { X } from 'lucide-react'
import { cn } from './cn'

/** A modal dialog with a title, an optional description and a close button. */
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
  onOpenAutoFocus,
  raised = false,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: ReactNode
  description?: ReactNode
  children?: ReactNode
  className?: string
  /** Called as the dialog opens; `preventDefault()` and focus something else to move the initial focus. */
  onOpenAutoFocus?: (event: Event) => void
  /** Above the app's own sheets (z-index 1100), for a dialog opened from one. */
  raised?: boolean
}) {
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className={cn('tw:fixed tw:inset-0 tw:bg-black/40', raised ? 'tw:z-[1200]' : 'tw:z-50')} />
        <D.Content
          onOpenAutoFocus={onOpenAutoFocus}
          className={cn(
            'sc-app tw:fixed tw:top-1/2 tw:left-1/2 tw:flex tw:max-h-[85vh] tw:w-[min(480px,calc(100vw-32px))] tw:-translate-x-1/2 tw:-translate-y-1/2 tw:flex-col tw:gap-4 tw:overflow-auto tw:rounded-2xl tw:bg-raised tw:p-6 tw:shadow-[0_0_0_1px_var(--sc-line),var(--sc-elev)]',
            raised ? 'tw:z-[1200]' : 'tw:z-50',
            className,
          )}
          // Without a description Radix warns unless aria-describedby is explicitly unset.
          {...(description ? {} : { 'aria-describedby': undefined })}
        >
          <div className="tw:flex tw:items-start tw:gap-4">
            <div className="tw:flex tw:flex-1 tw:flex-col tw:gap-1">
              <D.Title className="tw:m-0 tw:font-display tw:text-[22px] tw:leading-tight tw:font-semibold">{title}</D.Title>
              {description && <D.Description className="tw:m-0 tw:text-muted">{description}</D.Description>}
            </div>
            <D.Close aria-label="Close" className="tw:-mt-1 tw:-mr-2 tw:grid tw:size-8 tw:place-items-center tw:rounded-lg tw:text-fg-2 tw:hover:bg-field">
              <X className="tw:size-4" aria-hidden />
            </D.Close>
          </div>
          {children}
        </D.Content>
      </D.Portal>
    </D.Root>
  )
}

export interface MenuItem {
  label: ReactNode
  onSelect: () => void
  icon?: ReactNode
  danger?: boolean
  disabled?: boolean
}

/** A dropdown menu opened from `trigger` (a single focusable element). */
export function Menu({
  trigger,
  items,
  align = 'end',
}: {
  trigger: ReactNode
  items: readonly (MenuItem | 'separator')[]
  align?: 'start' | 'center' | 'end'
}) {
  return (
    <M.Root>
      <M.Trigger asChild>{trigger}</M.Trigger>
      <M.Portal>
        <M.Content
          align={align}
          sideOffset={6}
          className="sc-app tw:z-50 tw:min-w-44 tw:rounded-xl tw:bg-raised tw:p-1 tw:shadow-[0_0_0_1px_var(--sc-line),var(--sc-elev)]"
        >
          {items.map((item, i) =>
            item === 'separator' ? (
              <M.Separator key={i} className="tw:my-1 tw:h-px tw:bg-line" />
            ) : (
              <M.Item
                key={i}
                disabled={item.disabled}
                onSelect={item.onSelect}
                className={cn(
                  'tw:flex tw:h-8 tw:cursor-default tw:items-center tw:gap-2 tw:rounded-lg tw:px-2.5 tw:outline-none tw:select-none tw:data-disabled:opacity-50 tw:data-highlighted:bg-field tw:[&_svg]:size-4',
                  item.danger ? 'tw:text-removed' : 'tw:text-fg',
                )}
              >
                {item.icon}
                {item.label}
              </M.Item>
            ),
          )}
        </M.Content>
      </M.Portal>
    </M.Root>
  )
}
