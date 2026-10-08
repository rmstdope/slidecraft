# House style for the decks in this folder

These rules come from the folder that holds the presentations. On style, language and wording they
take precedence; which components exist and how they work is defined by Slidecraft's own
documentation (`docs/agents/presentation-author.md` in the Slidecraft repository).

- **Language and tone:** declarative, peer-to-peer engineering English. No marketing adjectives:
  show the number or the mechanism instead.
- **Titles:** sentence case, single-line assertions. Let the eyebrow `Subtitle` carry the subject.
- **Punctuation:** no em dashes in slide text.
- **Colour:** one accent per slide. Colour beyond the accent only with a meaning declared in the
  `COLOUR LEGEND` comment after the imports.
- **Notes:** put speaker notes in `<Notes>`; the first line is a time budget, e.g. `4:00-4:50.`; add a
  `Source:` line when facts come from research.
- **Required slides:** a title slide first and a closing slide last; a framed deck also opens
  each part with a section slide.
- **Numbers:** say where every number comes from in the notes, and mark estimates as estimates.
- **Example decks:** `welcome/` demonstrates every feature built so far; keep it working and
  current. `folio-tour/`, `folio-minimal/`, `motion/` and `safe-retries/` each demonstrate one
  thing and follow these rules.
