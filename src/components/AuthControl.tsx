import { ChevronDown, LayoutDashboard, ListTodo, LogIn, LogOut } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth, type AuthUser } from '../lib/auth'
import Avatar from './Avatar'

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
      className="inline-flex items-center gap-1.5 rounded-full border border-cream/40 px-3.5 py-1.5 text-sm font-medium text-cream transition-colors hover:border-cream hover:bg-cream/10"
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
        className="flex items-center gap-1 rounded-full p-0.5 text-cream/85 hover:text-cream"
      >
        <Avatar person={user} size="sm" />
        <ChevronDown aria-hidden="true" className="size-4" />
        <span className="sr-only">Account menu for {user.name}</span>
      </button>

      {open && (
        // Light panel inside the dark header: switch the focus ring back to ember.
        <div
          id={panelId}
          ref={panelRef}
          className="absolute right-0 z-50 mt-3 w-64 overflow-hidden rounded-2xl bg-surface text-night shadow-card-hover [--focus-ring:var(--color-ember)]"
        >
          <div className="flex items-center gap-3 border-b border-night/10 px-4 py-3">
            <Avatar person={user} size="md" />
            <div className="min-w-0">
              <p className="truncate font-medium">{user.name}</p>
              <p className="truncate text-sm text-dusk">@{user.login}</p>
            </div>
          </div>
          <ul className="p-1.5">
            <li>
              <Link
                to="/dashboard"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm hover:bg-night/5"
              >
                <LayoutDashboard aria-hidden="true" className="size-4 text-dusk" />
                Dashboard
              </Link>
            </li>
            <li>
              <Link
                to="/tasks"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm hover:bg-night/5"
              >
                <ListTodo aria-hidden="true" className="size-4 text-dusk" />
                My tasks
              </Link>
            </li>
            {preview ? (
              <li className="px-3 py-2 text-sm text-dusk">Preview: sample data, no sign-in</li>
            ) : (
              <li>
                <button
                  type="button"
                  onClick={signOut}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm hover:bg-night/5"
                >
                  <LogOut aria-hidden="true" className="size-4 text-dusk" />
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
