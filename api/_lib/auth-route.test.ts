import type { VercelRequest, VercelResponse } from '@vercel/node'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import handler from '../auth/[action].js'
import { sealState } from './oauth.js'
import { decryptSession, encryptSession } from './session.js'

const SECRET = 'test-secret-that-is-definitely-32-chars-long!'
const ORIGIN = 'http://localhost:3000'

interface FakeRes {
  statusCode: number
  headers: Record<string, string | string[]>
  body: unknown
}

function call(
  action: string,
  init: {
    method?: string
    query?: Record<string, string>
    cookies?: Record<string, string>
    headers?: Record<string, string>
  } = {},
) {
  const req = {
    method: init.method ?? 'GET',
    query: { action, ...init.query },
    cookies: init.cookies ?? {},
    headers: { host: 'localhost:3000', ...init.headers },
  } as unknown as VercelRequest
  const out: FakeRes = { statusCode: 200, headers: {}, body: undefined }
  const res = {
    headersSent: false,
    setHeader(name: string, value: string | string[]) {
      out.headers[name.toLowerCase()] = value
      return res
    },
    getHeader: (name: string) => out.headers[name.toLowerCase()],
    status(code: number) {
      out.statusCode = code
      return res
    },
    json(body: unknown) {
      out.body = body
      return res
    },
    end() {
      return res
    },
  } as unknown as VercelResponse
  return Promise.resolve(handler(req, res)).then(() => out)
}

const cookies = (res: FakeRes) => ([] as string[]).concat(res.headers['set-cookie'] ?? [])
const cookieValue = (res: FakeRes, name: string) =>
  cookies(res)
    .find((c) => c.startsWith(`${name}=`))
    ?.split(';')[0]
    .slice(name.length + 1)

