import { cloneElement, forwardRef, isValidElement, useId, type InputHTMLAttributes, type LabelHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react'
import { cn } from './cn'

const fieldClass =
  'tw:w-full tw:min-w-0 tw:rounded-[9px] tw:border-0 tw:bg-field tw:text-fg tw:placeholder:text-muted tw:outline-none tw:transition-shadow tw:duration-150 tw:focus-visible:shadow-[0_0_0_2px_var(--sc-focus)] tw:disabled:opacity-50'

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...props },
  ref,
) {
  return <input ref={ref} className={cn(fieldClass, 'tw:h-9 tw:px-3', className)} {...props} />
})

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea(
  { className, ...props },
  ref,
) {
  return <textarea ref={ref} className={cn(fieldClass, 'tw:resize-none tw:px-3 tw:py-2', className)} {...props} />
})

/** A label above its control, with an optional hint underneath. */
export function Field({
  label,
  hint,
  error,
  className,
  children,
  ...props
}: LabelHTMLAttributes<HTMLLabelElement> & { label: ReactNode; hint?: ReactNode; error?: ReactNode }) {
  const noteId = useId()
  const note = error ?? hint
  // The hint or error describes the control (the label already names it).
  const control = note && isValidElement<{ 'aria-describedby'?: string }>(children) ? cloneElement(children, { 'aria-describedby': noteId }) : children
  return (
    <label className={cn('tw:flex tw:flex-col tw:gap-1.5', className)} {...props}>
      <span className="tw:text-[13px] tw:font-semibold tw:text-fg">{label}</span>
      {control}
      {error ? (
        <span id={noteId} className="tw:text-[12px] tw:text-removed" role="alert">
          {error}
        </span>
      ) : (
        hint && (
          <span id={noteId} className="tw:text-[12px] tw:text-muted">
            {hint}
          </span>
        )
      )}
    </label>
  )
}
