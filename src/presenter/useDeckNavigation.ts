import { useEffect, useMemo, useRef, useState } from 'react'
import { advance, formatSlideHash, goToSlide, INITIAL_NAV, nextSlide, parseSlideHash, prevSlide, retreat, type NavState } from '../components/slides/navigation'
import type { SyncChannel } from './sync'

export interface NavActions {
  advance(): void
  retreat(): void
  nextSlide(): void
  prevSlide(): void
  goTo(index: number, atLastStep?: boolean): void
}

const clampPosition = (p: { current: number; step: number }, stepCounts: number[]) => {
  const current = Math.max(0, Math.min(stepCounts.length - 1, p.current))
  return { current, step: Math.max(0, Math.min(stepCounts[current] ?? 0, p.step)) }
}

/**
 * Deck navigation shared by the audience and presenter windows (Part 1 §3.3–3.4, Part 5 §B.3):
 * the position mirrors into the URL hash and follows the other window through the deck's sync channel.
 */
export function useDeckNavigation(stepCounts: number[], channel: SyncChannel): { nav: NavState; actions: NavActions } {
  const total = stepCounts.length
  // The hash carries the position across reloads and into a newly opened presenter window; a
  // fresh open from the home page starts at the first slide rather than where a past talk ended.
  const [nav, setNav] = useState<NavState>(() => {
    const parsed = parseSlideHash(window.location.hash, stepCounts)
    return parsed ? { ...parsed, direction: 0 } : INITIAL_NAV
  })

  const actions = useMemo<NavActions>(
    () => ({
      advance: () => setNav((s) => advance(s, stepCounts)),
      retreat: () => setNav((s) => retreat(s, stepCounts)),
      nextSlide: () => setNav((s) => nextSlide(s, stepCounts)),
      prevSlide: () => setNav((s) => prevSlide(s)),
      goTo: (index, atLastStep = false) => setNav((s) => goToSlide(s, index, stepCounts, atLastStep)),
    }),
    [stepCounts],
  )

  // A live reload can remove slides; keep the position in range.
  useEffect(() => {
    if (total > 0 && nav.current > total - 1) actions.goTo(total - 1)
  }, [total, nav.current, actions])

  // URL hash mirrors the position. The first write replaces, later ones push history.
  const firstHashWrite = useRef(true)
  useEffect(() => {
    if (total === 0) return
    const hash = formatSlideHash(nav.current, nav.step)
    if (window.location.hash !== hash) {
      if (firstHashWrite.current) window.history.replaceState(window.history.state, '', `${window.location.pathname}${window.location.search}${hash}`)
      else window.location.hash = hash
    }
    firstHashWrite.current = false
  }, [nav.current, nav.step, total])

  // Browser back/forward moves slides and steps.
  useEffect(() => {
    const onHashChange = () => {
      const parsed = parseSlideHash(window.location.hash, stepCounts)
      if (!parsed) return
      setNav((s) => {
        if (s.current === parsed.current && s.step === parsed.step) return s
        const direction = parsed.current !== s.current ? Math.sign(parsed.current - s.current) : parsed.step >= s.step ? 1 : -1
        return { ...parsed, direction }
      })
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [stepCounts])

  // The other window's position arrives here. Positions that came from there are not sent back,
  // or two quick key presses could bounce between the windows.
  const fromRemote = useRef<string | null>(null)
  const navRef = useRef(nav)
  navRef.current = nav
  useEffect(
    () =>
      channel.subscribe((message) => {
        if (message.type === 'hello') {
          channel.post({ type: 'nav', current: navRef.current.current, step: navRef.current.step })
          return
        }
        if (message.type !== 'nav' || total === 0) return
        const target = clampPosition(message, stepCounts)
        fromRemote.current = `${target.current}:${target.step}`
        setNav((s) => {
          if (s.current === target.current && s.step === target.step) return s
          const direction = target.current !== s.current ? Math.sign(target.current - s.current) : target.step >= s.step ? 1 : -1
          return { ...target, direction }
        })
      }),
    [channel, stepCounts, total],
  )

  useEffect(() => {
    if (total === 0) return
    const position = { current: nav.current, step: nav.step }
    const key = `${nav.current}:${nav.step}`
    if (fromRemote.current === key) {
      fromRemote.current = null
      return
    }
    channel.post({ type: 'nav', ...position })
  }, [nav.current, nav.step, total, channel])

  // A newly opened window asks where the other one is.
  useEffect(() => channel.post({ type: 'hello' }), [channel])

  return { nav, actions }
}
