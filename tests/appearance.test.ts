import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  APPEARANCE_STORAGE_KEY,
  DARK_ACCENTS,
  DEFAULT_APPEARANCE,
  parseAppearance,
  readAppearance,
  resolveTheme,
  writeAppearance,
  type Appearance,
} from '../src/appearance/appearance'

const ROOT = join(import.meta.dir, '..')

describe('appearance', () => {
  test('defaults to following the system with the violet accent', () => {
    expect(DEFAULT_APPEARANCE).toEqual({ theme: 'system', darkAccent: 'violet' })
    expect(parseAppearance(null)).toEqual(DEFAULT_APPEARANCE)
    expect(parseAppearance('')).toEqual(DEFAULT_APPEARANCE)
  })

  test('keeps valid values and replaces unknown or broken ones', () => {
    expect(parseAppearance('{"theme":"dark","darkAccent":"mint"}')).toEqual({ theme: 'dark', darkAccent: 'mint' })
    expect(parseAppearance('{"theme":"sepia","darkAccent":"teal"}')).toEqual(DEFAULT_APPEARANCE)
    expect(parseAppearance('{"theme":"light"}')).toEqual({ theme: 'light', darkAccent: 'violet' })
    expect(parseAppearance('not json')).toEqual(DEFAULT_APPEARANCE)
    expect(parseAppearance('null')).toEqual(DEFAULT_APPEARANCE)
    expect(parseAppearance('[1,2]')).toEqual(DEFAULT_APPEARANCE)
  })

  test('system resolves to the operating system preference', () => {
    expect(resolveTheme('system', true)).toBe('dark')
    expect(resolveTheme('system', false)).toBe('light')
    expect(resolveTheme('light', true)).toBe('light')
    expect(resolveTheme('dark', false)).toBe('dark')
  })

  test('storage that throws falls back to the defaults and reports a failed write', () => {
    const broken = {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
    }
    expect(readAppearance(broken)).toEqual(DEFAULT_APPEARANCE)
    expect(writeAppearance({ theme: 'dark', darkAccent: 'coral' }, broken)).toBe(false)
  })

  test('a write is read back', () => {
    const map = new Map<string, string>()
    const storage = { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => void map.set(k, v) }
    expect(writeAppearance({ theme: 'light', darkAccent: 'indigo' }, storage)).toBe(true)
    expect(readAppearance(storage)).toEqual({ theme: 'light', darkAccent: 'indigo' })
  })
})

describe('the pre-paint script in index.html', () => {
  const html = readFileSync(join(ROOT, 'index.html'), 'utf8')
  const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1] ?? ''

  /** Runs the inline script against a fake page and returns the attributes it set. */
  function run(stored: string | null, systemDark: boolean, opts: { storageThrows?: boolean } = {}) {
    const attrs: Record<string, string> = {}
    const localStorage = {
      getItem: (k: string) => {
        if (opts.storageThrows) throw new Error('blocked')
        return k === APPEARANCE_STORAGE_KEY ? stored : null
      },
    }
    const document = { documentElement: { setAttribute: (k: string, v: string) => void (attrs[k] = v) } }
    const window = { matchMedia: (q: string) => ({ matches: q === '(prefers-color-scheme: dark)' && systemDark }) }
    new Function('localStorage', 'document', 'window', script)(localStorage, document, window)
    return attrs
  }

  const expected = (a: Appearance, systemDark: boolean) => ({
    'data-sc-theme': resolveTheme(a.theme, systemDark),
    'data-sc-accent': a.darkAccent,
  })

  test('exists and reads the same storage key', () => {
    expect(script).toContain(`'${APPEARANCE_STORAGE_KEY}'`)
  })

  test('lists the same accents as the module', () => {
    expect(script).toContain(`[${DARK_ACCENTS.map((a) => `'${a.id}'`).join(', ')}]`)
  })

  const cases: (string | null)[] = [
    null,
    'garbage',
    '{"theme":"dark","darkAccent":"mint"}',
    '{"theme":"light","darkAccent":"coral"}',
    '{"theme":"system","darkAccent":"indigo"}',
    '{"theme":"sepia","darkAccent":"teal"}',
    'null',
  ]
  for (const stored of cases) {
    for (const systemDark of [true, false]) {
      test(`matches the module for ${stored} with a ${systemDark ? 'dark' : 'light'} system`, () => {
        expect(run(stored, systemDark)).toEqual(expected(parseAppearance(stored), systemDark))
      })
    }
  }

  test('blocked storage gives the defaults', () => {
    expect(run(null, true, { storageThrows: true })).toEqual(expected(DEFAULT_APPEARANCE, true))
  })
})
