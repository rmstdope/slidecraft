import type { ComponentType, ReactElement, ReactNode } from 'react'
import { countSteps } from '../animations/steps'

/**
 * The build steps of a compiled preview. A compiled MDX module is a plain function of its props
 * (no hooks), so its element tree can be built outside rendering and counted like a deck slide.
 */
export function countPreviewSteps(Component: ComponentType): number {
  try {
    const outer = (Component as () => ReactElement)()
    const inner = typeof outer?.type === 'function' ? (outer.type as (props: unknown) => ReactNode)(outer.props) : outer
    return countSteps(inner)
  } catch {
    return 0
  }
}
