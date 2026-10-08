import { afterAll, afterEach, beforeAll } from 'bun:test'
import { GlobalRegistrator } from '@happy-dom/global-registrator'

/**
 * Opt-in DOM for component tests. Registered per file (not as a global preload) so the
 * server tests keep Bun's own fetch, Request and Response.
 */
export function useDom(): void {
  beforeAll(() => GlobalRegistrator.register({ url: 'http://localhost:6100/' }))
  afterEach(async () => {
    const { cleanup } = await import('@testing-library/react')
    cleanup()
  })
  afterAll(async () => {
    // Let React's scheduler flush pending work before the DOM globals disappear.
    await new Promise((resolve) => setTimeout(resolve, 50))
    await GlobalRegistrator.unregister()
  })
}
