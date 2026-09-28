import { vi } from 'vitest'

/** A controllable prefers-color-scheme media query for jsdom (which has no matchMedia). */
export function mockSystemTheme(initialDark: boolean) {
  let dark = initialDark
  const listeners = new Set<() => void>()
  const matchMedia = vi.fn((query: string) => ({
    media: query,
    get matches() {
      return dark
    },
    addEventListener: (_: string, fn: () => void) => listeners.add(fn),
    removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
  }))
  vi.stubGlobal('matchMedia', matchMedia)
  return {
    setDark(next: boolean) {
      dark = next
      listeners.forEach((fn) => fn())
    },
    listenerCount: () => listeners.size,
  }
}

/** Makes every localStorage access throw, like blocked site data. */
export function breakLocalStorage() {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new DOMException('denied', 'SecurityError')
  })
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new DOMException('denied', 'SecurityError')
  })
}
