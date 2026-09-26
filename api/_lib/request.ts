import type { VercelRequest, VercelResponse } from '@vercel/node'

/** Adds a Set-Cookie header without dropping ones already set on this response. */
export function appendSetCookie(res: VercelResponse, cookie: string): void {
  const existing = res.getHeader('Set-Cookie')
  const list = existing === undefined ? [] : Array.isArray(existing) ? existing : [String(existing)]
  res.setHeader('Set-Cookie', [...list, cookie])
}

export function firstHeader(req: VercelRequest, name: string): string | undefined {
  const value = req.headers[name]
  return (Array.isArray(value) ? value[0] : value)?.split(',')[0]?.trim() || undefined
}

export function requestHost(req: VercelRequest): string {
  return firstHeader(req, 'x-forwarded-host') ?? firstHeader(req, 'host') ?? 'localhost'
}

export function isLocalhost(req: VercelRequest): boolean {
  return /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(requestHost(req))
}

/** This deployment's own origin, e.g. "https://dawn.vercel.app" or "http://localhost:3000". */
export function requestOrigin(req: VercelRequest): string {
  const proto = firstHeader(req, 'x-forwarded-proto') ?? (isLocalhost(req) ? 'http' : 'https')
  return `${proto}://${requestHost(req)}`
}
