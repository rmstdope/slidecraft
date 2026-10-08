import type { PresentationInfo } from '@shared/decks.ts'

interface HomeStubProps {
  decks: PresentationInfo[]
  error?: string
  onPresent: (deck: PresentationInfo) => void
  onGallery: () => void
  onChat: () => void
}

/** Minimal home page until Phase 7 builds the real one. */
export function HomeStub({ decks, error, onPresent, onGallery, onChat }: HomeStubProps) {
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
      {error && <p className="error-text">{error}</p>}
      {decks.length === 0 ? (
        <p className="muted">
          No presentations found. Create a folder in the content directory with an <code>index.mdx</code> file.
        </p>
      ) : (
        <ul className="home-stub__decks">
          {decks.map((deck) => (
            <li key={`${deck.source}:${deck.path}`}>
              <button type="button" className="pill-button" onClick={() => onPresent(deck)} title={`${deck.source} / ${deck.path}`}>
                {deck.path}
                {deck.builtIn ? '' : ` · ${deck.source}`}
              </button>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
