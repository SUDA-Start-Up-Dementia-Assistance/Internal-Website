import { createHash } from 'node:crypto'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { expiredCookie, serializeCookie } from './cookies.js'
import { deriveKey, seal, unseal } from './crypto.js'
import { getAuthConfig, isDevEnvironment, type AuthConfig } from './env.js'
import { GitHubError } from './github/errors.js'
import { REFRESH_MARGIN_SECONDS, refreshTokens, type TokenSet } from './github/oauth.js'
import { appendSetCookie, isLocalhost } from './request.js'

export const SESSION_COOKIE = 'dawn_session'
export const SESSION_MAX_AGE = 7 * 24 * 60 * 60
/** Browsers drop cookies over 4096 bytes; warn (in dev) well before that. */
export const COOKIE_WARN_BYTES = 3584
export const COOKIE_MAX_BYTES = 4096

export interface SessionUser {
  login: string
  name: string
  avatarUrl: string
}

/**
 * The GitHub tokens live only in this encrypted, HttpOnly cookie, never in browser JS.
 * Routes never read `accessToken` directly: they call getValidToken, which refreshes it.
 */
export interface Session extends TokenSet {
  user: SessionUser
}

/** No usable session: 401 with `code`. Thrown by getValidToken, turned into JSON by withErrors. */
export class AuthError extends Error {
  readonly code: 'unauthenticated' | 'session-expired'

  constructor(code: AuthError['code']) {
    super(
      code === 'unauthenticated'
        ? 'Sign in with GitHub to continue.'
        : 'Your GitHub session has expired. Sign in again to continue.',
    )
    this.name = 'AuthError'
    this.code = code
  }
}

function sessionKey(secret: string): Uint8Array {
  return deriveKey(secret, 'session')
}

const nowSeconds = () => Math.floor(Date.now() / 1000)

export async function encryptSession(session: Session, secret: string): Promise<string> {
  const { accessToken, accessTokenExpiresAt, refreshToken, refreshTokenExpiresAt, user } = session
  return seal(
    { accessToken, accessTokenExpiresAt, refreshToken, refreshTokenExpiresAt, user },
    sessionKey(secret),
    SESSION_MAX_AGE,
  )
}

export async function decryptSession(value: string, secret: string): Promise<Session | null> {
  const payload = await unseal(value, sessionKey(secret))
  if (!payload) return null
  const p = payload as Partial<Session>
  const user = p.user
  // Cookies from the old OAuth App (a bare `token`) fail here and read as signed out.
  if (typeof p.accessToken !== 'string' || !user || typeof user.login !== 'string') return null
  const session: Session = {
    accessToken: p.accessToken,
    user: { login: user.login, name: user.name || user.login, avatarUrl: user.avatarUrl ?? '' },
  }
  if (typeof p.accessTokenExpiresAt === 'number')
    session.accessTokenExpiresAt = p.accessTokenExpiresAt
  if (typeof p.refreshToken === 'string') session.refreshToken = p.refreshToken
  if (typeof p.refreshTokenExpiresAt === 'number')
    session.refreshTokenExpiresAt = p.refreshTokenExpiresAt
  return isDead(session, nowSeconds()) ? null : session
}

/** The access token has expired and there's no usable refresh token to replace it. */
function isDead(session: Session, now: number): boolean {
  if (session.accessTokenExpiresAt === undefined || session.accessTokenExpiresAt > now) return false
  return !canRefresh(session, now)
}

function canRefresh(session: Session, now: number): boolean {
  if (!session.refreshToken) return false
  return session.refreshTokenExpiresAt === undefined || session.refreshTokenExpiresAt > now
}

/** Due for refresh: expires within REFRESH_MARGIN_SECONDS. No expiry means it never expires. */
export function needsRefresh(session: Session, now = nowSeconds()): boolean {
  return (
    session.accessTokenExpiresAt !== undefined &&
    session.accessTokenExpiresAt - now <= REFRESH_MARGIN_SECONDS
  )
}

/** The signed-in session, or null (no cookie, auth unconfigured, tampered, or expired). */
export async function getSession(req: VercelRequest): Promise<Session | null> {
  const value = req.cookies?.[SESSION_COOKIE]
  if (!value) return null
  const config = getAuthConfig()
  if (!config) return null
  return decryptSession(value, config.sessionSecret)
}

