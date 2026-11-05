# Themes, frames and colour

## Themes, schemes, frames

- **Theme** (`<Presentation theme="…">`): the deck's look: palette, fonts, logos and slide masters.
  Built in: `slidecraft` (the default), `paper`, `folio` (editorial, with frames) and `ion`
  (futuristic: black slides, metal titles, glowing wires; for a deck asked to look futuristic or
  high-tech). In `ion` the accent names map to blue (yellow), ember (red), aurora green (teal) and
  violet (navy). A vault can add its own themes under `themes/<id>/`; `list_themes` lists
  everything available.
- **Scheme** (`<Slide scheme="dark|light">`): one slide's colour scheme. A theme may restrict it.
- **Frame** (`<Slide frame="…">`): a slide master from the theme, such as folio's `title`,
  `section` and `content`. A theme can give every slide a default frame (folio gives `content`),
  so most slides name none; `frame="none"` opts out.

## Framed decks

A deck asked for as "official", "brand-compliant" or "from the template", or one going to
customers, management or outside the team, uses the organisation's own theme from the vault.
Without it the deck has Slidecraft's look, which does not read as the official template.

- Map the master one to one: `title` for the opener and the closer, `section` for dividers,
  `content` for everything else. Typical shape: title → section → content… → section → content… → title.
- The frame is decoration; the body is ordinary components.
- Frames fix the scheme and turn gradients off: set no `scheme` or `gradient` on framed slides.
- The content frame implies `layout="document"`: eyebrow, then a single-line title.
- `Text` is already left-aligned inside a left-aligned frame.
- Section titles are short (about six words); they sit in a narrow column.
- The frame never scales: a crowded body shrinks to fit while the frame stays put.

## Colour

Every item on a slide takes the slide's `accent`. Headings and layout tell items apart; hue does
not. The audience reads colour as information, so a colour without a meaning reads as a grouping
that is not there.

- Use a second colour only when it encodes something, and make the encoding obvious or state it:
  a verdict (teal fine, yellow caution, red risk), or a key that recurs across the deck.
- To emphasise, colour one item among neutral ones.
- Four peer cards in four accents read as four groups that do not exist. Four plain cards (no
  `accent` on any) read as four peers.

A deck that colours beyond the slide accent declares its vocabulary in a **colour legend**, a
comment directly after the imports:

```mdx
{/*
  COLOUR LEGEND — deck-wide, both directions binding.
  (Same concept → same colour on every slide; a colour is never reused for another meaning.)

  teal   = fine, works
  yellow = caution, needs a decision
  red    = risk

  Everything without one of these meanings takes the slide accent: omit the accent prop.
*/}
```

- A colour whose line you cannot write in a few words is decoration: remove the prop.
- In a deck with a legend, follow it, and extend it before using a new meaning.
- A multi-coloured deck without a legend predates the rule: derive one, or ask the author.
