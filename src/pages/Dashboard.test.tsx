// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import type { AuthState } from '../lib/auth'
import { AuthContext } from '../lib/auth/context'
import { MOCK_USER } from '../lib/auth/mock'
import { enableSampleMode } from '../lib/sampleMode'
import Dashboard from './Dashboard'

afterEach(cleanup)

beforeAll(() => {
  enableSampleMode()
})

function renderDashboard(auth: Partial<AuthState>) {
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
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/tasks" element={<p>Sign-in panel</p>} />
        </Routes>
      </MemoryRouter>
    </AuthContext>,
  )
}

describe('Dashboard', () => {
  it('sends signed-out visitors to the sign-in panel', () => {
    renderDashboard({ user: null })
    expect(screen.getByText('Sign-in panel')).toBeTruthy()
  })

  it('renders every widget from sample data', async () => {
    renderDashboard({})
    expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(/^Good \w+, Sample$/)

    const reviews = await screen.findByRole('region', { name: /Reviews waiting on me/ })
    expect(await within(reviews).findByText('Overdue')).toBeTruthy()
    expect(within(reviews).getAllByText('No demo video').length).toBeGreaterThan(0)
    expect(within(reviews).getByText('1/2 reviewers')).toBeTruthy()

    const prs = screen.getByRole('region', { name: /My pull requests/ })
    expect(within(prs).getByText('CI failing')).toBeTruthy()
    expect(within(prs).getByText('Targets main directly')).toBeTruthy()
    expect(within(prs).getByText('Changes requested')).toBeTruthy()

    const waiting = screen.getByRole('list', { name: 'Waiting on you:' })
    const links = within(waiting).getAllByRole('link')
    expect(links.map((a) => a.getAttribute('href'))).toContain('#reviews')
    expect(within(waiting).getByText('1 PR with failing CI')).toBeTruthy()

    screen.getByRole('region', { name: /Sprint/ })
    const meetings = screen.getByRole('region', { name: /Upcoming meetings/ })
    expect(within(meetings).getAllByRole('listitem').length).toBeGreaterThan(0)

    const tasks = screen.getByRole('region', { name: /My tasks/ })
    const boxes = within(tasks).getAllByRole('checkbox')
    expect(boxes.length).toBeGreaterThan(0)
    fireEvent.click(boxes[0])
    expect((boxes[0] as HTMLInputElement).checked).toBe(true)
  })
})
