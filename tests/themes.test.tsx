import { describe, expect, test } from 'bun:test'
import { render } from '@testing-library/react'
import { mergeThemeSpecs, parseThemeSpec } from '../shared/themes.ts'
import { Presentation, Slide, Subtitle, Text, Title } from '../src/components/slides'
import { DeckContext, assetResolverFor } from '../src/components/slides/deckContext'
import { listThemes, registerTheme, resolveTheme, themeAssetUrl, unregisterSource } from '../src/themes/registry'
import { resolveSlideLook } from '../src/themes/resolveSlideLook'
import { fontFaceCss, fontFamilyName, themeCssVars } from '../src/themes/themeStyle'
import { useDom } from './setup/dom'

useDom()

describe('theme.json validation', () => {
  test('keeps valid fields and reports invalid ones', () => {
    const { spec, errors } = parseThemeSpec({
      name: 'Acme',
      tokens: { accents: { yellow: '#ff0', purple: '#f0f' }, dark: { bg: 1 } },
      frames: { cover: { svg: 'frames/cover.svg', scheme: 'light', padding: [1, 2, 3] }, 'Bad Name': {} },
      constraints: { schemes: ['sepia'] },
    })
    expect(spec?.tokens?.accents).toEqual({ yellow: '#ff0' })
    expect(spec?.frames?.cover).toMatchObject({ svg: 'frames/cover.svg', scheme: 'light' })
    expect(spec?.frames?.cover.padding).toBeUndefined()
    expect(errors.join('\n')).toContain('tokens.accents.purple')
    expect(errors.join('\n')).toContain('tokens.dark.bg')
    expect(errors.join('\n')).toContain('frames.cover.padding')
    expect(errors.join('\n')).toContain('frames.Bad Name')
    expect(errors.join('\n')).toContain('constraints.schemes')
  })

  test('rejects non-objects and requires a name', () => {
    expect(parseThemeSpec('nope').spec).toBeNull()
    expect(parseThemeSpec({}).errors).toContain('"name" is required')
  })

  test('merging overrides key by key and frame by frame', () => {
    const merged = mergeThemeSpecs(
      { name: 'Base', tokens: { accents: { yellow: '#111', red: '#222' } }, frames: { a: { padding: [1, 1, 1, 1], gap: 10 } } },
      { name: 'Child', extends: 'base', tokens: { accents: { yellow: '#333' } }, frames: { a: { gap: 20 }, b: { align: 'left' } } },
    )
    expect(merged.name).toBe('Child')
    expect(merged.extends).toBeUndefined()
    expect(merged.tokens?.accents).toEqual({ yellow: '#333', red: '#222' })
    expect(merged.frames).toEqual({ a: { padding: [1, 1, 1, 1], gap: 20 }, b: { align: 'left' } })
  })
})

describe('theme registry', () => {
  test('built-in themes resolve, and every theme sits on top of the default', () => {
    const corporate = resolveTheme('corporate')
    expect(corporate.spec.frames).toHaveProperty('content')
    expect(corporate.spec.tokens?.accents?.teal).toBe('#1f9e89') // inherited from slidecraft
    expect(resolveTheme('paper').spec.tokens?.light?.bg).toBe('#f6f1e7')
    expect(listThemes().map((t) => t.id)).toEqual(expect.arrayContaining(['slidecraft', 'corporate', 'paper']))
  })

  test('an unknown theme falls back to the default and says so', () => {
    const theme = resolveTheme('nope')
    expect(theme.id).toBe('slidecraft')
    expect(theme.errors[0]).toBe('Unknown theme "nope"')
  })

  test('a content-folder theme extends a built-in, keeps its assets in its own folder, and wins over a built-in id', () => {
    registerTheme({
      id: 'acme',
      source: 'team',
      baseUrl: '/content-source/team/themes/acme',
      raw: { name: 'Acme', extends: 'corporate', logos: { onLight: 'logo.svg' }, frames: { title: { svg: 'frames/acme-title.svg' } } },
    })
    registerTheme({ id: 'paper', source: 'team', baseUrl: '/content-source/team/themes/paper', raw: { name: 'Team paper' } })
    const acme = resolveTheme('acme', 'team')
    expect(acme.spec.logos?.onLight).toBe('/content-source/team/themes/acme/logo.svg')
    expect(acme.spec.frames?.title.svg).toBe('/content-source/team/themes/acme/frames/acme-title.svg')
    expect(acme.spec.frames?.section.svg).toContain('section.svg') // still the corporate theme's own file
    expect(acme.spec.frames?.title.padding).toEqual([120, 120, 120, 120]) // merged frame keeps the base's fields
    expect(resolveTheme('paper', 'team').spec.name).toBe('Team paper')
    expect(resolveTheme('paper', 'other').spec.name).toBe('Paper')
    expect(resolveTheme('acme').id).toBe('slidecraft') // not visible outside its source
    expect(listThemes('team').find((t) => t.id === 'paper')?.source).toBe('team')
    unregisterSource('team')
    expect(resolveTheme('acme', 'team').id).toBe('slidecraft')
  })

  test('extends cycles are reported instead of looping', () => {
    registerTheme({ id: 'a', source: 'loop', baseUrl: '/t/a', raw: { name: 'A', extends: 'b' } })
    registerTheme({ id: 'b', source: 'loop', baseUrl: '/t/b', raw: { name: 'B', extends: 'a' } })
    expect(resolveTheme('a', 'loop').errors.join(' ')).toContain('cycle')
    unregisterSource('loop')
  })

  test('asset URLs: relative to the folder, absolute app paths and data URLs pass through', () => {
    const entry = { baseUrl: '/t/x/', assets: { 'frames/a.svg': '/assets/a-123.svg' } }
    expect(themeAssetUrl('./frames/a.svg', entry)).toBe('/assets/a-123.svg')
    expect(themeAssetUrl('logo.png', entry)).toBe('/t/x/logo.png')
    expect(themeAssetUrl('/logo-on-dark.svg', entry)).toBe('/logo-on-dark.svg')
    expect(themeAssetUrl('data:image/png;base64,AA', entry)).toBe('data:image/png;base64,AA')
  })
})

