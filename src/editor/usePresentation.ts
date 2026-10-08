/**
 * Editor state for one deck (Part 3 §2.1) on top of the deck model. When the file does not parse,
 * the editor falls back to editing the whole file as one text (raw mode) until it does.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import type { DeckRef } from '@shared/decks.ts'
import {
  insertSlideText,
  isSlideTextHidden,
  modelFromSource,
  moveSlideInModel,
  presentationAttrs,
  removeSlide,
  serializeModel,
  syncComponentImports,
  setPresentationTextAttr,
  setSlideTextAttr,
  updateSlideText,
  type DeckModel,
} from '@shared/deckModel.ts'
import { mdxComponentScope } from '../components/mdxScope'
import { loadMdx, saveMdx } from './api'

export interface PresentationState {
  deck: DeckRef
  readOnly: boolean
  model: DeckModel | null
  /** Set when the file does not parse: the editor edits the whole text. */
  raw: { text: string; error: string } | null
  selectedId: string | null
  isDirty: boolean
  isLoading: boolean
  isSaving: boolean
  error: string | null
}

// `?slide=N` is captured once per URL so StrictMode's double mount cannot lose it.
const initialSlides = new Map<string, number>()
function initialSlideIndex(): number {
  const key = window.location.pathname + window.location.search.replace(/[?&]slide=\d+/, '')
  if (!initialSlides.has(key)) initialSlides.set(key, Math.max(0, Number(new URLSearchParams(window.location.search).get('slide') ?? 1) - 1))
  return initialSlides.get(key)!
}

export function usePresentation(deck: DeckRef) {
  const [state, setState] = useState<PresentationState>({ deck, readOnly: false, model: null, raw: null, selectedId: null, isDirty: false, isLoading: true, isSaving: false, error: null })
  const stateRef = useRef(state)
  const update = useCallback((fn: (s: PresentationState) => PresentationState) => {
    setState((s) => {
      const next = fn(s)
      stateRef.current = next
      return next
    })
  }, [])

  const load = useCallback(
    async (keepIndex?: number) => {
      update((s) => ({ ...s, isLoading: true, error: null }))
      const result = await loadMdx(deck)
      if (!result.data) return update((s) => ({ ...s, isLoading: false, error: result.error ?? 'Could not load the presentation' }))
      const { content, readOnly } = result.data
      try {
        const model = modelFromSource(content)
        const index = Math.min(keepIndex ?? initialSlideIndex(), Math.max(0, model.slides.length - 1))
        update((s) => ({ ...s, readOnly, model, raw: null, selectedId: model.slides[index]?.id ?? null, isDirty: false, isLoading: false }))
      } catch (error) {
        update((s) => ({ ...s, readOnly, model: null, raw: { text: content, error: (error as Error).message }, selectedId: null, isDirty: false, isLoading: false }))
      }
    },
    [deck, update],
  )

  useEffect(() => {
    void load()
  }, [load])

  // Mirror the selection into ?slide=N (replaceState: no history churn).
  const selectedIndex = state.model && state.selectedId ? state.model.slides.findIndex((s) => s.id === state.selectedId) : -1
  useEffect(() => {
    if (selectedIndex < 0) return
    const url = new URL(window.location.href)
    if (url.searchParams.get('slide') !== String(selectedIndex + 1)) {
      url.searchParams.set('slide', String(selectedIndex + 1))
      window.history.replaceState(window.history.state, '', url)
    }
  }, [selectedIndex])

  const editModel = useCallback(
    (fn: (model: DeckModel) => DeckModel) =>
      update((s) => (s.readOnly || !s.model ? s : { ...s, model: fn(s.model), isDirty: true })),
    [update],
  )

  const actions = {
    selectSlide: (id: string) => update((s) => ({ ...s, selectedId: id })),
    selectByOffset: (delta: number) =>
      update((s) => {
        if (!s.model) return s
        const i = s.model.slides.findIndex((x) => x.id === s.selectedId)
        const next = s.model.slides[Math.max(0, Math.min(s.model.slides.length - 1, i + delta))]
        return next ? { ...s, selectedId: next.id } : s
      }),
    updateSelectedSlide: (text: string) => editModel((m) => (stateRef.current.selectedId ? updateSlideText(m, stateRef.current.selectedId, text) : m)),
    addSlide: (template: string) =>
      update((s) => {
        if (s.readOnly || !s.model) return s
        const { model, id } = insertSlideText(s.model, template, s.selectedId ?? undefined)
        return { ...s, model, selectedId: id, isDirty: true }
      }),
    deleteSlide: (id: string) =>
      update((s) => {
        if (s.readOnly || !s.model || s.model.slides.length <= 1) return s
        const index = s.model.slides.findIndex((x) => x.id === id)
        const model = removeSlide(s.model, id)
        const selectedId = s.selectedId === id ? model.slides[Math.min(index, model.slides.length - 1)].id : s.selectedId
        return { ...s, model, selectedId, isDirty: true }
      }),
    moveSlide: (from: number, to: number) => editModel((m) => moveSlideInModel(m, from, to)),
    toggleHidden: (id: string) =>
      editModel((m) => {
        const slide = m.slides.find((s) => s.id === id)
        return slide ? updateSlideText(m, id, setSlideTextAttr(slide.text, 'hidden', isSlideTextHidden(slide.text) ? null : true)) : m
      }),
    setDeckTheme: (theme: string) => editModel((m) => setPresentationTextAttr(m, 'theme', theme ? theme : null)),
    updateRaw: (text: string) => update((s) => (s.readOnly || !s.raw ? s : { ...s, raw: { ...s.raw, text }, isDirty: true })),
    /** Leave raw mode once the whole text parses again. */
    tryStructured: () =>
      update((s) => {
        if (!s.raw) return s
        try {
          const model = modelFromSource(s.raw.text)
          return { ...s, model, raw: null, selectedId: model.slides[0]?.id ?? null }
        } catch (error) {
          return { ...s, raw: { ...s.raw, error: (error as Error).message } }
        }
      }),
    save: async (): Promise<boolean> => {
      const s = stateRef.current
      if (s.readOnly || (!s.model && !s.raw)) return false
      const model = s.model ? syncComponentImports(s.model, Object.keys(mdxComponentScope)) : null
      update((x) => ({ ...x, isSaving: true, model: x.model && model && x.model === s.model ? model : x.model }))
      const content = model ? serializeModel(model) : s.raw!.text
      const result = await saveMdx(deck, content)
      update((x) => ({ ...x, isSaving: false, isDirty: result.error ? x.isDirty : false, error: result.error ?? null }))
      return !result.error
    },
    reload: () => load(Math.max(0, stateRef.current.model?.slides.findIndex((x) => x.id === stateRef.current.selectedId) ?? 0)),
  }

  const selected = state.model?.slides.find((s) => s.id === state.selectedId) ?? null
  const deckTheme = state.model ? presentationAttrs(state.model).theme : undefined
  return { state, actions, selected, selectedIndex, deckTheme: typeof deckTheme === 'string' ? deckTheme : undefined }
}
