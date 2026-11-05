import type { ReactNode } from 'react'
import { ToggleGroup } from 'radix-ui'
import { cn } from './cn'

export interface Segment<T extends string> {
  value: T
  label: ReactNode
  title?: string
}

/** A row of mutually exclusive choices (views, sort order). Always has one value selected. */
export function SegmentedControl<T extends string>({
  value,
  onValueChange,
  items,
  size = 'md',
  className,
  'aria-label': ariaLabel,
}: {
  value: T
  onValueChange: (value: T) => void
  items: readonly Segment<T>[]
  size?: 'sm' | 'md'
  className?: string
  'aria-label': string
}) {
  return (
    <ToggleGroup.Root
      type="single"
      value={value}
      // Radix sends '' when the active item is clicked again; keep the current value instead.
      onValueChange={(v) => v && onValueChange(v as T)}
      aria-label={ariaLabel}
      className={cn('tw:inline-flex tw:rounded-[10px] tw:bg-field tw:p-[3px]', className)}
    >
      {items.map((item) => (
        <ToggleGroup.Item
          key={item.value}
          value={item.value}
          title={item.title}
          className={cn(
            'tw:inline-flex tw:items-center tw:gap-1.5 tw:rounded-[7px] tw:px-3 tw:font-medium tw:text-fg-2 tw:transition-colors tw:duration-150 tw:hover:text-fg',
            'tw:data-[state=on]:bg-panel tw:data-[state=on]:text-fg tw:data-[state=on]:shadow-hairline',
            size === 'sm' ? 'tw:h-7 tw:text-[13px]' : 'tw:h-[30px]',
          )}
        >
          {item.label}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  )
}
