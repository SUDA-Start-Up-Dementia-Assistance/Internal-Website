// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AuthState } from '../lib/auth'
import { AuthContext } from '../lib/auth/context'
import Navbar from './Navbar'

afterEach(cleanup)

function renderNavbar(auth: Partial<AuthState>) {
  const value: AuthState = {
    user: null,
    loading: false,
    authAvailable: true,
    signIn: vi.fn(),
    signOut: vi.fn(),
    ...auth,
  }
  render(
    <AuthContext value={value}>
      <MemoryRouter>
        <Navbar />
      </MemoryRouter>
    </AuthContext>,
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
})
