import { readPreference, writePreference } from '../storage'

/**
 * Theme resolution. index.html has a tiny inline copy of readThemePreference + resolveTheme
 * that sets data-theme before first paint; keep the two in sync.
 */
export const THEME_PREFERENCES = ['system', 'light', 'dark'] as const
export type ThemePreference = (typeof THEME_PREFERENCES)[number]
export type ResolvedTheme = 'light' | 'dark'

export const THEME_STORAGE_KEY = 'theme'
export const DARK_QUERY = '(prefers-color-scheme: dark)'

/** The toggle's cycle: system → light → dark → system. */
export function nextPreference(preference: ThemePreference): ThemePreference {
  return THEME_PREFERENCES[(THEME_PREFERENCES.indexOf(preference) + 1) % THEME_PREFERENCES.length]
}

export function resolveTheme(preference: ThemePreference, systemDark: boolean): ResolvedTheme {
  if (preference === 'system') return systemDark ? 'dark' : 'light'
  return preference
}

/** The saved preference; "system" when none is saved or storage is unavailable. */
export function readThemePreference(): ThemePreference {
  return readPreference(THEME_STORAGE_KEY, THEME_PREFERENCES, 'system')
}

export function writeThemePreference(preference: ThemePreference): void {
  writePreference(THEME_STORAGE_KEY, preference)
}

/** Whether the OS prefers dark. False when matchMedia is unavailable. */
export function systemPrefersDark(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia(DARK_QUERY).matches
}

/** Sets <html data-theme>, and matches the browser chrome (mobile address bar) to the navbar. */
export function applyTheme(theme: ResolvedTheme): void {
  const root = document.documentElement
  root.dataset.theme = theme
  const nav = getComputedStyle(root).getPropertyValue('--nav').trim()
  if (nav) document.querySelector('meta[name="theme-color"]')?.setAttribute('content', nav)
}
