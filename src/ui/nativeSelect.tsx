import { forwardRef, type SelectHTMLAttributes } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from './cn'

/**
 * A native <select> in the chrome's look, for dense toolbars and option lists with an empty value
 * (Radix Select has none). `size="sm"` fits a 28 px toolbar.
 */
export const NativeSelect = forwardRef<HTMLSelectElement, Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'> & { size?: 'sm' | 'md' }>(function NativeSelect(
  { className, size = 'md', children, ...props },
  ref,
) {
  return (
    <span className={cn('tw:relative tw:inline-flex tw:shrink-0', className)}>
      <select
        ref={ref}
        className={cn(
          'tw:cursor-pointer tw:appearance-none tw:rounded-[9px] tw:border-0 tw:bg-field tw:pr-7 tw:text-fg tw:outline-none tw:focus-visible:shadow-[0_0_0_2px_var(--sc-focus)] tw:disabled:cursor-default tw:disabled:opacity-50',
          size === 'sm' ? 'tw:h-7 tw:rounded-md tw:pl-2 tw:text-[12px]' : 'tw:h-9 tw:w-full tw:min-w-0 tw:pl-3',
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown aria-hidden className="tw:pointer-events-none tw:absolute tw:top-1/2 tw:right-2 tw:size-3.5 tw:-translate-y-1/2 tw:text-muted" />
    </span>
  )
})
