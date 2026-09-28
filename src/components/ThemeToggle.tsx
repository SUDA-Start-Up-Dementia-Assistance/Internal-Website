import { nextPreference, useTheme } from '../lib/theme'
import { THEME_OPTIONS, themeLabel } from './themeOptions'

/** Navbar icon button cycling system → light → dark, with a tooltip on hover and focus. */
export default function ThemeToggle() {
  const { preference, resolved, setPreference } = useTheme()
  const { icon: Icon } = THEME_OPTIONS[preference]
  const next = THEME_OPTIONS[nextPreference(preference)].label
  const current = themeLabel(preference, resolved)

  return (
    <div className="group relative">
      <button
        type="button"
        onClick={() => setPreference(nextPreference(preference))}
        aria-label={`Theme: ${current}. Switch to ${next}.`}
        className="flex rounded-full p-2 text-on-nav/85 transition-colors hover:bg-on-nav/10 hover:text-on-nav"
      >
        <Icon aria-hidden="true" className="size-5" />
      </button>
      <span
        aria-hidden="true"
        className="shadow-card pointer-events-none absolute top-full left-1/2 z-50 mt-2 -translate-x-1/2 rounded-md bg-surface-raised px-2.5 py-1 text-xs whitespace-nowrap text-ink opacity-0 transition-opacity group-hover:opacity-100 group-has-focus-visible:opacity-100"
      >
        Theme: {current}
      </span>
    </div>
  )
}
