import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

/** tailwind-merge that knows the `tw:` prefix and the chrome's own colour and shadow names. */
const twMerge = extendTailwindMerge({
  prefix: 'tw',
  extend: {
    theme: {
      color: [
        'ground', 'panel', 'panel-alt', 'raised', 'field', 'line', 'fg', 'fg-2', 'muted', 'primary', 'on-primary',
        'accent', 'accent-tint', 'on-accent-tint', 'focus', 'brand', 'agent', 'agent-glow', 'added', 'removed',
        'canvas', 'canvas-dot',
      ],
      shadow: ['elev', 'line'],
    },
  },
})

/** Joins class names; later Tailwind utilities win over earlier ones they conflict with. */
export const cn = (...inputs: ClassValue[]): string => twMerge(clsx(inputs))
