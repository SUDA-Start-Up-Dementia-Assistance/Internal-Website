// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { request, TasksError } from '../tasks/api'
import { fetchMe } from './api'
import AuthProvider from './AuthProvider'
import { useAuth } from './useAuth'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

const json = (body: unknown, status = 200) => Response.json(body, { status })

describe('fetchMe', () => {
  it('reports a preview only when the server says sign-in is not configured', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => json({ user: null, authAvailable: false })),
    )
    expect(await fetchMe()).toEqual({ user: null, authAvailable: false, preview: true })
  })

  it('is signed out, not a preview, when sign-in is configured', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => json({ user: null, authAvailable: true })),
    )
    expect(await fetchMe()).toEqual({ user: null, authAvailable: true, preview: false })
  })

  it('never treats a failing production API as a preview', async () => {
    vi.stubEnv('DEV', false)
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => json({ error: { code: 'server-misconfigured', message: 'x' } }, 500)),
    )
    expect(await fetchMe()).toEqual({ user: null, authAvailable: false, preview: false })
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Promise.reject(new TypeError('offline'))),
    )
    expect((await fetchMe()).preview).toBe(false)
  })
})

function Probe() {
  const { user, sessionExpired } = useAuth()
  return (
    <p>
      {user ? `signed in as ${user.login}` : 'signed out'}
      {sessionExpired && ' (expired)'}
    </p>
  )
}

describe('AuthProvider', () => {
  it('signs the user out when an API call finds the session expired', async () => {
    const user = { login: 'ada', name: 'Ada', avatarUrl: '' }
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        url === '/api/auth/me'
          ? json({ user })
          : json({ error: { code: 'session-expired', message: 'Expired.' } }, 401),
      ),
    )
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    )
    await screen.findByText('signed in as ada')

    await act(async () => {
      await expect(request('/api/tasks', {}, () => true, 'x')).rejects.toBeInstanceOf(TasksError)
    })
    await waitFor(() => expect(screen.getByText('signed out (expired)')).toBeTruthy())
  })
})
