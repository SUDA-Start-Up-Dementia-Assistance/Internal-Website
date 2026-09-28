// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AuthState } from '../lib/auth'
import { AuthContext } from '../lib/auth/context'
import Home from './Home'

afterEach(cleanup)

const ADA = { login: 'ada', name: 'Ada', avatarUrl: '' }

function renderAt(path: string, auth: Partial<AuthState>) {
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
    <AuthContext value={value}>
      <MemoryRouter initialEntries={[path]}>
        <Link to="/">Home link</Link>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/dashboard" element={<p>Dashboard page</p>} />
          <Route path="/agendas" element={<p>Agendas page</p>} />
        </Routes>
      </MemoryRouter>
    </AuthContext>,
  )
}

describe('Home', () => {
  it('sends signed-in visitors who arrive on / to the Dashboard', () => {
    renderAt('/', { user: ADA })
    expect(screen.getByText('Dashboard page')).toBeTruthy()
  })

  it('stays on Home for signed-out visitors and previews', () => {
    renderAt('/', { user: null })
    expect(screen.queryByText('Dashboard page')).toBeNull()
    expect(screen.getByRole('heading', { name: 'About D.A.W.N.' })).toBeTruthy()
    cleanup()
    renderAt('/', { user: ADA, preview: true })
    expect(screen.queryByText('Dashboard page')).toBeNull()
  })

  it('shows nothing while sign-in status loads, so Home never flashes', () => {
    renderAt('/', { loading: true })
    expect(screen.queryByRole('heading', { name: 'About D.A.W.N.' })).toBeNull()
  })

  it('still reaches Home from an in-app link when signed in', () => {
    renderAt('/agendas', { user: ADA })
    fireEvent.click(screen.getByText('Home link'))
    expect(screen.getByRole('heading', { name: 'About D.A.W.N.' })).toBeTruthy()
  })
})
