import { ChevronDown, LayoutDashboard, ListTodo, LogIn, LogOut } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth, type AuthUser } from '../lib/auth'
import { THEME_PREFERENCES, useTheme } from '../lib/theme'
import Avatar from './Avatar'
import { THEME_OPTIONS } from './themeOptions'

/** Navbar right side: "Sign in with GitHub", or the user's avatar with an account menu. */
export default function AuthControl() {
  const { user, loading, authAvailable, signIn } = useAuth()

  // Reserve the avatar's space while loading so the navbar doesn't jump.
  if (loading) return <span aria-hidden="true" className="size-9" />
  if (user) return <UserMenu user={user} />
  if (!authAvailable) return null

  return (
    <button
      type="button"
      // Signing in always lands on the Dashboard.
      onClick={() => signIn()}
      className="inline-flex items-center gap-1.5 rounded-full border border-on-nav/40 px-3.5 py-1.5 text-sm font-medium text-on-nav transition-colors hover:border-on-nav hover:bg-on-nav/10"
    >
      <LogIn aria-hidden="true" className="size-4" />
      <span className="sm:hidden">Sign in</span>
      <span className="hidden sm:inline">Sign in with GitHub</span>
    </button>
  )
}

/** Disclosure menu (like the mobile nav): Esc and outside clicks close it, focus returns. */
function UserMenu({ user }: { user: AuthUser }) {
  const { signOut, preview } = useAuth()
  const [open, setOpen] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const panelId = useId()

  useEffect(() => {
    if (!open) return
    panelRef.current?.querySelector<HTMLElement>('a, button')?.focus()

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false)
        buttonRef.current?.focus()
      }
    }
    function onPointerDown(e: PointerEvent) {
      const target = e.target as Node
      if (!panelRef.current?.contains(target) && !buttonRef.current?.contains(target)) {
        setOpen(false)
      }
    }
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('pointerdown', onPointerDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('pointerdown', onPointerDown)
    }
  }, [open])

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 rounded-full p-0.5 text-on-nav/85 hover:text-on-nav"
      >
        <Avatar person={user} size="sm" />
        <ChevronDown aria-hidden="true" className="size-4" />
        <span className="sr-only">Account menu for {user.name}</span>
      </button>

      {open && (
        <div
          id={panelId}
          ref={panelRef}
          className="shadow-photo absolute right-0 z-50 mt-3 w-64 overflow-hidden rounded-2xl bg-surface-raised text-ink"
        >
          <div className="flex items-center gap-3 border-b border-border px-4 py-3">
            <Avatar person={user} size="md" />
            <div className="min-w-0">
              <p className="truncate font-medium">{user.name}</p>
              <p className="truncate text-sm text-ink-muted">@{user.login}</p>
            </div>
          </div>
          <ThemeChoice />
          <ul className="border-t border-border p-1.5">
            <li>
              <Link
                to="/dashboard"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm hover:bg-ink/5"
              >
                <LayoutDashboard aria-hidden="true" className="size-4 text-ink-muted" />
                Dashboard
              </Link>
            </li>
            <li>
              <Link
                to="/tasks"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm hover:bg-ink/5"
              >
                <ListTodo aria-hidden="true" className="size-4 text-ink-muted" />
                My tasks
              </Link>
            </li>
            {preview ? (
              <li className="px-3 py-2 text-sm text-ink-muted">Preview: sample data, no sign-in</li>
            ) : (
              <li>
                <button
                  type="button"
                  onClick={signOut}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm hover:bg-ink/5"
                >
                  <LogOut aria-hidden="true" className="size-4 text-ink-muted" />
                  Sign out
                </button>
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  )
}

/** The theme as a three-way choice (the navbar toggle cycles through the same options). */
function ThemeChoice() {
  const { preference, setPreference } = useTheme()
  return (
    <div role="group" aria-label="Theme" className="flex items-center gap-3 px-4 py-3">
      <span aria-hidden="true" className="text-sm text-ink-muted">
        Theme
      </span>
      <div className="ml-auto inline-flex rounded-full bg-ink/5 p-1">
        {THEME_PREFERENCES.map((option) => {
          const { label, icon: Icon } = THEME_OPTIONS[option]
          const selected = option === preference
          return (
            <button
              key={option}
              type="button"
              aria-pressed={selected}
              aria-label={label}
              title={label}
              onClick={() => setPreference(option)}
              className={`flex rounded-full p-1.5 transition-colors ${
                selected ? 'shadow-card bg-surface text-ink' : 'text-ink-muted hover:text-ink'
              }`}
            >
              <Icon aria-hidden="true" className="size-4" />
            </button>
          )
        })}
      </div>
    </div>
  )
}
