import { useEffect, useRef, useState } from 'react'
import type { DeckRef } from '@shared/decks.ts'
import { appPath } from '../../basePath'
import { assetResolverFor } from '../../components/slides/deckContext'
import { ImageUp } from 'lucide-react'
import { Button, cn, SegmentedControl, Sheet } from '../../ui'
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
    // Take focus from the code editor, so Escape and Enter reach the picker.
    const t = setTimeout(() => document.querySelector<HTMLElement>('[role=dialog][aria-label=Images]')?.focus(), 50)
    return () => clearTimeout(t)
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
    <Sheet
      label="Images"
      onClose={onClose}
      animate={false}
      className="tw:max-w-[760px]"
      onKeyDown={(e) => {
        e.stopPropagation()
        if (e.key === 'Escape') onClose()
        // Enter on a button is that button's click (Cancel must not also choose).
        if (e.key === 'Enter' && !(e.target instanceof HTMLButtonElement)) choose(selected)
      }}
    >
      <div className="tw:flex tw:items-center tw:gap-3 tw:border-b tw:border-line tw:px-4 tw:py-3">
        <h2 className="tw:font-display tw:text-[20px] tw:font-semibold">Images</h2>
        <span className="tw:flex-1" />
        <SegmentedControl
          aria-label="Images from"
          value={tab}
          onValueChange={setTab}
          items={[
            { value: 'presentation', label: 'This presentation' },
            { value: 'library', label: 'Library' },
            { value: 'upload', label: 'Upload' },
          ]}
        />
      </div>
      {error && (
        <p role="alert" className="tw:mx-4 tw:mt-3 tw:rounded-lg tw:bg-field tw:px-3 tw:py-2 tw:text-[13px] tw:text-removed">
          {error}
        </p>
      )}
      {tab === 'upload' ? (
        <div className="tw:flex tw:flex-col tw:gap-3 tw:p-4">
          <button
            type="button"
            className="tw:flex tw:h-44 tw:flex-col tw:items-center tw:justify-center tw:gap-2 tw:rounded-xl tw:border-2 tw:border-dashed tw:border-line tw:text-fg-2 tw:hover:bg-field tw:[&_svg]:size-6"
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault()
              void upload(e.dataTransfer.files[0])
            }}
          >
            <ImageUp aria-hidden className="tw:text-muted" />
            Drag & drop or click to browse
            <small className="tw:text-[12px] tw:text-muted">PNG, JPG, GIF or WebP</small>
          </button>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => void upload(e.target.files?.[0])} />
          <fieldset className="tw:flex tw:flex-wrap tw:gap-x-5 tw:gap-y-2 tw:border-0 tw:text-[13px] tw:text-fg-2">
            <legend className="tw:sr-only">Store the upload in</legend>
            <label className="tw:flex tw:items-center tw:gap-2">
              <input type="radio" className="tw:accent-(--sc-focus)" checked={storage === 'presentation'} onChange={() => setStorage('presentation')} /> This presentation
            </label>
            <label className="tw:flex tw:items-center tw:gap-2">
              <input type="radio" className="tw:accent-(--sc-focus)" checked={storage === 'library'} onChange={() => setStorage('library')} /> Library (all presentations)
            </label>
          </fieldset>
        </div>
      ) : (
        <div className="tw:grid tw:max-h-[56vh] tw:grid-cols-[repeat(auto-fill,minmax(150px,1fr))] tw:gap-3 tw:overflow-y-auto tw:p-4">
          {images.length === 0 && <p className="tw:col-span-full tw:py-8 tw:text-center tw:text-muted">No images yet. Upload one, or paste or drop an image into the editor.</p>}
          {images.map((img) => (
            <button
              key={img.path}
              type="button"
              aria-pressed={selected === img.path}
              className={cn('tw:flex tw:flex-col tw:gap-1.5 tw:rounded-lg tw:p-1.5 tw:text-left tw:hover:bg-field', selected === img.path && 'tw:bg-field tw:shadow-[0_0_0_2px_var(--sc-focus)]')}
              onClick={() => setSelected(img.path)}
              onDoubleClick={() => choose(img.path)}
            >
              <img src={src(img.path)} alt="" className="tw:aspect-video tw:w-full tw:rounded-md tw:bg-field tw:object-cover" />
              <span className="tw:truncate tw:text-[12px] tw:text-fg-2">{img.name}</span>
            </button>
          ))}
        </div>
      )}
      <footer className="tw:flex tw:justify-end tw:gap-2 tw:border-t tw:border-line tw:px-4 tw:py-3">
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="primary" disabled={!selected} onClick={() => choose(selected)}>
          Select
        </Button>
      </footer>
    </Sheet>
  )
}
