import type { ReactNode } from 'react'
import { Popover as P } from 'radix-ui'
import { cn } from './cn'

/** A panel opened from `trigger` (one focusable element), for a few settings at once. */
export function Popover({
  trigger,
  children,
  align = 'end',
  className,
}: {
  trigger: ReactNode
  children: ReactNode
  align?: 'start' | 'center' | 'end'
  className?: string
}) {
  return (
    <P.Root>
      <P.Trigger asChild>{trigger}</P.Trigger>
      <P.Portal>
        <P.Content
          align={align}
          sideOffset={6}
          className={cn('sc-app tw:z-50 tw:w-72 tw:rounded-xl tw:bg-raised tw:p-4 tw:shadow-[0_0_0_1px_var(--sc-line),var(--sc-elev)] tw:outline-none', className)}
        >
          {children}
        </P.Content>
      </P.Portal>
    </P.Root>
  )
}
