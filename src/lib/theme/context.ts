import { createContext } from 'react'
import type { ResolvedTheme, ThemePreference } from './theme'

export interface ThemeState {
  /** What the user picked. */
  preference: ThemePreference
  /** What's showing: the preference, with "system" resolved from the OS. */
  resolved: ResolvedTheme
  setPreference: (preference: ThemePreference) => void
}

export const ThemeContext = createContext<ThemeState | null>(null)
