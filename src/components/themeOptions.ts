import { Monitor, Moon, Sun, type LucideIcon } from 'lucide-react'
import type { ResolvedTheme, ThemePreference } from '../lib/theme'

export const THEME_OPTIONS: Record<ThemePreference, { label: string; icon: LucideIcon }> = {
  system: { label: 'System', icon: Monitor },
  light: { label: 'Light', icon: Sun },
  dark: { label: 'Dark', icon: Moon },
}

/** "System (dark)" / "Light" / "Dark". */
export function themeLabel(preference: ThemePreference, resolved: ResolvedTheme): string {
  const { label } = THEME_OPTIONS[preference]
  return preference === 'system' ? `${label} (${resolved})` : label
}
