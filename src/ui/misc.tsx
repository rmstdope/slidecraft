import type { HTMLAttributes, ReactNode } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { Switch as SwitchPrimitive, Tooltip as TooltipPrimitive } from 'radix-ui'
import { cn } from './cn'

/** A raised surface: the main card, the agent panel, a settings group. */
export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('tw:rounded-2xl tw:bg-panel tw:shadow-line', className)} {...props} />
}

const badgeVariants = cva('tw:inline-flex tw:h-6 tw:items-center tw:gap-1.5 tw:rounded-md tw:px-2 tw:text-[12px] tw:font-medium tw:whitespace-nowrap', {
  variants: {
    tone: {
      neutral: 'tw:bg-field tw:text-fg-2',
      accent: 'tw:bg-accent-tint tw:text-on-accent-tint',
      agent: 'tw:bg-agent-glow tw:text-agent',
      danger: 'tw:bg-field tw:text-removed',
    },
  },
  defaultVariants: { tone: 'neutral' },
})

export function Badge({ tone, className, ...props }: HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />
}

/** The agent's live dot, with a soft halo. */
export function StatusDot({ tone = 'agent', className }: { tone?: 'agent' | 'accent' | 'muted' | 'danger'; className?: string }) {
  const colour = { agent: 'tw:bg-agent tw:shadow-[0_0_0_4px_var(--sc-agent-glow)]', accent: 'tw:bg-accent', muted: 'tw:bg-muted', danger: 'tw:bg-removed' }[tone]
  return <span aria-hidden className={cn('tw:inline-block tw:size-2 tw:shrink-0 tw:rounded-full', colour, className)} />
}

export function Kbd({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return (
    <kbd
      className={cn('tw:inline-flex tw:h-5 tw:items-center tw:rounded-[5px] tw:bg-panel tw:px-1.5 tw:font-mono tw:text-[11px] tw:text-fg-2 tw:shadow-line', className)}
      {...props}
    />
  )
}

export function Switch({
  checked,
  onCheckedChange,
  disabled,
  'aria-label': ariaLabel,
  id,
}: {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  disabled?: boolean
  'aria-label'?: string
  id?: string
}) {
  return (
    <SwitchPrimitive.Root
      id={id}
      checked={checked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
      aria-label={ariaLabel}
      className="tw:relative tw:inline-flex tw:h-6 tw:w-10 tw:shrink-0 tw:items-center tw:rounded-full tw:bg-line tw:p-0.5 tw:transition-colors tw:duration-150 tw:disabled:opacity-50 tw:data-[state=checked]:bg-primary"
    >
      <SwitchPrimitive.Thumb className="tw:block tw:size-5 tw:rounded-full tw:bg-panel tw:shadow-[0_1px_2px_rgba(0,0,0,0.2)] tw:transition-transform tw:duration-150 tw:data-[state=checked]:translate-x-4" />
    </SwitchPrimitive.Root>
  )
}

/** A hover and focus hint. Wrap the app once in TooltipProvider. */
export function Tooltip({ content, children, side = 'bottom' }: { content: ReactNode; children: ReactNode; side?: 'top' | 'bottom' | 'left' | 'right' }) {
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          sideOffset={6}
          className="sc-app tw:z-50 tw:rounded-md tw:bg-primary tw:px-2 tw:py-1 tw:text-[12px] tw:text-on-primary"
        >
          {content}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  )
}

export const TooltipProvider = TooltipPrimitive.Provider
