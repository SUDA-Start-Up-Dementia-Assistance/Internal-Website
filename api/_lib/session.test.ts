import type { VercelRequest, VercelResponse } from '@vercel/node'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { deriveKey, seal } from './crypto.js'
import { ConfigError } from './env.js'
import { toTokenSet } from './github/oauth.js'
import {
  AuthError,
  COOKIE_MAX_BYTES,
  SESSION_COOKIE,
  clearRefreshCache,
  decryptSession,
  encryptSession,
  getValidToken,
  needsRefresh,
  setSession,
  type Session,
} from './session.js'

const SECRET = 'test-secret-that-is-definitely-32-chars-long!'
const NOW = Date.parse('2026-09-28T12:00:00Z')
const NOW_S = NOW / 1000
const SESSION: Session = {
  accessToken: 'ghu_exampletoken',
  accessTokenExpiresAt: NOW_S + 8 * 3600,
  refreshToken: 'ghr_examplerefreshtoken',
  refreshTokenExpiresAt: NOW_S + 184 * 24 * 3600,
  user: { login: 'octocat', name: 'Octo Cat', avatarUrl: 'https://example.com/a.png' },
}

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('session encryption', () => {
  it('round-trips a session with both tokens and their expiries', async () => {
    vi.useFakeTimers({ now: NOW })
    const sealed = await encryptSession(SESSION, SECRET)
    expect(await decryptSession(sealed, SECRET)).toEqual(SESSION)
  })

  it('round-trips a session whose token never expires (no refresh token)', async () => {
    const plain: Session = { accessToken: 'ghu_x', user: SESSION.user }
    expect(await decryptSession(await encryptSession(plain, SECRET), SECRET)).toEqual(plain)
  })

  it('never exposes either token in the cookie value', async () => {
    const sealed = await encryptSession(SESSION, SECRET)
    const raw = Buffer.from(sealed.split('.')[3], 'base64url').toString('latin1')
    for (const secret of ['ghu_', 'ghr_']) {
      expect(sealed).not.toContain(secret)
      expect(raw).not.toContain(secret)
    }
  })

  it('reads a cookie from the old OAuth App (bare `token`) as signed out', async () => {
    const old = await seal(
      { token: 'gho_old', user: SESSION.user },
      deriveKey(SECRET, 'session'),
      60,
    )
    expect(await decryptSession(old, SECRET)).toBeNull()
  })

  it('reads a session as signed out once both tokens have expired', async () => {
    vi.useFakeTimers({ now: NOW })
    const sealed = await encryptSession(
      { ...SESSION, accessTokenExpiresAt: NOW_S + 10, refreshTokenExpiresAt: NOW_S + 20 },
      SECRET,
    )
    vi.setSystemTime(NOW + 15_000) // access token dead, refresh token still good
    expect(await decryptSession(sealed, SECRET)).not.toBeNull()
    vi.setSystemTime(NOW + 25_000)
    expect(await decryptSession(sealed, SECRET)).toBeNull()
  })

  it('rejects a tampered ciphertext', async () => {
    const parts = (await encryptSession(SESSION, SECRET)).split('.')
    const ciphertext = parts[3]
    const flipped = (ciphertext[0] === 'A' ? 'B' : 'A') + ciphertext.slice(1)
    expect(
      await decryptSession([...parts.slice(0, 3), flipped, parts[4]].join('.'), SECRET),
    ).toBeNull()
  })

  it('rejects a tampered authentication tag or header', async () => {
    const parts = (await encryptSession(SESSION, SECRET)).split('.')
    const badTag = [...parts.slice(0, 4), parts[4].slice(0, -2) + 'AA'].join('.')
    const badHeader = [
      Buffer.from('{"alg":"dir","enc":"A128GCM"}').toString('base64url'),
      ...parts.slice(1),
    ].join('.')
    expect(await decryptSession(badTag, SECRET)).toBeNull()
    expect(await decryptSession(badHeader, SECRET)).toBeNull()
  })

  it('rejects garbage and cookies sealed with a different secret', async () => {
    expect(await decryptSession('not-a-jwe', SECRET)).toBeNull()
    const other = await encryptSession(SESSION, 'a-completely-different-secret-of-32+-chars')
    expect(await decryptSession(other, SECRET)).toBeNull()
  })

  it('rejects an expired session (after 7 days)', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-01T12:00:00Z'))
    const sealed = await encryptSession({ accessToken: 'ghu_x', user: SESSION.user }, SECRET)
    vi.setSystemTime(new Date('2026-09-07T11:00:00Z'))
    expect(await decryptSession(sealed, SECRET)).toMatchObject({ user: SESSION.user })
    vi.setSystemTime(new Date('2026-09-08T12:00:01Z'))
    expect(await decryptSession(sealed, SECRET)).toBeNull()
  })

  it('rejects a well-formed payload that is missing session fields', async () => {
    const sealed = await seal({ user: SESSION.user }, deriveKey(SECRET, 'session'), 60)
    expect(await decryptSession(sealed, SECRET)).toBeNull()
  })

  it('does not accept an OAuth-state cookie as a session (keys are separated by purpose)', async () => {
    const stateCookie = await seal({ ...SESSION }, deriveKey(SECRET, 'oauth-state'), 60)
    expect(await decryptSession(stateCookie, SECRET)).toBeNull()
  })

  it('refuses a SESSION_SECRET shorter than 32 characters', async () => {
    await expect(encryptSession(SESSION, 'too-short')).rejects.toBeInstanceOf(ConfigError)
  })
})

