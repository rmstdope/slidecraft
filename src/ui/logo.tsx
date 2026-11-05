import { cn } from './cn'

/** The mark: yellow and teal brackets around a dot that follows the text colour. */
export function Logo({ size = 24, withName = false, className }: { size?: number; withName?: boolean; className?: string }) {
  return (
    <span className={cn('tw:inline-flex tw:items-center tw:gap-2.5', className)}>
      <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden={withName ? true : undefined} role={withName ? undefined : 'img'} aria-label={withName ? undefined : 'Slidecraft'}>
        <path d="M5 15V5h10" stroke="var(--sc-brand)" strokeWidth="3.5" fill="none" />
        <path d="M27 17v10H17" stroke="var(--sc-agent)" strokeWidth="3.5" fill="none" />
        <circle cx="16" cy="16" r="3.2" fill="currentColor" />
      </svg>
      {withName && <span className="tw:font-display tw:text-[20px] tw:leading-none tw:font-semibold tw:tracking-[-0.01em]">Slidecraft</span>}
    </span>
  )
}
