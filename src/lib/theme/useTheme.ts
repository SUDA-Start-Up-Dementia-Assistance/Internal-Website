import { useContext } from 'react'
import { ThemeContext, type ThemeState } from './context'

export function useTheme(): ThemeState {
  const theme = useContext(ThemeContext)
  if (!theme) throw new Error('useTheme must be used inside <ThemeProvider>.')
  return theme
}