/** Stubs GitHub: token exchange, /user, org membership, and grant revocation. */
function stubGitHub(membershipState: 'active' | 'pending' | null) {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (url.includes('/login/oauth/access_token'))
      return Response.json({ access_token: 'gho_test' })
    if (url.endsWith('/user'))
      return Response.json({ login: 'octocat', name: 'Octo Cat', avatar_url: 'https://a/b.png' })
    if (url.includes('/user/memberships/orgs/')) {
      return membershipState
        ? Response.json({ state: membershipState })
        : new Response('{}', { status: 404 })
    }
    if (url.includes('/grant') && init?.method === 'DELETE')
      return new Response(null, { status: 204 })
    return new Response('unexpected', { status: 500 })
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

beforeEach(() => {
  vi.stubEnv('GITHUB_CLIENT_ID', 'client-id')
  vi.stubEnv('GITHUB_CLIENT_SECRET', 'client-secret')
  vi.stubEnv('SESSION_SECRET', SECRET)
  vi.stubEnv('GITHUB_ORG', 'dawn-team')
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('/api/auth/login', () => {
  it('sets a short-lived HttpOnly state cookie and redirects to GitHub', async () => {
    const res = await call('login', { query: { returnTo: '/agendas' } })
    expect(res.statusCode).toBe(302)
    const location = new URL(String(res.headers.location))
    expect(location.origin + location.pathname).toBe('https://github.com/login/oauth/authorize')
    expect(location.searchParams.get('scope')).toBe('read:user read:org project')
    expect(location.searchParams.get('redirect_uri')).toBe(`${ORIGIN}/api/auth/callback`)
    expect(location.searchParams.get('state')).toBeTruthy()
    const cookie = cookies(res).find((c) => c.startsWith('dawn_oauth_state='))!
    expect(cookie).toMatch(/HttpOnly/)
    expect(cookie).toMatch(/Max-Age=600/)
    expect(cookie).not.toMatch(/Secure/) // localhost
  })

  it('marks cookies Secure off localhost', async () => {
    const res = await call('login', {
      headers: { host: 'dawn.vercel.app', 'x-forwarded-proto': 'https' },
    })
    expect(cookies(res)[0]).toMatch(/Secure/)
    expect(new URL(String(res.headers.location)).searchParams.get('redirect_uri')).toBe(
      'https://dawn.vercel.app/api/auth/callback',
    )
  })
})

describe('/api/auth/callback', () => {
  async function stateCookie(state = 'the-state', returnTo = '/agendas') {
    return { dawn_oauth_state: await sealState({ state, returnTo }, SECRET) }
  }

  it('signs in an active org member and returns them to returnTo', async () => {
    stubGitHub('active')
    const res = await call('callback', {
      query: { state: 'the-state', code: 'abc' },
      cookies: await stateCookie(),
    })
    expect(res.statusCode).toBe(302)
    expect(res.headers.location).toBe('/agendas')
    const session = await decryptSession(cookieValue(res, 'dawn_session')!, SECRET)
    expect(session).toEqual({
      token: 'gho_test',
      user: { login: 'octocat', name: 'Octo Cat', avatarUrl: 'https://a/b.png' },
    })
    expect(cookies(res).some((c) => c.startsWith('dawn_oauth_state=;'))).toBe(true) // single-use
  })

  it('rejects a state mismatch before contacting GitHub', async () => {
    const fetchMock = stubGitHub('active')
    const res = await call('callback', {
      query: { state: 'forged', code: 'abc' },
      cookies: await stateCookie(),
    })
    expect(res.headers.location).toBe('/tasks?error=signin-failed')
    expect(fetchMock).not.toHaveBeenCalled()
    expect(cookieValue(res, 'dawn_session')).toBeUndefined()
  })

  it('rejects a missing state cookie', async () => {
    stubGitHub('active')
    const res = await call('callback', { query: { state: 'the-state', code: 'abc' } })
    expect(res.headers.location).toBe('/tasks?error=signin-failed')
  })

  it.each(['pending', null] as const)(
    'turns away non-active members (%s) and revokes the grant',
    async (state) => {
      const fetchMock = stubGitHub(state)
      const res = await call('callback', {
        query: { state: 'the-state', code: 'abc' },
        cookies: await stateCookie(),
      })
      expect(res.headers.location).toBe('/tasks?error=not-a-member')
      expect(cookieValue(res, 'dawn_session')).toBeUndefined()
      expect(
        fetchMock.mock.calls.some(
          ([url, init]) => String(url).includes('/grant') && init?.method === 'DELETE',
        ),
      ).toBe(true)
    },
  )

  it('handles the user cancelling on GitHub', async () => {
    const res = await call('callback', {
      query: { state: 'the-state', error: 'access_denied' },
      cookies: await stateCookie(),
    })
    expect(res.headers.location).toBe('/tasks?error=signin-failed')
  })
})

describe('/api/auth/me', () => {
  it('returns the signed-in user, never the token', async () => {
    const value = await encryptSession(
      { token: 'gho_secret', user: { login: 'octocat', name: 'Octo', avatarUrl: '' } },
      SECRET,
    )
    const res = await call('me', { cookies: { dawn_session: value } })
    expect(res.body).toEqual({ user: { login: 'octocat', name: 'Octo', avatarUrl: '' } })
    expect(JSON.stringify(res.body)).not.toContain('gho_secret')
  })

  it('reports signed out, and clears an unreadable cookie', async () => {
    const res = await call('me', { cookies: { dawn_session: 'tampered' } })
    expect(res.body).toEqual({ user: null, authAvailable: true })
    expect(cookies(res).some((c) => c.startsWith('dawn_session=;'))).toBe(true)
  })

  it('reports auth unavailable when OAuth env vars are missing', async () => {
    vi.stubEnv('GITHUB_CLIENT_ID', '')
    vi.stubEnv('GITHUB_CLIENT_SECRET', '')
    const res = await call('me')
    expect(res.body).toEqual({ user: null, authAvailable: false })
  })

  it('names missing variables when the setup is partial', async () => {
    vi.stubEnv('GITHUB_ORG', '')
    const res = await call('me')
    expect(res.statusCode).toBe(500)
    expect(res.body).toEqual({
      error: {
        code: 'server-misconfigured',
        message: 'Missing required environment variable(s): GITHUB_ORG.',
      },
    })
  })
})

describe('/api/auth/logout', () => {
  it('requires POST', async () => {
    const res = await call('logout')
    expect(res.statusCode).toBe(405)
    expect(res.body).toMatchObject({ error: { code: 'method-not-allowed' } })
  })

  it('rejects a cross-site origin', async () => {
    const res = await call('logout', {
      method: 'POST',
      headers: { origin: 'https://evil.example' },
    })
    expect(res.statusCode).toBe(403)
    expect(res.body).toMatchObject({ error: { code: 'bad-origin' } })
  })

  it('revokes the grant, clears the cookie, and redirects home', async () => {
    const fetchMock = stubGitHub('active')
    const value = await encryptSession(
      { token: 'gho_test', user: { login: 'octocat', name: 'Octo', avatarUrl: '' } },
      SECRET,
    )
    const res = await call('logout', {
      method: 'POST',
      headers: { origin: ORIGIN },
      cookies: { dawn_session: value },
    })
    expect(res.statusCode).toBe(303)
    expect(res.headers.location).toBe('/')
    expect(
      cookies(res).some((c) => c.startsWith('dawn_session=;') && c.includes('Max-Age=0')),
    ).toBe(true)
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.github.com/applications/client-id/grant',
      expect.objectContaining({ method: 'DELETE' }),
    )
  })

  it('still clears the cookie when revocation fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('boom', { status: 500 })),
    )
    const value = await encryptSession(
      { token: 'gho_test', user: { login: 'octocat', name: 'Octo', avatarUrl: '' } },
      SECRET,
    )
    const res = await call('logout', {
      method: 'POST',
      headers: { origin: ORIGIN },
      cookies: { dawn_session: value },
    })
    expect(res.statusCode).toBe(303)
    expect(cookies(res).some((c) => c.startsWith('dawn_session=;'))).toBe(true)
  })
})

describe('unknown actions', () => {
  it.each(['nope', 'constructor', '__proto__'])('404s %j', async (action) => {
    const res = await call(action)
    expect(res.statusCode).toBe(404)
  })
})
