import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { Slot } from 'radix-ui'
import { cn } from './cn'

export const buttonVariants = cva(
  'tw:inline-flex tw:items-center tw:justify-center tw:gap-2 tw:rounded-[9px] tw:font-medium tw:whitespace-nowrap tw:transition-[background-color,box-shadow,opacity] tw:duration-150 tw:select-none tw:disabled:opacity-50 tw:[&_svg]:size-4 tw:[&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary: 'tw:bg-primary tw:text-on-primary tw:hover:opacity-90',
        secondary: 'tw:bg-panel tw:text-fg tw:shadow-line tw:hover:bg-field',
        ghost: 'tw:text-fg-2 tw:hover:bg-field tw:hover:text-fg',
        quiet: 'tw:bg-field tw:text-fg-2 tw:hover:text-fg',
        danger: 'tw:bg-removed tw:text-white tw:hover:opacity-90',
      },
      size: {
        sm: 'tw:h-[30px] tw:px-2.5 tw:text-[13px]',
        md: 'tw:h-9 tw:px-3.5',
        lg: 'tw:h-11 tw:px-5 tw:text-[15px]',
        icon: 'tw:size-9 tw:p-0',
        'icon-sm': 'tw:size-[30px] tw:p-0',
      },
    },
    defaultVariants: { variant: 'secondary', size: 'md' },
  },
)

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  /** Render the child element (a link, say) with the button's look instead of a <button>. */
  asChild?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, asChild, type, ...props },
  ref,
) {
  const Comp = asChild ? Slot.Root : 'button'
  return (
    <Comp
      ref={ref}
      type={asChild ? undefined : (type ?? 'button')}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  )
})
