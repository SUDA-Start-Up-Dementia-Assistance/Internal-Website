export interface CookieOptions {
  maxAgeSeconds: number
  secure: boolean
  path?: string
}

/** HttpOnly, SameSite=Lax cookie. Values are JWEs (URL-safe), so no extra encoding needed. */
export function serializeCookie(name: string, value: string, options: CookieOptions): string {
  const parts = [
    `${name}=${value}`,
    `Path=${options.path ?? '/'}`,
    `Max-Age=${options.maxAgeSeconds}`,
    'HttpOnly',
    'SameSite=Lax',
  ]
  if (options.secure) parts.push('Secure')
  return parts.join('; ')
}

export function expiredCookie(name: string, options: Omit<CookieOptions, 'maxAgeSeconds'>): string {
  return serializeCookie(name, '', { ...options, maxAgeSeconds: 0 })
}
