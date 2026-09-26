import type { AuthUser } from './types'

export interface MeResult {
  user: AuthUser | null
  authAvailable: boolean
}

/**
 * Asks the server who's signed in. Anything unexpected (no /api when running `npm run dev`,
 * a server error, a network failure) is treated as "sign-in unavailable", not a crash.
 */
export async function fetchMe(): Promise<MeResult> {
  try {
    const res = await fetch('/api/auth/me', {
      headers: { Accept: 'application/json' },
      credentials: 'same-origin',
    })
    const isJson = res.headers.get('content-type')?.includes('application/json')
    if (!res.ok || !isJson) {
      if (import.meta.env.DEV) console.warn(`[auth] /api/auth/me unavailable (${res.status})`)
      return { user: null, authAvailable: false }
    }
    const body = (await res.json()) as { user: AuthUser | null; authAvailable?: boolean }
    if (body.user) return { user: body.user, authAvailable: true }
    return { user: null, authAvailable: body.authAvailable ?? false }
  } catch {
    return { user: null, authAvailable: false }
  }
}

export function loginUrl(returnTo = '/tasks'): string {
  return `/api/auth/login?returnTo=${encodeURIComponent(returnTo)}`
}

/** Logout is a POST (the server checks its Origin); a form submit lets it redirect us home. */
export function submitLogout(): void {
  const form = document.createElement('form')
  form.method = 'POST'
  form.action = '/api/auth/logout'
  form.hidden = true
  document.body.append(form)
  form.submit()
}
