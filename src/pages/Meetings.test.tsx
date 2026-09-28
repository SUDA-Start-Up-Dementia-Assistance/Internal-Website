// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import type { AuthState } from '../lib/auth'
import { AuthContext } from '../lib/auth/context'
import { MOCK_USER } from '../lib/auth/mock'
import { enableSampleMode } from '../lib/sampleMode'
import Meetings from './Meetings'

afterEach(cleanup)
beforeAll(() => enableSampleMode())

function SignIn() {
  const location = useLocation()
  return <p>Sign-in panel {location.search}</p>
}

function renderMeetings(auth: Partial<AuthState>) {
  const value: AuthState = {
    user: MOCK_USER,
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
      <MemoryRouter initialEntries={['/meetings']}>
        <Routes>
          <Route path="/meetings" element={<Meetings />} />
          <Route path="/tasks" element={<SignIn />} />
        </Routes>
      </MemoryRouter>
    </AuthContext>,
  )
}

describe('Meetings page', () => {
  it('sends signed-out visitors to sign in, returning to /meetings', () => {
    renderMeetings({ user: null })
    expect(screen.getByText('Sign-in panel ?returnTo=%2Fmeetings')).toBeTruthy()
  })

  it('lists upcoming meetings, switches to the week grid, and back', async () => {
    renderMeetings({})
    expect(screen.getByRole('link', { name: /Add a meeting/ }).getAttribute('href')).toBe(
      'https://calendar.google.com/calendar/render?action=TEMPLATE',
    )
    expect(screen.getByText('Choose the DAWN Team calendar so everyone sees it.')).toBeTruthy()
    expect(await screen.findByRole('heading', { name: 'This week' })).toBeTruthy()
    expect(screen.getAllByText('DAWN Team Meeting').length).toBeGreaterThan(0)

    fireEvent.click(screen.getByRole('button', { name: 'Week' }))
    expect(screen.getByRole('button', { name: 'Week' }).getAttribute('aria-pressed')).toBe('true')
    expect(await screen.findByRole('heading', { name: 'Meetings this week' })).toBeTruthy()
    const today = screen.getByRole('button', { name: 'Today' }) as HTMLButtonElement
    expect(today.disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Next week' }))
    expect(today.disabled).toBe(false)

    fireEvent.click(screen.getByRole('button', { name: 'List' }))
    expect(await screen.findByRole('heading', { name: 'This week' })).toBeTruthy()
    expect(screen.getByText('Past 2 weeks')).toBeTruthy()
  })
})
