import { describe, expect, test } from 'bun:test'
import type { PresentationInfo } from '../shared/decks.ts'
import { createScheduler } from '../src/gallery/scheduler'
import { itemWords, matchesQuery, searchItems } from '../src/gallery/search'
import { DEFAULT_FILTERS, displayName, filterDecks, filtersFromSearch, searchFromFilters } from '../src/home/filterDecks'

const deck = (path: string, source: string, createdAt: number, updatedAt: number): PresentationInfo => ({
  source,
  path,
  name: path.split('/').pop()!,
  createdAt,
  updatedAt,
  readOnly: false,
  builtIn: false,
})

describe('home deck filters', () => {
  const decks = [deck('welcome', 'built-in', 1, 5), deck('quarterly-review', 'team', 3, 9), deck('talks/deck-10', 'team', 2, 1), deck('talks/deck-9', 'team', 2, 1)]

  test('display names capitalise the slug', () => {
    expect(displayName('quarterly-review')).toBe('Quarterly Review')
    expect(displayName('talks/deck-10')).toBe('Deck 10')
  })

  test('source, path and text filters combine; text matches the display name', () => {
    expect(filterDecks(decks, { ...DEFAULT_FILTERS, source: 'team' }).map((d) => d.path)).toEqual(['quarterly-review', 'talks/deck-9', 'talks/deck-10'])
    expect(filterDecks(decks, { ...DEFAULT_FILTERS, path: 'TALKS/' }).map((d) => d.path)).toEqual(['talks/deck-9', 'talks/deck-10'])
    expect(filterDecks(decks, { ...DEFAULT_FILTERS, q: 'quarterly review' }).map((d) => d.path)).toEqual(['quarterly-review'])
  })

  test('sorts by update, creation or name with a numeric tiebreak', () => {
    expect(filterDecks(decks, DEFAULT_FILTERS).map((d) => d.path)).toEqual(['quarterly-review', 'welcome', 'talks/deck-9', 'talks/deck-10'])
    expect(filterDecks(decks, { ...DEFAULT_FILTERS, sort: 'created' }).map((d) => d.path)).toEqual(['quarterly-review', 'talks/deck-9', 'talks/deck-10', 'welcome'])
    expect(filterDecks(decks, { ...DEFAULT_FILTERS, sort: 'alphabetical' }).map((d) => d.name)).toEqual(['deck-9', 'deck-10', 'quarterly-review', 'welcome'])
  })

  test('filters round-trip through the URL and defaults stay out of it', () => {
    const f = { q: 'q r', source: 'team', path: 'talks/', sort: 'alphabetical' as const }
    expect(filtersFromSearch(searchFromFilters(f))).toEqual(f)
    expect(searchFromFilters(DEFAULT_FILTERS)).toBe('')
    expect(filtersFromSearch('?sort=nonsense').sort).toBe('updated')
  })
})

describe('gallery search', () => {
  const items = [
    { name: 'ComparisonTable', description: 'Rows of options against criteria.', keywords: ['versus'] },
    { name: 'CycleDiagram', description: 'Steps arranged in a loop.', useCases: ['A recurring process'] },
    { name: 'Stat', description: 'A big number with a label.' },
  ]

  test('words come from name, description, keywords and use cases', () => {
    expect(itemWords(items[1])).toEqual(expect.arrayContaining(['cyclediagram', 'loop', 'recurring']))
  })

  test('substring or five-letter stem; every token must match', () => {
    expect(matchesQuery(itemWords(items[0]), 'compare')).toBe(true)
    expect(matchesQuery(itemWords(items[1]), 'diagrams')).toBe(true)
    expect(matchesQuery(itemWords(items[1]), 'loop number')).toBe(false)
    expect(searchItems(items, '').map((i) => i.name)).toEqual(['ComparisonTable', 'CycleDiagram', 'Stat'])
    expect(searchItems(items, 'big num').map((i) => i.name)).toEqual(['Stat'])
  })
})

describe('preview scheduler', () => {
  test('runs at most the limit at once, the rest in order', async () => {
    const scheduler = createScheduler(2)
    const started: number[] = []
    const releases: (() => void)[] = []
    const jobs = [0, 1, 2, 3].map((i) =>
      scheduler.run(
        () =>
          new Promise<number>((resolve) => {
            started.push(i)
            releases.push(() => resolve(i))
          }),
      ),
    )
    expect(started).toEqual([0, 1])
    expect(scheduler.queued).toBe(2)
    releases[0]()
    await jobs[0]
    await Promise.resolve()
    expect(started).toEqual([0, 1, 2])
    releases[1]()
    releases[2]()
    await Promise.all(jobs.slice(1, 3))
    await Promise.resolve()
    releases[3]()
    expect(await Promise.all(jobs)).toEqual([0, 1, 2, 3])
  })

  test('a failing job frees its slot', async () => {
    const scheduler = createScheduler(1)
    const failed = scheduler.run(() => Promise.reject(new Error('x')))
    const next = scheduler.run(() => Promise.resolve('ok'))
    await expect(failed).rejects.toThrow('x')
    expect(await next).toBe('ok')
  })
})
