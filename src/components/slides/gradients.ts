export const GRADIENTS = ['none', 'radial', 'radial-accent', 'diagonal', 'spotlight'] as const
export type SlideGradient = (typeof GRADIENTS)[number]

/** The slide accent at an opacity, resolved on the slide root where the accent class sits. */
const a = (pct: number) => `color-mix(in srgb, var(--accent) ${pct}%, transparent)`

/** Background images per scheme (Part 1 §6.4): neutral greys on dark, accent tints on light. */
const gradientMap: Record<'dark' | 'light', Record<Exclude<SlideGradient, 'none'>, string>> = {
  dark: {
    radial: 'radial-gradient(ellipse at center, rgba(72, 72, 72, 0.4) 0%, transparent 70%)',
    'radial-accent': `radial-gradient(ellipse at 30% 70%, ${a(15)} 0%, transparent 50%)`,
    diagonal: 'linear-gradient(135deg, color-mix(in srgb, var(--bg) 85%, white) 0%, var(--bg) 100%)',
    spotlight: 'radial-gradient(ellipse at 50% 0%, rgba(150, 150, 150, 0.3) 0%, transparent 60%)',
  },
  light: {
    radial: `radial-gradient(ellipse 120% 120% at center, transparent 0%, ${a(15)} 40%, ${a(30)} 100%)`,
    'radial-accent': `radial-gradient(ellipse 80% 80% at 85% 15%, ${a(35)} 0%, ${a(15)} 40%, transparent 70%)`,
    diagonal: `linear-gradient(135deg, transparent 0%, ${a(10)} 40%, ${a(22)} 100%)`,
    spotlight: `radial-gradient(ellipse at 50% 0%, ${a(22)} 0%, transparent 70%), radial-gradient(ellipse at 50% 100%, ${a(10)} 0%, transparent 60%)`,
  },
}

export function gradientFor(scheme: 'dark' | 'light', gradient: SlideGradient): string | undefined {
  return gradient === 'none' ? undefined : gradientMap[scheme][gradient]
}