/** A fake request carrying `session` as its cookie, and a response recording Set-Cookie. */
async function fakeExchange(session: Session | null = SESSION) {
  const cookies: Record<string, string> = {}
  if (session) cookies[SESSION_COOKIE] = await encryptSession(session, SECRET)
  const req = { cookies, headers: { host: 'localhost:3000' } } as unknown as VercelRequest
  const headers: Record<string, string | string[]> = {}
  const res = {
    getHeader: (name: string) => headers[name.toLowerCase()],
    setHeader(name: string, value: string | string[]) {
      headers[name.toLowerCase()] = value
      return res
    },
  } as unknown as VercelResponse
  const setCookies = () => ([] as string[]).concat(headers['set-cookie'] ?? [])
  return { req, res, setCookies }
}

function stubRefresh(respond: () => Response | Promise<Response>) {
  const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(async (url) => {
    if (url === 'https://github.com/login/oauth/access_token') return respond()
    return new Response('unexpected', { status: 500 })
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

const refreshed = () =>
  Response.json({
    access_token: 'ghu_fresh',
    expires_in: 28800,
    refresh_token: 'ghr_fresh',
    refresh_token_expires_in: 15897600,
  })

describe('getValidToken', () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: NOW, toFake: ['Date'] })
    vi.stubEnv('GITHUB_CLIENT_ID', 'client-id')
    vi.stubEnv('GITHUB_CLIENT_SECRET', 'client-secret')
    vi.stubEnv('SESSION_SECRET', SECRET)
    vi.stubEnv('GITHUB_ORG', 'dawn')
    vi.stubEnv('DEV_TOKEN_REFRESH_AFTER_SECONDS', '')
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'info').mockImplementation(() => {})
    clearRefreshCache()
  })

  it('returns the stored token without refreshing when it has more than 5 minutes left', async () => {
    const fetchMock = stubRefresh(refreshed)
    const { req, res, setCookies } = await fakeExchange({
      ...SESSION,
      accessTokenExpiresAt: NOW_S + 5 * 60 + 1,
    })
    expect(await getValidToken(req, res)).toBe('ghu_exampletoken')
    expect(fetchMock).not.toHaveBeenCalled()
    expect(setCookies()).toEqual([])
  })

  it('never refreshes a token GitHub gave no expiry', async () => {
    const fetchMock = stubRefresh(refreshed)
    const { req, res } = await fakeExchange({ accessToken: 'ghu_forever', user: SESSION.user })
    expect(await getValidToken(req, res)).toBe('ghu_forever')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it.each([
    ['within 5 minutes of expiry', NOW_S + 5 * 60],
    ['already expired', NOW_S - 60],
  ])('refreshes a token %s and re-sets the cookie', async (_label, expiresAt) => {
    const fetchMock = stubRefresh(refreshed)
    const { req, res, setCookies } = await fakeExchange({
      ...SESSION,
      accessTokenExpiresAt: expiresAt,
    })
    expect(await getValidToken(req, res)).toBe('ghu_fresh')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({
      client_id: 'client-id',
      client_secret: 'client-secret',
      grant_type: 'refresh_token',
      refresh_token: 'ghr_examplerefreshtoken',
    })
    const [cookie] = setCookies()
    expect(cookie).toMatch(/^dawn_session=.+; Path=\/; Max-Age=604800; HttpOnly; SameSite=Lax$/)
    expect(
      await decryptSession(cookie.split(';')[0].slice(SESSION_COOKIE.length + 1), SECRET),
    ).toEqual({
      accessToken: 'ghu_fresh',
      accessTokenExpiresAt: NOW_S + 28800,
      refreshToken: 'ghr_fresh',
      refreshTokenExpiresAt: NOW_S + 15897600,
      user: SESSION.user,
    })
  })

  it('shares one refresh between concurrent calls in a request, with one Set-Cookie', async () => {
    let release!: () => void
    const gate = new Promise<void>((resolve) => (release = resolve))
    const fetchMock = stubRefresh(async () => {
      await gate
      return refreshed()
    })
    const { req, res, setCookies } = await fakeExchange({ ...SESSION, accessTokenExpiresAt: NOW_S })
    const calls = [getValidToken(req, res), getValidToken(req, res), getValidToken(req, res)]
    release()
    expect(await Promise.all(calls)).toEqual(['ghu_fresh', 'ghu_fresh', 'ghu_fresh'])
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(setCookies()).toHaveLength(1)
  })

  it('shares one refresh between concurrent requests carrying the same refresh token', async () => {
    let release!: () => void
    const gate = new Promise<void>((resolve) => (release = resolve))
    const fetchMock = stubRefresh(async () => {
      await gate
      return refreshed()
    })
    const a = await fakeExchange({ ...SESSION, accessTokenExpiresAt: NOW_S })
    const b = await fakeExchange({ ...SESSION, accessTokenExpiresAt: NOW_S })
    const both = Promise.all([getValidToken(a.req, a.res), getValidToken(b.req, b.res)])
    release()
    expect(await both).toEqual(['ghu_fresh', 'ghu_fresh'])
    expect(fetchMock).toHaveBeenCalledTimes(1)
    // Each response carries the new cookie, so whichever the browser keeps is valid.
    expect(a.setCookies()).toHaveLength(1)
    expect(b.setCookies()).toHaveLength(1)
  })

  it.each([
    ['GitHub rejects the refresh token', () => Response.json({ error: 'bad_refresh_token' })],
    ['GitHub errors', () => new Response('boom', { status: 500 })],
    ['the network fails', () => Promise.reject(new TypeError('fetch failed'))],
  ])('clears the session and throws session-expired when %s', async (_label, respond) => {
    stubRefresh(respond)
    const { req, res, setCookies } = await fakeExchange({ ...SESSION, accessTokenExpiresAt: NOW_S })
    const error = await getValidToken(req, res).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(AuthError)
    expect((error as AuthError).code).toBe('session-expired')
    expect(setCookies()).toEqual([expect.stringMatching(/^dawn_session=;.*Max-Age=0/)])
  })

  it('does not reuse a failed refresh for the next request', async () => {
    const fetchMock = stubRefresh(() => new Response('boom', { status: 502 }))
    const first = await fakeExchange({ ...SESSION, accessTokenExpiresAt: NOW_S })
    await getValidToken(first.req, first.res).catch(() => {})
    fetchMock.mockImplementation(async () => refreshed())
    const second = await fakeExchange({ ...SESSION, accessTokenExpiresAt: NOW_S })
    expect(await getValidToken(second.req, second.res)).toBe('ghu_fresh')
  })

  it('expires the session without calling GitHub when there is no refresh token', async () => {
    const fetchMock = stubRefresh(refreshed)
    const { req, res } = await fakeExchange({
      accessToken: 'ghu_x',
      accessTokenExpiresAt: NOW_S + 60,
      user: SESSION.user,
    })
    await expect(getValidToken(req, res)).rejects.toMatchObject({ code: 'session-expired' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('throws unauthenticated with no session', async () => {
    const { req, res } = await fakeExchange(null)
    await expect(getValidToken(req, res)).rejects.toMatchObject({ code: 'unauthenticated' })
  })
})

describe('needsRefresh', () => {
  it('is true only within 5 minutes of expiry', () => {
    const at = (secondsLeft: number) =>
      needsRefresh({ ...SESSION, accessTokenExpiresAt: NOW_S + secondsLeft }, NOW_S)
    expect(at(8 * 3600)).toBe(false)
    expect(at(301)).toBe(false)
    expect(at(300)).toBe(true)
    expect(at(-1)).toBe(true)
  })
})

describe('token expiries', () => {
  it('turns expires_in values into absolute times', () => {
    vi.stubEnv('DEV_TOKEN_REFRESH_AFTER_SECONDS', '')
    expect(
      toTokenSet(
        {
          access_token: 'a',
          expires_in: 28800,
          refresh_token: 'r',
          refresh_token_expires_in: 15897600,
        },
        1000,
      ),
    ).toEqual({
      accessToken: 'a',
      accessTokenExpiresAt: 29800,
      refreshToken: 'r',
      refreshTokenExpiresAt: 15898600,
    })
  })

  it('DEV_TOKEN_REFRESH_AFTER_SECONDS makes tokens due for refresh after that many seconds', () => {
    vi.stubEnv('DEV_TOKEN_REFRESH_AFTER_SECONDS', '10')
    const tokens = toTokenSet({ access_token: 'a', expires_in: 28800, refresh_token: 'r' }, 1000)
    const session = { ...tokens, user: SESSION.user }
    expect(needsRefresh(session, 1009)).toBe(false)
    expect(needsRefresh(session, 1010)).toBe(true)
  })

  it('ignores DEV_TOKEN_REFRESH_AFTER_SECONDS on production and preview', () => {
    vi.stubEnv('DEV_TOKEN_REFRESH_AFTER_SECONDS', '10')
    for (const env of ['production', 'preview']) {
      vi.stubEnv('VERCEL_ENV', env)
      expect(toTokenSet({ access_token: 'a', expires_in: 28800 }, 1000).accessTokenExpiresAt).toBe(
        29800,
      )
    }
  })
})

describe('session cookie size', () => {
  const longUser = {
    login: 'a-very-long-github-login-name-xx',
    name: 'Someone With A Rather Long Display Name That Goes On And On',
    avatarUrl: 'https://avatars.githubusercontent.com/u/123456789?v=4&size=460',
  }

  it('stays well under 4KB with every field populated', async () => {
    vi.stubEnv('VERCEL_ENV', 'production')
    const { req, res, setCookies } = await fakeExchange(null)
    await setSession(
      req,
      res,
      {
        ...SESSION,
        // GitHub App tokens: ghu_ + 36 chars; refresh tokens: ghr_ + 76 chars.
        accessToken: `ghu_${'x'.repeat(36)}`,
        refreshToken: `ghr_${'y'.repeat(76)}`,
        user: longUser,
      },
      SECRET,
    )
    const bytes = Buffer.byteLength(setCookies()[0])
    expect(bytes).toBeLessThan(1500)
    expect(bytes).toBeLessThan(COOKIE_MAX_BYTES)
  })

  it('warns in dev when the cookie passes 3.5KB, and not in production', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const huge = { ...SESSION, user: { ...longUser, name: 'n'.repeat(3000) } }
    const { req, res } = await fakeExchange(null)
    vi.stubEnv('VERCEL_ENV', 'production')
    await setSession(req, res, huge, SECRET)
    expect(warn).not.toHaveBeenCalled()
    vi.stubEnv('VERCEL_ENV', 'development')
    await setSession(req, res, huge, SECRET)
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/session cookie is \d+ bytes/))
  })
})
