# Agent personas

Why `AGENTS.md` sends coding agents to one of three guides, and how an agent picks one.

## The problem

One instruction file for every task grows until the rules for one job drown the rules for
another. An agent writing a slide does not need the parser's invariants; an agent fixing the
parser should not be reminded to write speaker notes, and must not "fix" a deck by editing a
component. Splitting by role keeps each guide short and makes the boundaries explicit.

## The three personas

| Persona | Typical requests | Focus on | Do not touch |
|---|---|---|---|
| Presentation Author | "add a slide about…", "make this slide light", "shorten the titles", "make the deck official" | deck files and images | components, editor, server, config |
| Component Developer | "create a Gantt component", "Card needs a size prop", "the timeline should support milestones" | `src/components/slides/`, shared animations, component tests | editor, parser, server, themes |
| Framework Developer | "the editor crashes on save", "add undo", "export is slow", "support a new content source" | `src/`, `shared/`, `server/`, `scripts/`, tests | slide component bodies, deck content |

Trigger words help: *slide, deck, talk, notes, title* point to the author; *component, prop,
registry, gallery* to the component developer; *editor, parser, server, export, crash, bug* to
the framework developer.

## Activation

Three ways an agent can land in the right role:

1. **Ask the user** which kind of task this is. Reliable, but costs a turn.
2. **Detect trigger words** in the request and pick the matching guide.
3. **Switch by file path:** a change under `content/` is author work, under
   `src/components/slides/` component work, anything else framework work.

Slidecraft uses the decision procedure in `AGENTS.md` (content? author; new component? component
developer; otherwise framework developer), helped by trigger words, and asks when a request is
ambiguous. When a request needs two roles (a deck that needs a new component), the agent finishes
one role's part before starting the next.

## Content folders

The server writes a generated `AGENTS.md` into each content folder: the component list and the
author guide, so agents working in a folder of decks (outside this repository) get the author
persona without seeing the rest. A hand-written `AGENTS.md` in a content folder is kept; it
carries house style, and the server prints a hint to point it at the documentation.
