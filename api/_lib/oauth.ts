import { randomBytes, timingSafeEqual } from 'node:crypto'
import { deriveKey, seal, unseal } from './crypto.js'

export const STATE_COOKIE = 'dawn_oauth_state'
/** Long enough to finish GitHub's consent screen; short enough to limit replay. */
export const STATE_MAX_AGE = 10 * 60
export const DEFAULT_RETURN_TO = '/tasks'

/**
 * Only same-site relative paths are allowed after sign-in, so the callback can't be used
 * as an open redirect. Anything else falls back to /tasks.
 */
export function sanitizeReturnTo(value: unknown): string {
  if (typeof value !== 'string') return DEFAULT_RETURN_TO
  const raw = value.trim()
  // Must be a path: "/x", not "//host", "/\host", or "https://…". No control characters.
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\')) return DEFAULT_RETURN_TO
  if (hasControlCharacters(raw) || raw.length > 512) return DEFAULT_RETURN_TO
  try {
    const base = 'https://site.invalid'
    const url = new URL(raw, base)
    if (url.origin !== base) return DEFAULT_RETURN_TO
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return DEFAULT_RETURN_TO
  }
}

function hasControlCharacters(text: string): boolean {
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i)
    if (code < 0x20 || code === 0x7f) return true
  }
  return false
}

export function createState(): string {
  return randomBytes(32).toString('base64url')
}

interface StateCookie {
  state: string
  returnTo: string
}

/** The state and where to go afterwards travel together in one encrypted cookie. */
export async function sealState(data: StateCookie, secret: string): Promise<string> {
  return seal({ ...data }, deriveKey(secret, 'oauth-state'), STATE_MAX_AGE)
}

export async function unsealState(value: string, secret: string): Promise<StateCookie | null> {
  const payload = await unseal(value, deriveKey(secret, 'oauth-state'))
  if (!payload || typeof payload.state !== 'string') return null
  return { state: payload.state, returnTo: sanitizeReturnTo(payload.returnTo) }
}

/** Constant-time comparison of the state GitHub sent back with the one we issued. */
export function verifyState(expected: string | undefined, received: unknown): boolean {
  if (!expected || typeof received !== 'string' || received.length === 0) return false
  const a = Buffer.from(expected)
  const b = Buffer.from(received)
  return a.length === b.length && timingSafeEqual(a, b)
}
