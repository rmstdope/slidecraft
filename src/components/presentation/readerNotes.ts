import { Children, cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react'

/** A leading `0:30-1:10`, `[12:00 – 13:15]:` or `(1:00—2:00).` timing range (Part 1 §11.2). */
const TIMING_RE = /^\s*[[(]?\s*\d{1,3}:\d{2}\s*[-–—]\s*\d{1,3}:\d{2}\s*[\])]?\s*[.:;\-–—]?\s*/

export const stripLeadingTimingNotation = (text: string): string => text.replace(TIMING_RE, '')

/** Strips the timing range from the first non-empty text node only; the rest is left alone. */
export function sanitizeReaderNotes(notes: ReactNode): ReactNode {
  let done = false
  const walk = (node: ReactNode): ReactNode => {
    if (done) return node
    if (typeof node === 'string') {
      if (!node.trim()) return node
      done = true
      return stripLeadingTimingNotation(node)
    }
    if (Array.isArray(node)) return Children.map(node, walk)
    if (isValidElement<{ children?: ReactNode }>(node) && node.props.children !== undefined) {
      const children = walk(node.props.children)
      return cloneElement(node as ReactElement<{ children?: ReactNode }>, undefined, children)
    }
    return node
  }
  return walk(notes)
}
