import { bundledDeckNames } from '../deckLoading'

interface HomeStubProps {
  onPresent: (name: string) => void
  onGallery: () => void
  onChat: () => void
}

/** Minimal home page until Phase 7 builds the real one. */
export function HomeStub({ onPresent, onGallery, onChat }: HomeStubProps) {
  const decks = bundledDeckNames()
  return (
    <main className="placeholder home-stub">
      <h1>Slidecraft</h1>
      <p className="muted">Decks as MDX, rendered with React and motion.</p>
      <nav className="home-stub__actions">
        <button type="button" className="pill-button" onClick={onGallery}>
          Component gallery
        </button>
        <button type="button" className="pill-button" onClick={onChat}>
          Chat
        </button>
      </nav>
      {decks.length === 0 ? (
        <p className="muted">
          No presentations found. Create a folder in <code>content/</code> with an <code>index.mdx</code> file.
        </p>
      ) : (
        <ul className="home-stub__decks">
          {decks.map((name) => (
            <li key={name}>
              <button type="button" className="pill-button" onClick={() => onPresent(name)}>
                {name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
