// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { breakLocalStorage, mockSystemTheme } from './testUtils'
import ThemeProvider from './ThemeProvider'
import { useTheme } from './useTheme'

afterEach(() => {
  cleanup()
  localStorage.clear()
  delete document.documentElement.dataset.theme
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function Probe() {
  const { preference, resolved, setPreference } = useTheme()
  return (
    <>
      <p>
        {preference}/{resolved}
      </p>
      <button onClick={() => setPreference('light')}>light</button>
      <button onClick={() => setPreference('dark')}>dark</button>
      <button onClick={() => setPreference('system')}>system</button>
    </>
  )
}

const renderProbe = () =>
  render(
    <ThemeProvider>
      <Probe />
    </ThemeProvider>,
  )
const htmlTheme = () => document.documentElement.dataset.theme

describe('ThemeProvider', () => {
  it('starts in system mode and resolves it from the OS', () => {
    mockSystemTheme(true)
    renderProbe()
    expect(screen.getByText('system/dark')).toBeTruthy()
    expect(htmlTheme()).toBe('dark')
  })

  it('follows live OS changes in system mode', () => {
    const system = mockSystemTheme(false)
    renderProbe()
    expect(htmlTheme()).toBe('light')
    act(() => system.setDark(true))
    expect(screen.getByText('system/dark')).toBeTruthy()
    expect(htmlTheme()).toBe('dark')
    act(() => system.setDark(false))
    expect(htmlTheme()).toBe('light')
  })

  it('ignores OS changes once the user picks light or dark', () => {
    const system = mockSystemTheme(false)
    renderProbe()
    act(() => screen.getByText('dark').click())
    act(() => system.setDark(false))
    expect(screen.getByText('dark/dark')).toBeTruthy()
    act(() => screen.getByText('light').click())
    act(() => system.setDark(true))
    expect(screen.getByText('light/light')).toBeTruthy()
    expect(htmlTheme()).toBe('light')
  })

  it('saves the preference and restores it on the next load', () => {
    mockSystemTheme(false)
    renderProbe()
    act(() => screen.getByText('dark').click())
    expect(localStorage.getItem('theme')).toBe('dark')
    cleanup()
    renderProbe()
    expect(screen.getByText('dark/dark')).toBeTruthy()
  })

  it('works (unsaved) when localStorage is unavailable', () => {
    mockSystemTheme(true)
    breakLocalStorage()
    renderProbe()
    expect(screen.getByText('system/dark')).toBeTruthy()
    act(() => screen.getByText('light').click())
    expect(screen.getByText('light/light')).toBeTruthy()
    expect(htmlTheme()).toBe('light')
  })

  it('works without matchMedia (treated as light)', () => {
    vi.stubGlobal('matchMedia', undefined)
    renderProbe()
    expect(screen.getByText('system/light')).toBeTruthy()
  })

  it('stops listening to the OS on unmount', () => {
    const system = mockSystemTheme(false)
    renderProbe()
    expect(system.listenerCount()).toBe(1)
    cleanup()
    expect(system.listenerCount()).toBe(0)
  })
})
