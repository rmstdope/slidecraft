import { describe, expect, test } from 'bun:test'
import { act, renderHook } from '@testing-library/react'
import { useAutosave, type AutosaveOptions } from '../src/editor/useAutosave'
import { useDom } from './setup/dom'

useDom()

const DELAY = 30
const wait = (ms: number) => act(() => new Promise<void>((r) => setTimeout(r, ms)))

function setup(initial: Partial<AutosaveOptions> = {}) {
  let saves = 0
  const save = () => void saves++
  const hook = renderHook((props: Omit<AutosaveOptions, 'save' | 'delay'>) => useAutosave({ ...props, save, delay: DELAY }), {
    initialProps: { enabled: true, dirty: true, version: 1, ...initial },
  })
  return { ...hook, saves: () => saves }
}

describe('useAutosave', () => {
  test('saves once, a moment after the last edit', async () => {
    const { rerender, saves } = setup()
    await wait(DELAY / 2)
    rerender({ enabled: true, dirty: true, version: 2 })
    await wait(DELAY / 2)
    expect(saves()).toBe(0) // the second edit restarted the delay
    await wait(DELAY)
    expect(saves()).toBe(1)
    await wait(DELAY * 2)
    expect(saves()).toBe(1) // no edit, no new save
  })

  test('does nothing when off or when nothing is unsaved', async () => {
    const off = setup({ enabled: false })
    const clean = setup({ dirty: false })
    await wait(DELAY * 2)
    expect(off.saves()).toBe(0)
    expect(clean.saves()).toBe(0)
  })

  test('turning it off cancels a pending save', async () => {
    const { rerender, saves } = setup()
    rerender({ enabled: false, dirty: true, version: 1 })
    await wait(DELAY * 2)
    expect(saves()).toBe(0)
  })

  test('saves at once when the window loses focus, only when on and dirty', () => {
    const on = setup()
    const off = setup({ enabled: false })
    act(() => void window.dispatchEvent(new Event('blur')))
    expect(on.saves()).toBe(1)
    expect(off.saves()).toBe(0)
  })
})
