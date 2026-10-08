import { useEffect, useRef, useState } from 'react'
import type { DeckRef } from '@shared/decks.ts'
import { appPath } from '../../basePath'
import { assetResolverFor } from '../../components/slides/deckContext'
import { ACCEPTED_IMAGE_TYPES, listLibraryImages, listPresentationImages, uploadImage, type ImageInfo } from '../api'

type Tab = 'library' | 'presentation' | 'upload'

export interface ImagePickerModalProps {
  isOpen: boolean
  deck: DeckRef
  defaultSource?: string
  onClose(): void
  onSelect(path: string): void
}

/** Pick or upload an image for an image prop (Part 3 §2.12). */
export function ImagePickerModal({ isOpen, deck, defaultSource, onClose, onSelect }: ImagePickerModalProps) {
  const [tab, setTab] = useState<Tab>('presentation')
  const [library, setLibrary] = useState<ImageInfo[]>([])
  const [own, setOwn] = useState<ImageInfo[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [storage, setStorage] = useState<'library' | 'presentation'>('presentation')
  const fileRef = useRef<HTMLInputElement>(null)
  const resolve = assetResolverFor(deck, defaultSource)

  const refresh = async () => {
    const [lib, mine] = await Promise.all([listLibraryImages(), listPresentationImages(deck)])
    setLibrary(lib.data?.images ?? [])
    setOwn(mine.data?.images ?? [])
    setError(lib.error ?? null)
  }

  useEffect(() => {
    if (!isOpen) return
    setSelected(null)
    setError(null)
    void refresh()
  }, [isOpen])

  if (!isOpen) return null
  const choose = (path: string | null) => {
    if (!path) return
    onSelect(path)
    onClose()
  }
  const upload = async (file: File | undefined) => {
    if (!file) return
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) return setError('Use a PNG, JPEG, GIF or WebP image.')
    const result = await uploadImage(file, storage, deck)
    if (!result.data) return setError(result.error ?? 'Upload failed')
    await refresh()
    setSelected(result.data.path)
    setTab(storage)
  }
  const images = tab === 'library' ? library : own
  const src = (path: string) => (path.startsWith('/') ? appPath(path) : resolve(path))

  return (
    <div className="palette-scrim" onClick={onClose}>
      <div
        className="image-picker"
        role="dialog"
        aria-label="Images"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          e.stopPropagation()
          if (e.key === 'Escape') onClose()
          if (e.key === 'Enter') choose(selected)
        }}
      >
        <nav className="image-picker__tabs">
          {(['presentation', 'library', 'upload'] as Tab[]).map((t) => (
            <button key={t} type="button" className={tab === t ? 'is-active' : ''} onClick={() => setTab(t)}>
              {t === 'presentation' ? 'This presentation' : t === 'library' ? 'Library' : 'Upload'}
            </button>
          ))}
        </nav>
        {error && <p className="image-picker__error">{error}</p>}
        {tab === 'upload' ? (
          <div className="image-picker__upload">
            <button
              type="button"
              className="image-picker__drop"
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault()
                void upload(e.dataTransfer.files[0])
              }}
            >
              Drag & drop or click to browse
              <small>PNG, JPG, GIF or WebP</small>
            </button>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => void upload(e.target.files?.[0])} />
            <label>
              <input type="radio" checked={storage === 'presentation'} onChange={() => setStorage('presentation')} /> This presentation
            </label>
            <label>
              <input type="radio" checked={storage === 'library'} onChange={() => setStorage('library')} /> Library (all presentations)
            </label>
          </div>
        ) : (
          <div className="image-picker__grid">
            {images.length === 0 && <p className="image-picker__empty">No images yet. Upload one, or paste or drop an image into the editor.</p>}
            {images.map((img) => (
              <button key={img.path} type="button" className={`image-picker__tile${selected === img.path ? ' is-selected' : ''}`} onClick={() => setSelected(img.path)} onDoubleClick={() => choose(img.path)}>
                <img src={src(img.path)} alt="" />
                <span>{img.name}</span>
              </button>
            ))}
          </div>
        )}
        <footer className="image-picker__footer">
          <button type="button" className="editor-button" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="editor-button is-primary" disabled={!selected} onClick={() => choose(selected)}>
            Select
          </button>
        </footer>
      </div>
    </div>
  )
}
