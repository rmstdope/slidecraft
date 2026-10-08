import { Children, isValidElement, type ReactNode } from 'react'

/** Flatten children to their plain text, so wording changes can trigger a refit. */
export function textSignature(node: ReactNode): string {
  let out = ''
  Children.forEach(node, (child) => {
    if (typeof child === 'string' || typeof child === 'number') out += String(child)
    else if (isValidElement<{ children?: ReactNode }>(child)) out += textSignature(child.props.children)
  })
  return out
}
