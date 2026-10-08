/** A deck name from a URL segment: decoded, non-empty, no traversal. */
export function decodeName(segment: string): string | null {
  let name: string
  try {
    name = decodeURIComponent(segment)
  } catch {
    return null
  }
  return name && !name.includes('..') && !name.includes('\0') ? name : null
}
