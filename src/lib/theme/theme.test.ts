// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { breakLocalStorage, mockSystemTheme } from './testUtils'
import {
  nextPreference,
  readThemePreference,
  resolveTheme,
  systemPrefersDark,
  writeThemePreference,
} from './theme'

afterEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('resolveTheme', () => {
  it('follows the OS in system mode', () => {
    expect(resolveTheme('system', true)).toBe('dark')
    expect(resolveTheme('system', false)).toBe('light')
  })

  it('ignores the OS for an explicit choice', () => {
    expect(resolveTheme('light', true)).toBe('light')
    expect(resolveTheme('dark', false)).toBe('dark')
  })
})

describe('nextPreference', () => {
  it('cycles system → light → dark → system', () => {
    expect(nextPreference('system')).toBe('light')
    expect(nextPreference('light')).toBe('dark')
    expect(nextPreference('dark')).toBe('system')
  })
})

describe('readThemePreference', () => {
  it('defaults to system when nothing is saved', () => {
    expect(readThemePreference()).toBe('system')
  })

  it('reads a saved preference', () => {
    writeThemePreference('dark')
    expect(localStorage.getItem('theme')).toBe('dark')
    expect(readThemePreference()).toBe('dark')
  })

  it('treats an unknown saved value as system', () => {
    localStorage.setItem('theme', 'sepia')
    expect(readThemePreference()).toBe('system')
  })

  it('falls back to system, and writes are ignored, when localStorage is unavailable', () => {
    breakLocalStorage()
    expect(readThemePreference()).toBe('system')
    expect(() => writeThemePreference('dark')).not.toThrow()
  })
})

describe('systemPrefersDark', () => {
  it('reads prefers-color-scheme', () => {
    mockSystemTheme(true)
    expect(systemPrefersDark()).toBe(true)
  })

  it('is false when matchMedia is unavailable', () => {
    vi.stubGlobal('matchMedia', undefined)
    expect(systemPrefersDark()).toBe(false)
  })
})
