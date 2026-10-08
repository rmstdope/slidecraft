/**
 * Index just past the `>` that ends the opening tag starting at `from` (which points at `<`).
 * Quotes and `{…}` expressions are skipped, so `x={a > b}` does not end the tag.
 */
export function openingTagEnd(text: string, from = 0): number {
  let depth = 0
  let quote: string | null = null
  for (let i = from + 1; i < text.length; i++) {
    const c = text[i]
    if (quote) {
      if (c === quote) quote = null
    } else if (depth > 0) {
      if (c === '{') depth++
      else if (c === '}') depth--
      else if (c === '"' || c === "'" || c === '`') {
        const close = text.indexOf(c, i + 1)
        if (close !== -1) i = close
      }
    } else if (c === '"' || c === "'") quote = c
    else if (c === '{') depth++
    else if (c === '>') return i + 1
  }
  return -1
}
