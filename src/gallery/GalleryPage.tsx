import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { SlideThumbnail } from '../components/editor/SlideThumbnail'
import { getAllComponents, getAllTemplates, type RegistryConfig } from '../components/slides/defineComponent'
import { useInView } from '../hooks/useInView'
import { searchItems } from './search'
import { useLazyPreview } from './useLazyPreview'

type Tab = 'all' | 'component' | 'template'

const TABS: { value: Tab; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'component', label: 'Components' },
  { value: 'template', label: 'Templates' },
]

const allItems = (): RegistryConfig[] => [...getAllComponents().map((c) => c.registry), ...getAllTemplates()]

/** A registry preview compiled on demand (four at a time) and shown as a still. */
function PreviewFrame({ source, width, eager = false }: { source: string; width: number; eager?: boolean }) {
  const [ref, inView] = useInView<HTMLDivElement>()
  const { Component, error, isCompiling } = useLazyPreview(source, eager || inView)
  return (
    <div ref={ref} className="preview-frame" style={{ width, height: Math.round((width * 1080) / 1920) }}>
      {Component ? (
        <SlideThumbnail scale={width / 1920}>
          <Component />
        </SlideThumbnail>
      ) : (
        <span className={error ? 'preview-frame__error' : 'preview-frame__wait'} title={error ?? undefined}>
          {error ? 'Preview error' : isCompiling ? 'Rendering…' : ''}
        </span>
      )}
    </div>
  )
}

function GalleryCard({ item, onOpen }: { item: RegistryConfig; onOpen(): void }) {
  return (
    <button type="button" className="gallery-card" onClick={onOpen}>
      <PreviewFrame source={item.previewCode} width={360} />
      <span className="gallery-card__caption">
        <span className="gallery-card__name">{item.name}</span>
        <span className="gallery-card__category">{item.category}</span>
        <span className="gallery-card__description">{item.description}</span>
      </span>
    </button>
  )
}

function DetailPanel({ item, onClose }: { item: RegistryConfig; onClose(): void }) {
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    if (!copied) return
    const t = setTimeout(() => setCopied(false), 1500)
    return () => clearTimeout(t)
  }, [copied])
  const copy = () => {
    void navigator.clipboard?.writeText(item.snippet).then(() => setCopied(true))
  }
  return (
    <motion.div className="tool-scrim" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
      <motion.section
        className="gallery-detail"
        role="dialog"
        aria-label={item.name}
        onClick={(e) => e.stopPropagation()}
        initial={{ scale: 0.97 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0.97 }}
        transition={{ duration: 0.15 }}
      >
        <header className="gallery-detail__header">
          <div>
            <h2>{item.name}</h2>
            <p>{item.description}</p>
          </div>
          <button type="button" className="tool-button" onClick={onClose}>
            Close (Esc)
          </button>
        </header>
        <PreviewFrame source={item.previewCode} width={760} eager />
        {item.useCases && item.useCases.length > 0 && (
          <>
            <h3>Use it for</h3>
            <ul className="gallery-detail__uses">
              {item.useCases.map((u) => (
                <li key={u}>{u}</li>
              ))}
            </ul>
          </>
        )}
        {item.category === 'component' && (
          <>
            <h3>Props</h3>
            {item.props.length === 0 ? (
              <p className="muted">No props.</p>
            ) : (
              <table className="gallery-detail__props">
                <thead>
                  <tr>
                    <th>Prop</th>
                    <th>Type</th>
                    <th>Default</th>
                  </tr>
                </thead>
                <tbody>
                  {item.props.map((p) => (
                    <tr key={p.name} title={p.description}>
                      <td>
                        <code>{p.name}</code>
                      </td>
                      <td>
                        <code>{p.type}</code>
                      </td>
                      <td>{p.default ? <code>{p.default}</code> : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
        <div className="gallery-detail__snippet-head">
          <h3>Snippet</h3>
          <button type="button" className="tool-button" onClick={copy}>
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
        <pre className="gallery-detail__snippet">{item.snippet}</pre>
      </motion.section>
    </motion.div>
  )
}

/** Every component and template with a live preview (Part 3 §7). */
export default function GalleryPage({ onExit }: { onExit(): void }) {
  const [query, setQuery] = useState('')
  const [tab, setTab] = useState<Tab>('all')
  const [open, setOpen] = useState<RegistryConfig | null>(null)
  const items = useMemo(allItems, [])
  const visible = useMemo(() => searchItems(items, query).filter((i) => tab === 'all' || i.category === tab), [items, query, tab])
  const groups = [
    { label: 'Components', items: visible.filter((i) => i.category === 'component') },
    { label: 'Templates', items: visible.filter((i) => i.category === 'template') },
  ].filter((g) => g.items.length > 0)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (open) setOpen(null)
      else if (!(e.target instanceof HTMLInputElement && e.target.value)) onExit()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onExit])

  return (
    <div className="gallery">
      <header className="gallery-header">
        <button type="button" className="tool-button" onClick={onExit}>
          ← Home
        </button>
        <h1>Component Gallery</h1>
        <input className="gallery-header__search" type="search" placeholder="Search components and templates…" value={query} autoFocus onChange={(e) => setQuery(e.target.value)} />
        <nav className="gallery-tabs">
          {TABS.map((t) => (
            <button key={t.value} type="button" className={tab === t.value ? 'is-active' : ''} onClick={() => setTab(t.value)}>
              {t.label}
            </button>
          ))}
        </nav>
        <span className="gallery-header__count">
          {visible.length} of {items.length}
        </span>
      </header>
      <main className="gallery-main">
        {groups.length === 0 && <p className="home-empty">Nothing matches “{query}”.</p>}
        {groups.map((g) => (
          <section key={g.label}>
            <h2 className="gallery-section">
              {g.label} ({g.items.length})
            </h2>
            <div className="gallery-grid">
              {g.items.map((item) => (
                <GalleryCard key={item.id} item={item} onOpen={() => setOpen(item)} />
              ))}
            </div>
          </section>
        ))}
      </main>
      <AnimatePresence>{open && <DetailPanel key={open.id} item={open} onClose={() => setOpen(null)} />}</AnimatePresence>
    </div>
  )
}
