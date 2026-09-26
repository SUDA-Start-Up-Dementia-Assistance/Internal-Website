import type { VercelRequest, VercelResponse } from '@vercel/node'
import { expiredCookie, serializeCookie } from './cookies.js'
import { deriveKey, seal, unseal } from './crypto.js'
import { getAuthConfig } from './env.js'
import { appendSetCookie, isLocalhost } from './request.js'

export const SESSION_COOKIE = 'dawn_session'
export const SESSION_MAX_AGE = 7 * 24 * 60 * 60

export interface SessionUser {
  login: string
  name: string
  avatarUrl: string
}

/** The GitHub token lives only in this encrypted, HttpOnly cookie, never in browser JS. */
export interface Session {
  token: string
  user: SessionUser
}

function sessionKey(secret: string): Uint8Array {
  return deriveKey(secret, 'session')
}

export async function encryptSession(session: Session, secret: string): Promise<string> {
  return seal({ token: session.token, user: session.user }, sessionKey(secret), SESSION_MAX_AGE)
}

export async function decryptSession(value: string, secret: string): Promise<Session | null> {
  const payload = await unseal(value, sessionKey(secret))
  if (!payload) return null
  const { token, user } = payload as Partial<Session>
  if (typeof token !== 'string' || !user || typeof user.login !== 'string') return null
  return {
    token,
    user: { login: user.login, name: user.name || user.login, avatarUrl: user.avatarUrl ?? '' },
  }
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
  const value = await encryptSession(session, secret)
  appendSetCookie(
    res,
    serializeCookie(SESSION_COOKIE, value, {
      maxAgeSeconds: SESSION_MAX_AGE,
      secure: !isLocalhost(req),
    }),
  )
}

export function clearSession(req: VercelRequest, res: VercelResponse): void {
  appendSetCookie(res, expiredCookie(SESSION_COOKIE, { secure: !isLocalhost(req) }))
}