export async function setSession(
  req: VercelRequest,
  res: VercelResponse,
  session: Session,
  secret: string,
): Promise<void> {
  const cookie = serializeCookie(SESSION_COOKIE, await encryptSession(session, secret), {
    maxAgeSeconds: SESSION_MAX_AGE,
    secure: !isLocalhost(req),
  })
  checkCookieSize(cookie)
  appendSetCookie(res, cookie)
}

export function checkCookieSize(cookie: string): void {
  const bytes = Buffer.byteLength(cookie)
  if (bytes > COOKIE_WARN_BYTES && isDevEnvironment()) {
    console.warn(
      `[session] session cookie is ${bytes} bytes; browsers drop cookies over ${COOKIE_MAX_BYTES}.`,
    )
  }
}

export function clearSession(req: VercelRequest, res: VercelResponse): void {
  appendSetCookie(res, expiredCookie(SESSION_COOKIE, { secure: !isLocalhost(req) }))
}

/*
 * Refresh tokens are single-use, so two requests refreshing the same one would make the
 * second fail and sign the user out. Within a function instance, every refresh of a given
 * refresh token shares one promise, and a success is remembered briefly so requests that
 * still carry the old cookie reuse the new tokens instead of refreshing again.
 */
const REUSE_REFRESH_MS = 60_000
const refreshes = new Map<string, Promise<TokenSet>>()

function sharedRefresh(config: AuthConfig, refreshToken: string): Promise<TokenSet> {
  const key = createHash('sha256').update(refreshToken).digest('base64url')
  let pending = refreshes.get(key)
  if (!pending) {
    pending = refreshTokens(config, refreshToken)
    refreshes.set(key, pending)
    pending.then(
      () => setTimeout(() => refreshes.delete(key), REUSE_REFRESH_MS).unref?.(),
      () => refreshes.delete(key),
    )
  }
  return pending
}

/** For tests. */
export function clearRefreshCache(): void {
  refreshes.clear()
}

/** One lookup per request, so concurrent callers share a refresh and one Set-Cookie. */
const perRequest = new WeakMap<VercelRequest, Promise<ValidAuth>>()

export interface ValidAuth {
  token: string
  user: SessionUser
}

/**
 * The ONLY way routes get a GitHub token. Returns the signed-in user's access token,
 * refreshing it first (and re-setting the cookie) if it expires within 5 minutes.
 * Throws AuthError('unauthenticated') with no session, and AuthError('session-expired')
 * after clearing the cookie when the refresh fails; withErrors turns both into a 401.
 */
export async function getValidToken(req: VercelRequest, res: VercelResponse): Promise<string> {
  return (await getValidAuth(req, res)).token
}

/** getValidToken, plus who the token belongs to. */
export function getValidAuth(req: VercelRequest, res: VercelResponse): Promise<ValidAuth> {
  let auth = perRequest.get(req)
  if (!auth) {
    auth = resolveAuth(req, res)
    perRequest.set(req, auth)
  }
  return auth
}

async function resolveAuth(req: VercelRequest, res: VercelResponse): Promise<ValidAuth> {
  const config = getAuthConfig()
  const session = config ? await getSession(req) : null
  if (!config || !session) {
    // A cookie that no longer decrypts (expired, tampered, rotated secret) is dropped.
    if (req.cookies?.[SESSION_COOKIE]) clearSession(req, res)
    throw new AuthError('unauthenticated')
  }
  const { user } = session
  if (!needsRefresh(session)) return { token: session.accessToken, user }

  const expire = (detail: string): never => {
    console.error(`[session] token refresh failed: ${detail}`)
    clearSession(req, res)
    throw new AuthError('session-expired')
  }
  if (!session.refreshToken || !canRefresh(session, nowSeconds())) {
    return expire('no usable refresh token')
  }
  let tokens: TokenSet
  try {
    tokens = await sharedRefresh(config, session.refreshToken)
  } catch (err) {
    // Status and GitHub's error code only; never tokens.
    return expire(err instanceof GitHubError ? `${err.status} ${err.detail}` : String(err))
  }
  await setSession(req, res, { ...tokens, user }, config.sessionSecret)
  if (isDevEnvironment()) console.info(`[session] refreshed the GitHub token for ${user.login}`)
  return { token: tokens.accessToken, user }
}
