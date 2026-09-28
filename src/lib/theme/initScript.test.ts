// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import html from '../../../index.html?raw'
import { breakLocalStorage, mockSystemTheme } from './testUtils'

/** The no-flash script inlined in index.html's <head>, run as the browser would. */
const script = /<script>([\s\S]*?)<\/script>/.exec(html)?.[1] ?? ''
const runInitScript = () => new Function(script)()
const htmlTheme = () => document.documentElement.getAttribute('data-theme')

afterEach(() => {
  localStorage.clear()
  document.documentElement.removeAttribute('data-theme')
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('index.html theme init script', () => {
  it('comes before any stylesheet, so the first paint is already themed', () => {
    expect(script).toContain('data-theme')
    expect(html.indexOf('<script>')).toBeLessThan(html.indexOf('stylesheet'))
  })

  it('uses a saved light or dark preference, whatever the OS says', () => {
    mockSystemTheme(true)
    localStorage.setItem('theme', 'light')
    runInitScript()
    expect(htmlTheme()).toBe('light')
    localStorage.setItem('theme', 'dark')
    mockSystemTheme(false)
    runInitScript()
    expect(htmlTheme()).toBe('dark')
  })

  it('resolves system (or nothing saved) from prefers-color-scheme', () => {
    mockSystemTheme(true)
    runInitScript()
    expect(htmlTheme()).toBe('dark')
    localStorage.setItem('theme', 'system')
    mockSystemTheme(false)
    runInitScript()
    expect(htmlTheme()).toBe('light')
  })

  it('still resolves from the OS when localStorage is unavailable', () => {
    breakLocalStorage()
    mockSystemTheme(true)
    runInitScript()
    expect(htmlTheme()).toBe('dark')
  })

  it('falls back to light when matchMedia is unavailable', () => {
    vi.stubGlobal('matchMedia', undefined)
    runInitScript()
    expect(htmlTheme()).toBe('light')
  })
})
