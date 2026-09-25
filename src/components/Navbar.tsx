import { Menu, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import SunArc from './SunArc'

const NAV_ITEMS = [
  { to: '/', label: 'Home', end: true },
  { to: '/agendas', label: 'Agendas', end: false },
  { to: '/artifacts', label: 'Artifacts', end: false },
]

// Active underline is gold, not ember: gold is 8.7:1 on night, ember only 3.15:1.
function linkClass({ isActive }: { isActive: boolean }) {
  return [
    'rounded-sm decoration-2 underline-offset-8 transition-colors',
    isActive
      ? 'text-cream underline decoration-gold'
      : 'text-cream/85 hover:text-cream hover:underline hover:decoration-cream/40',
  ].join(' ')
}

export default function Navbar() {
  const [open, setOpen] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    menuRef.current?.querySelector('a')?.focus()

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false)
        buttonRef.current?.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open])

  return (
    <header className="sticky top-0 z-40 bg-night text-cream on-night">
      <nav
        aria-label="Main"
        className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4"
      >
        <Link to="/" className="flex items-center gap-2 rounded-sm" aria-label="D.A.W.N. home">
          <SunArc horizon className="h-4 w-7" />
          <span className="font-heading text-xl font-semibold tracking-tight">D.A.W.N.</span>
        </Link>

        <ul className="hidden items-center gap-8 md:flex">
          {NAV_ITEMS.map((item) => (
            <li key={item.to}>
              <NavLink to={item.to} end={item.end} className={linkClass}>
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>

        <button
          ref={buttonRef}
          type="button"
          className="-mr-2 rounded-md p-2 text-cream md:hidden"
          aria-expanded={open}
          aria-controls="mobile-nav"
          onClick={() => setOpen((o) => !o)}
        >
          {open ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
          <span className="sr-only">Menu</span>
        </button>
      </nav>

      {open && (
        <div id="mobile-nav" ref={menuRef} className="border-t border-cream/10 md:hidden">
          <ul className="mx-auto flex max-w-5xl flex-col gap-1 px-6 py-4">
            {NAV_ITEMS.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  className={(state) => `block py-2 ${linkClass(state)}`}
                  onClick={() => setOpen(false)}
                >
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="horizon-line" aria-hidden="true" />
    </header>
  )
}
