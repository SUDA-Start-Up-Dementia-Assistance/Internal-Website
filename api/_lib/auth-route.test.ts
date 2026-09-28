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

/** Stubs GitHub: token exchange, /user, org membership, and token revocation. */
function stubGitHub(
  membershipState: 'active' | 'pending' | null,
  { membershipStatus = 404, installedOn = ['dawn-team'] } = {},
) {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (url.includes('/login/oauth/access_token'))
      return Response.json({
        access_token: 'ghu_test',
        expires_in: 28800,
        refresh_token: 'ghr_test',
        refresh_token_expires_in: 15897600,
      })
    if (url.endsWith('/user'))
      return Response.json({ login: 'octocat', name: 'Octo Cat', avatar_url: 'https://a/b.png' })
    if (url.includes('/user/memberships/orgs/')) {
      return membershipState
        ? Response.json({ state: membershipState })
        : Response.json(
            { message: 'Resource not accessible by integration' },
            { status: membershipStatus },
          )
    }
    if (url.includes('/user/installations'))
      return Response.json({ installations: installedOn.map((login) => ({ account: { login } })) })
    if (url.endsWith('/applications/client-id/token') && init?.method === 'DELETE')
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
    expect(location.searchParams.get('client_id')).toBe('client-id')
    expect(location.searchParams.get('redirect_uri')).toBe(`${ORIGIN}/api/auth/callback`)
    expect(location.searchParams.get('state')).toBeTruthy()
    const cookie = cookies(res).find((c) => c.startsWith('dawn_oauth_state='))!
    expect(cookie).toMatch(/HttpOnly/)
    expect(cookie).toMatch(/Max-Age=600/)
    expect(cookie).not.toMatch(/Secure/) // localhost
  })

  it.each([
    [{ host: 'localhost:3000' }, 'http://localhost:3000/api/auth/callback'],
    [{ host: '127.0.0.1:3000' }, 'http://127.0.0.1:3000/api/auth/callback'],
    [
      { host: 'dawn.vercel.app', 'x-forwarded-proto': 'https' },
      'https://dawn.vercel.app/api/auth/callback',
    ],
    // Vercel's proxy: the public host arrives in x-forwarded-host.
    [
      { host: 'internal', 'x-forwarded-host': 'dawn.vercel.app', 'x-forwarded-proto': 'https' },
      'https://dawn.vercel.app/api/auth/callback',
    ],
  ])('sends no scope and redirect_uri from the request origin (%j)', async (headers, expected) => {
    const res = await call('login', { headers })
    const params = new URL(String(res.headers.location)).searchParams
    expect(params.has('scope')).toBe(false)
    expect(params.get('redirect_uri')).toBe(expected)
  })

  it('marks cookies Secure off localhost', async () => {
    const res = await call('login', {
      headers: { host: 'dawn.vercel.app', 'x-forwarded-proto': 'https' },
    })
    expect(cookies(res)[0]).toMatch(/Secure/)
  })
})

