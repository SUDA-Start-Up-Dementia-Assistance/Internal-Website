// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AuthState } from '../lib/auth'
import { AuthContext } from '../lib/auth/context'
import { ThemeProvider } from '../lib/theme'
import Navbar from './Navbar'

afterEach(cleanup)

function renderNavbar(auth: Partial<AuthState>) {
  const value: AuthState = {
    user: null,
    loading: false,
    authAvailable: true,
    preview: false,
    sessionExpired: false,
    signIn: vi.fn(),
    signOut: vi.fn(),
    ...auth,
  }
  render(
    <ThemeProvider>
      <AuthContext value={value}>
        <MemoryRouter>
          <Navbar />
        </MemoryRouter>
      </AuthContext>
    </ThemeProvider>,
  )
}

const tasksLinks = () => screen.queryAllByRole('link', { name: 'Tasks' })

describe('Navbar', () => {
  it('hides Tasks when signed out, in the desktop and mobile menus', () => {
    renderNavbar({ user: null })
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }))
    expect(screen.getAllByRole('link', { name: 'Agendas' })).toHaveLength(2)
    expect(tasksLinks()).toHaveLength(0)
  })

  it('hides Tasks while sign-in status is still loading', () => {
    renderNavbar({ user: null, loading: true })
    expect(tasksLinks()).toHaveLength(0)
  })

  it('shows Tasks when signed in, in both menus', () => {
    renderNavbar({ user: { login: 'ada', name: 'Ada', avatarUrl: '' } })
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }))
    expect(tasksLinks()).toHaveLength(2)
  })

  it('puts Dashboard first when signed in, and hides it when signed out', () => {
    renderNavbar({ user: { login: 'ada', name: 'Ada', avatarUrl: '' } })
    const main = screen.getByRole('navigation', { name: 'Main' })
    const links = Array.from(main.querySelectorAll('ul a')).map((a) => a.textContent)
    expect(links.slice(0, 2)).toEqual(['Dashboard', 'Meetings'])
    cleanup()
    renderNavbar({ user: null })
    expect(screen.queryAllByRole('link', { name: 'Dashboard' })).toHaveLength(0)
  })

  it('points the logo at the Dashboard only when really signed in', () => {
    const logo = () => screen.getByRole('link', { name: /^D\.A\.W\.N\./ }).getAttribute('href')
    renderNavbar({ user: { login: 'ada', name: 'Ada', avatarUrl: '' } })
    expect(logo()).toBe('/dashboard')
    cleanup()
    renderNavbar({ user: null })
    expect(logo()).toBe('/')
    cleanup()
    renderNavbar({ user: { login: 'sample', name: 'Sample', avatarUrl: '' }, preview: true })
    expect(logo()).toBe('/')
  })
})
