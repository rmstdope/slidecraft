import type { ReactNode } from 'react'
import { Select as S } from 'radix-ui'
import { Check, ChevronDown } from 'lucide-react'
import { cn } from './cn'

export interface SelectOption<T extends string> {
  value: T
  label: ReactNode
}

/** A single-choice dropdown on Radix Select. */
export function Select<T extends string>({
  value,
  onValueChange,
  options,
  placeholder,
  disabled,
  className,
  'aria-label': ariaLabel,
}: {
  value: T | undefined
  onValueChange: (value: T) => void
  options: readonly SelectOption<T>[]
  placeholder?: string
  disabled?: boolean
  className?: string
  'aria-label'?: string
}) {
  return (
    <S.Root value={value} onValueChange={(v) => onValueChange(v as T)} disabled={disabled}>
      <S.Trigger
        aria-label={ariaLabel}
        className={cn(
          'tw:inline-flex tw:h-9 tw:items-center tw:justify-between tw:gap-2 tw:rounded-[9px] tw:bg-field tw:px-3 tw:text-fg tw:outline-none tw:focus-visible:shadow-[0_0_0_2px_var(--sc-focus)] tw:disabled:opacity-50 tw:data-placeholder:text-muted',
          className,
        )}
      >
        <S.Value placeholder={placeholder} />
        <S.Icon>
          <ChevronDown className="tw:size-3.5 tw:text-muted" aria-hidden />
        </S.Icon>
      </S.Trigger>
      <S.Portal>
        <S.Content
          position="popper"
          sideOffset={6}
          className="sc-app tw:z-50 tw:min-w-(--radix-select-trigger-width) tw:overflow-hidden tw:rounded-xl tw:bg-raised tw:p-1 tw:shadow-[0_0_0_1px_var(--sc-line),var(--sc-elev)]"
        >
          <S.Viewport>
            {options.map((o) => (
              <S.Item
                key={o.value}
                value={o.value}
                className="tw:relative tw:flex tw:h-8 tw:cursor-default tw:items-center tw:rounded-lg tw:pr-3 tw:pl-7 tw:text-fg tw:outline-none tw:select-none tw:data-highlighted:bg-field"
              >
                <S.ItemIndicator className="tw:absolute tw:left-2">
                  <Check className="tw:size-3.5" aria-hidden />
                </S.ItemIndicator>
                <S.ItemText>{o.label}</S.ItemText>
              </S.Item>
            ))}
          </S.Viewport>
        </S.Content>
      </S.Portal>
    </S.Root>
  )
}
