import { describe, expect, test } from 'bun:test'
import { appPath, stripBase } from '../src/basePath'
import { chatUrl, editorUrl, isSameDeckView, parseRoute, presentationUrl, resolveRouteDeck, type ViewState } from '../src/router'

const deck = { source: 'built-in', path: 'motion' }
const Content = () => null

describe('parseRoute', () => {
  test('maps every URL shape to a route', () => {
    expect(parseRoute('', '')).toEqual({ type: 'home' })
    expect(parseRoute('gallery', '')).toEqual({ type: 'gallery' })
    expect(parseRoute('chat', '')).toEqual({ type: 'chat' })
    expect(parseRoute('chat/motion', '')).toEqual({ type: 'chat', name: 'motion' })
    expect(parseRoute('edit/motion', '?slide=3')).toEqual({ type: 'editor', name: 'motion' })
    expect(parseRoute('motion', '?mode=dev')).toEqual({ type: 'presentation', name: 'motion', presenter: false })
    expect(parseRoute('motion', '?presenter=true')).toEqual({ type: 'presentation', name: 'motion', presenter: true })
    expect(parseRoute('my%20deck/', '')).toEqual({ type: 'presentation', name: 'my deck', presenter: false })
  })
})

describe('resolveRouteDeck', () => {
  test('falls back to the default source and the route name', () => {
    expect(resolveRouteDeck('motion', '', 'built-in')).toEqual(deck)
  })
  test('query parameters qualify the deck', () => {
    expect(resolveRouteDeck('q3', '?source=team&path=presentations%2Fq3', 'built-in')).toEqual({
      source: 'team',
      path: 'presentations/q3',
    })
  })
})

describe('isSameDeckView (popstate guard)', () => {
  const presenting: ViewState = { type: 'presentation', deck, content: Content }
  const presenter: ViewState = { type: 'presenter', deck, content: Content }
  const route = parseRoute('motion', '')
  const presenterRoute = parseRoute('motion', '?presenter=true')

  test('ignores hash-only changes on the deck already shown', () => {
    expect(isSameDeckView(presenting, route, deck)).toBe(true)
    expect(isSameDeckView(presenter, presenterRoute, deck)).toBe(true)
  })
  test('reacts to a different deck, a mode change or another view', () => {
    expect(isSameDeckView(presenting, route, { source: 'built-in', path: 'other' })).toBe(false)
    expect(isSameDeckView(presenting, presenterRoute, deck)).toBe(false)
    expect(isSameDeckView({ type: 'home' }, route, deck)).toBe(false)
    expect(isSameDeckView(presenting, parseRoute('', ''), undefined)).toBe(false)
  })
})

describe('URL builders', () => {
  test('carry the source-qualified deck ref', () => {
    expect(presentationUrl(deck)).toBe('/motion?source=built-in&path=motion')
    expect(presentationUrl(deck, { dev: true, slide: 4 })).toBe('/motion?source=built-in&path=motion&mode=dev#slide-4')
    expect(editorUrl({ source: 'team', path: 'presentations/q3' }, 2)).toBe('/edit/q3?source=team&path=presentations%2Fq3&slide=2')
    expect(chatUrl()).toBe('/chat')
  })
})

describe('base path helpers', () => {
  test('appPath prefixes app-absolute paths only', () => {
    expect(appPath('/logo.svg', '/site/app')).toBe('/site/app/logo.svg')
    expect(appPath('data:image/png;base64,AAA', '/site/app')).toBe('data:image/png;base64,AAA')
    expect(appPath('//cdn.example.com/x', '/site/app')).toBe('//cdn.example.com/x')
    expect(appPath('relative.png', '/site/app')).toBe('relative.png')
  })
  test('stripBase removes the base and the leading slash', () => {
    expect(stripBase('/site/app/edit/motion', '/site/app')).toBe('edit/motion')
    expect(stripBase('/site/app', '/site/app')).toBe('')
    expect(stripBase('/site/application', '/site/app')).toBe('site/application')
    expect(stripBase('/motion', '')).toBe('motion')
  })
})
