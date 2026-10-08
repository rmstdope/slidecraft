import type { ComponentProps } from 'react'
import * as slideComponents from './slides'

/**
 * The MDX component scope (Part 1 §13.1). `p` becomes a div because MDX wraps block content
 * in paragraphs, which would otherwise nest divs inside <p>.
 */
export const mdxComponentScope = {
  p: (props: ComponentProps<'div'>) => <div {...props} />,
  ...slideComponents,
}

export type MdxComponentScope = typeof mdxComponentScope