describe('slide look', () => {
  const corporate = resolveTheme('corporate')
  const slidecraft = resolveTheme('slidecraft')

  test('the theme default frame applies unless a slide names another or "none"', () => {
    expect(resolveSlideLook({}, corporate).frameName).toBe('content')
    expect(resolveSlideLook({ frame: 'title' }, corporate)).toMatchObject({ frameName: 'title', layout: 'centered' })
    expect(resolveSlideLook({ frame: 'none', scheme: 'dark' }, corporate)).toMatchObject({ frame: undefined, scheme: 'light' }) // constraint
    expect(resolveSlideLook({}, slidecraft).frame).toBeUndefined()
  })

  test('constraints and frames win over slide props; theme defaults fill the gaps', () => {
    expect(resolveSlideLook({ scheme: 'dark', gradient: 'radial' }, corporate)).toMatchObject({ scheme: 'light', gradient: 'none', layout: 'document' })
    expect(resolveSlideLook({}, resolveTheme('paper'))).toMatchObject({ scheme: 'light', accent: 'yellow', transition: 'slide' })
    expect(resolveSlideLook({ frame: 'missing' }, corporate)).toMatchObject({ frameName: 'missing', frame: undefined })
  })
})

describe('frame furniture', () => {
  test('a frame that does not mention the logo keeps the theme placement; null hides it', () => {
    registerTheme({ id: 'furn', source: 'fx', baseUrl: '/t/furn', raw: { name: 'F', frames: { plain: { layout: 'document' }, bare: { logo: null } } } })
    const deck = { source: 'fx', path: 'd' }
    const view = (frame: string) =>
      render(
        <DeckContext.Provider value={{ deck, resolveAsset: assetResolverFor(deck) }}>
          <Slide theme="furn" frame={frame}><Title>T</Title></Slide>
        </DeckContext.Provider>,
      ).container
    expect(view('plain').querySelector('.slide__logo')).not.toBeNull()
    expect(view('plain').querySelector('.slide__footer-rule')).not.toBeNull()
    expect(view('bare').querySelector('.slide__logo')).toBeNull()
    unregisterSource('fx')
  })
})

describe('theme styling', () => {
  test('tokens become scoped CSS variables', () => {
    const vars = themeCssVars(resolveTheme('paper')) as Record<string, string>
    expect(vars['--light-bg']).toBe('#f6f1e7')
    expect(vars['--brand-yellow']).toBe('#c98a00')
    expect(vars['--font-display']).toBe("'Zilla Slab', Georgia, serif")
  })

  test('fonts with files load under a theme-private family', () => {
    registerTheme({ id: 'fonty', source: 'f', baseUrl: '/t/fonty', raw: { name: 'Fonty', fonts: { display: { family: 'Acme Serif', fallback: 'serif', files: [{ src: 'fonts/acme.woff2', weight: 600 }] } } } })
    const theme = resolveTheme('fonty', 'f')
    expect(fontFamilyName(theme, 'display')).toBe('st-f-fonty-display')
    expect(fontFamilyName(theme, 'body')).toBe('Source Sans 3')
    expect(fontFaceCss(theme)).toContain('url("/t/fonty/fonts/acme.woff2")')
    expect((themeCssVars(theme) as Record<string, string>)['--font-display']).toBe("'st-f-fonty-display', serif")
    unregisterSource('f')
  })
})

describe('themes in decks', () => {
  test('a deck theme reaches every slide; a slide can borrow another theme', () => {
    window.history.replaceState(null, '', '/demo?pdf=1')
    const { container } = render(
      <Presentation theme="corporate">
        <Slide frame="title"><Title>Opener</Title><Subtitle>Sub</Subtitle></Slide>
        <Slide><Subtitle>Eyebrow</Subtitle><Title>Content</Title><Text>Body</Text></Slide>
        <Slide theme="slidecraft" scheme="dark"><Title>Guest</Title></Slide>
      </Presentation>,
    )
    const slides = Array.from(container.querySelectorAll('.slide')) as HTMLElement[]
    expect(slides.map((s) => s.getAttribute('data-frame'))).toEqual(['title', 'content', null])
    expect(slides.map((s) => s.getAttribute('data-scheme'))).toEqual(['light', 'light', 'dark'])
    expect((slides[0].querySelector('h1') as HTMLElement).style.fontSize).toBe('116px')
    expect((slides[0].querySelector('h2') as HTMLElement).style.textTransform).toBe('none') // sub-headline
    expect((slides[1].querySelector('span') as HTMLElement).style.textAlign).toBe('left') // left-aligned frame
    window.history.replaceState(null, '', '/demo')
  })

  test('content-folder themes resolve for decks in their own source', () => {
    registerTheme({ id: 'acme', source: 'team', baseUrl: '/content-source/team/themes/acme', raw: { name: 'Acme', tokens: { dark: { bg: '#000033' } } } })
    const deck = { source: 'team', path: 'q3' }
    const { container } = render(
      <DeckContext.Provider value={{ deck, resolveAsset: assetResolverFor(deck) }}>
        <Slide theme="acme"><Title>T</Title></Slide>
      </DeckContext.Provider>,
    )
    expect((container.querySelector('.slide') as HTMLElement).style.getPropertyValue('--dark-bg')).toBe('#000033')
    unregisterSource('team')
  })
})
