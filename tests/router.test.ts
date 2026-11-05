import { describe, expect, test } from 'bun:test'
import { appPath, stripBase } from '../src/basePath'
import { canonicalUrl, chatUrl, editorUrl, galleryUrl, homeUrl, isSameDeckView, parseRoute, presentationUrl, routeVault, vaultChatUrl, type ViewState } from '../src/router'

const deck = { source: 'examples', path: 'motion' }
const Content = () => null

describe('parseRoute', () => {
  test('maps every vault URL shape to a route', () => {
    expect(parseRoute('', '')).toEqual({ type: 'root' })
    expect(parseRoute('settings', '')).toEqual({ type: 'settings' })
    expect(parseRoute('v/work', '')).toEqual({ type: 'home', vault: 'work' })
    expect(parseRoute('v/work/', '')).toEqual({ type: 'home', vault: 'work' })
    expect(parseRoute('v/work/gallery', '')).toEqual({ type: 'gallery', vault: 'work' })
    expect(parseRoute('v/work/chat', '')).toEqual({ type: 'chat', vault: 'work', deck: undefined })
    expect(parseRoute('v/work/chat/presentations/q3', '')).toEqual({ type: 'chat', vault: 'work', deck: { source: 'work', path: 'presentations/q3' } })
    expect(parseRoute('v/work/edit/q3', '?slide=3')).toEqual({ type: 'editor', deck: { source: 'work', path: 'q3' } })
    expect(parseRoute('v/examples/motion', '?mode=dev')).toEqual({ type: 'presentation', deck, presenter: false })
    expect(parseRoute('v/examples/motion', '?presenter=true')).toEqual({ type: 'presentation', deck, presenter: true })
    expect(parseRoute('v/my%20vault/my%20deck/', '')).toEqual({ type: 'presentation', deck: { source: 'my vault', path: 'my deck' }, presenter: false })
  })
  test('older URLs still parse, in the default vault unless ?source= names one', () => {
    expect(parseRoute('gallery', '', 'work')).toEqual({ type: 'gallery', vault: 'work', legacy: true })
    expect(parseRoute('chat', '', 'work')).toEqual({ type: 'chat', vault: 'work', legacy: true })
    expect(parseRoute('chat/motion', '', 'work')).toEqual({ type: 'chat', vault: 'work', deck: { source: 'work', path: 'motion' }, legacy: true })
    expect(parseRoute('edit/motion', '', 'work')).toEqual({ type: 'editor', deck: { source: 'work', path: 'motion' }, legacy: true })
    expect(parseRoute('q3', '?source=team&path=presentations%2Fq3', 'work')).toEqual({ type: 'presentation', deck: { source: 'team', path: 'presentations/q3' }, presenter: false, legacy: true })
  })
  test('the vault of a route', () => {
    expect(routeVault(parseRoute('v/work/edit/q3', ''))).toBe('work')
    expect(routeVault(parseRoute('v/work', ''))).toBe('work')
    expect(routeVault(parseRoute('settings', ''))).toBeUndefined()
  })
})

describe('canonicalUrl', () => {
  test('replaces older URLs and keeps flags and the hash', () => {
    expect(canonicalUrl(parseRoute('q3', '?source=team&path=presentations%2Fq3&mode=dev', 'work'), '?source=team&path=presentations%2Fq3&mode=dev', '#slide-2')).toBe('/v/team/presentations/q3?mode=dev#slide-2')
    expect(canonicalUrl(parseRoute('edit/motion', '?slide=3', 'work'), '?slide=3')).toBe('/v/work/edit/motion?slide=3')
    expect(canonicalUrl(parseRoute('gallery', '', 'work'), '')).toBe('/v/work/gallery')
    expect(canonicalUrl(parseRoute('chat', '', 'work'), '')).toBe('/v/work/chat')
    expect(canonicalUrl(parseRoute('v/work/q3', ''), '')).toBeUndefined()
  })
})

describe('isSameDeckView (popstate guard)', () => {
  const presenting: ViewState = { type: 'presentation', deck, content: Content }
  const presenter: ViewState = { type: 'presenter', deck, content: Content }
  const route = parseRoute('v/examples/motion', '')
  const presenterRoute = parseRoute('v/examples/motion', '?presenter=true')

  test('ignores hash-only changes on the deck already shown', () => {
    expect(isSameDeckView(presenting, route)).toBe(true)
    expect(isSameDeckView(presenter, presenterRoute)).toBe(true)
  })
  test('reacts to a different deck, a mode change or another view', () => {
    expect(isSameDeckView(presenting, parseRoute('v/examples/other', ''))).toBe(false)
    expect(isSameDeckView(presenting, parseRoute('v/work/motion', ''))).toBe(false)
    expect(isSameDeckView(presenting, presenterRoute)).toBe(false)
    expect(isSameDeckView({ type: 'home', vault: 'examples' }, route)).toBe(false)
    expect(isSameDeckView(presenting, parseRoute('', ''))).toBe(false)
  })
})

describe('URL builders', () => {
  test('put the vault and the deck path in the URL', () => {
    expect(presentationUrl(deck)).toBe('/v/examples/motion')
    expect(presentationUrl(deck, { dev: true, slide: 4 })).toBe('/v/examples/motion?mode=dev#slide-4')
    expect(editorUrl({ source: 'team', path: 'presentations/q3' }, 2)).toBe('/v/team/edit/presentations/q3?slide=2')
    expect(chatUrl({ source: 'team', path: 'q 3' })).toBe('/v/team/chat/q%203')
    expect(vaultChatUrl('team')).toBe('/v/team/chat')
    expect(homeUrl('team')).toBe('/v/team/')
    expect(homeUrl()).toBe('/')
    expect(galleryUrl('team')).toBe('/v/team/gallery')
  })
  test('every builder round-trips through parseRoute', () => {
    const q3 = { source: 'team', path: 'presentations/q3' }
    expect(parseRoute(presentationUrl(q3).slice(1), '')).toEqual({ type: 'presentation', deck: q3, presenter: false })
    expect(parseRoute(editorUrl(q3).slice(1), '')).toEqual({ type: 'editor', deck: q3 })
    expect(parseRoute(chatUrl(q3).slice(1), '')).toEqual({ type: 'chat', vault: 'team', deck: q3 })
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
