/** Gallery search (Part 3 §7): token match with a five-letter stem fallback. */
export interface SearchableItem {
  name: string
  description: string
  keywords?: string[]
  useCases?: string[]
}

const tokens = (text: string): string[] => text.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)

/** "CycleDiagram" → "CycleDiagram Cycle Diagram", so name parts match on their own. */
const withCamelParts = (name: string) => `${name} ${name.replace(/([a-z0-9])([A-Z])/g, '$1 $2')}`

export const itemWords = (item: SearchableItem): string[] =>
  tokens([withCamelParts(item.name), item.description, ...(item.keywords ?? []), ...(item.useCases ?? [])].join(' '))

/**
 * Every query token must be a substring of some word, or share its first five characters with
 * one (both at least five long), so "compare" finds "comparison".
 */
export function matchesQuery(words: readonly string[], query: string): boolean {
  return tokens(query).every((q) => words.some((w) => w.includes(q) || (q.length >= 5 && w.length >= 5 && w.slice(0, 5) === q.slice(0, 5))))
}

export function searchItems<T extends SearchableItem>(items: readonly T[], query: string): T[] {
  return items.filter((i) => matchesQuery(itemWords(i), query)).sort((a, b) => a.name.localeCompare(b.name))
}