describe('/api/auth/callback', () => {
  async function stateCookie(state = 'the-state', returnTo = '/agendas') {
    return { dawn_oauth_state: await sealState({ state, returnTo }, SECRET) }
  }

  it('signs in an active org member, storing both tokens and their expiries', async () => {
    const fetchMock = stubGitHub('active')
    const before = Math.floor(Date.now() / 1000)
    const res = await call('callback', {
      query: { state: 'the-state', code: 'abc' },
      cookies: await stateCookie(),
    })
    expect(res.statusCode).toBe(302)
    expect(res.headers.location).toBe('/agendas')
    const session = await decryptSession(cookieValue(res, 'dawn_session')!, SECRET)
    expect(session).toEqual({
      accessToken: 'ghu_test',
      accessTokenExpiresAt: expect.any(Number),
      refreshToken: 'ghr_test',
      refreshTokenExpiresAt: expect.any(Number),
      user: { login: 'octocat', name: 'Octo Cat', avatarUrl: 'https://a/b.png' },
    })
    expect(session!.accessTokenExpiresAt! - before).toBeGreaterThanOrEqual(28800)
    expect(session!.accessTokenExpiresAt! - before).toBeLessThan(28805)
    expect(session!.refreshTokenExpiresAt! - before).toBeGreaterThanOrEqual(15897600)
    // The code exchange sends the same redirect_uri the authorize step used.
    const exchange = fetchMock.mock.calls.find(([url]) => url.includes('access_token'))!
    expect(JSON.parse(String(exchange[1]?.body))).toMatchObject({
      code: 'abc',
      redirect_uri: `${ORIGIN}/api/auth/callback`,
    })
    expect(cookies(res).some((c) => c.startsWith('dawn_oauth_state=;'))).toBe(true) // single-use
  })

  it('sets a production session cookie: HttpOnly, Secure, SameSite=Lax, Path=/, 7 days', async () => {
    stubGitHub('active')
    const res = await call('callback', {
      query: { state: 'the-state', code: 'abc' },
      cookies: await stateCookie(),
      headers: { host: 'dawn.vercel.app', 'x-forwarded-proto': 'https' },
    })
    const cookie = cookies(res).find((c) => c.startsWith('dawn_session=') && c.length > 20)!
    const flags = cookie.split('; ').slice(1)
    expect(flags).toEqual(
      expect.arrayContaining(['HttpOnly', 'Secure', 'SameSite=Lax', 'Path=/', 'Max-Age=604800']),
    )
    expect(cookie).not.toContain('gho_test') // encrypted, not just encoded
  })

  it.each(['/.//evil.example', '//evil.example', 'https://evil.example'])(
    'never redirects off-site after sign-in (returnTo=%j)',
    async (returnTo) => {
      stubGitHub('active')
      const login = await call('login', { query: { returnTo } })
      const state = new URL(String(login.headers.location)).searchParams.get('state')!
      const res = await call('callback', {
        query: { state, code: 'abc' },
        cookies: { dawn_oauth_state: cookieValue(login, 'dawn_oauth_state')! },
      })
      expect(res.headers.location).toBe('/dashboard')
    },
  )

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
    'turns away non-active members (%s) and revokes the token',
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
          ([url, init]) => String(url).endsWith('/token') && init?.method === 'DELETE',
        ),
      ).toBe(true)
    },
  )

  it('reports a missing Members permission instead of "not a member"', async () => {
    stubGitHub(null, { membershipStatus: 403 })
    const res = await call('callback', {
      query: { state: 'the-state', code: 'abc' },
      cookies: await stateCookie(),
    })
    expect(res.headers.location).toBe('/tasks?error=app-missing-permission')
    expect(cookieValue(res, 'dawn_session')).toBeUndefined()
  })

  it.each([403, 404])(
    'reports an app not installed on the org (GitHub %i) instead of "not a member"',
    async (membershipStatus) => {
      stubGitHub(null, { membershipStatus, installedOn: ['some-other-org'] })
      const res = await call('callback', {
        query: { state: 'the-state', code: 'abc' },
        cookies: await stateCookie(),
      })
      expect(res.headers.location).toBe('/tasks?error=app-not-installed')
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
      { accessToken: 'gho_secret', user: { login: 'octocat', name: 'Octo', avatarUrl: '' } },
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

  it('rejects a tampered session cookie (one flipped character) and clears it', async () => {
    const value = await encryptSession(
      { accessToken: 'gho_secret', user: { login: 'octocat', name: 'Octo', avatarUrl: '' } },
      SECRET,
    )
    // Flip a character inside the ciphertext segment of the compact JWE.
    const parts = value.split('.')
    const c = parts[3]
    parts[3] = c.slice(0, 5) + (c[5] === 'A' ? 'B' : 'A') + c.slice(6)
    const res = await call('me', { cookies: { dawn_session: parts.join('.') } })
    expect(res.body).toEqual({ user: null, authAvailable: true })
    expect(cookies(res).some((c) => c.startsWith('dawn_session=;'))).toBe(true)
  })

  it('rejects a session sealed with a different secret', async () => {
    const value = await encryptSession(
      { accessToken: 'gho_secret', user: { login: 'octocat', name: 'Octo', avatarUrl: '' } },
      'another-secret-that-is-also-32-characters!',
    )
    const res = await call('me', { cookies: { dawn_session: value } })
    expect(res.body).toEqual({ user: null, authAvailable: true })
  })

  it('reports auth unavailable when OAuth env vars are missing', async () => {
    vi.stubEnv('GITHUB_CLIENT_ID', '')
    vi.stubEnv('GITHUB_CLIENT_SECRET', '')
    const res = await call('me')
    expect(res.body).toEqual({ user: null, authAvailable: false })
  })

  it('treats missing OAuth env vars as a misconfiguration in production', async () => {
    vi.stubEnv('VERCEL_ENV', 'production')
    vi.stubEnv('GITHUB_CLIENT_ID', '')
    vi.stubEnv('GITHUB_CLIENT_SECRET', '')
    const res = await call('me')
    expect(res.statusCode).toBe(500)
    expect(res.body).toMatchObject({ error: { code: 'server-misconfigured' } })
    expect(JSON.stringify(res.body)).toContain('GITHUB_CLIENT_ID')
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

  it('revokes the token, clears the cookie, and redirects home', async () => {
    const fetchMock = stubGitHub('active')
    const value = await encryptSession(
      { accessToken: 'ghu_test', user: { login: 'octocat', name: 'Octo', avatarUrl: '' } },
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
      'https://api.github.com/applications/client-id/token',
      expect.objectContaining({
        method: 'DELETE',
        body: JSON.stringify({ access_token: 'ghu_test' }),
      }),
    )
  })

  it('still clears the cookie when revocation fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('boom', { status: 500 })),
    )
    const value = await encryptSession(
      { accessToken: 'ghu_test', user: { login: 'octocat', name: 'Octo', avatarUrl: '' } },
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
