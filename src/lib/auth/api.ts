import type { AuthUser } from './types'

export interface MeResult {
  user: AuthUser | null
  authAvailable: boolean
  /**
   * The server said sign-in isn't configured here (a preview deployment), so the Tasks UI
   * shows sample data. In dev, a missing /api (`npm run dev`) counts too.
   */
  preview: boolean
}

/**
 * Asks the server who's signed in. Anything unexpected (a server error, a network failure)
 * is treated as "sign-in unavailable right now", not a crash, and never as a preview: a
 * broken production API must not show sample data as if it were the team's tasks.
 */
export async function fetchMe(): Promise<MeResult> {
  const unavailable = { user: null, authAvailable: false, preview: import.meta.env.DEV }
  try {
    const res = await fetch('/api/auth/me', {
      headers: { Accept: 'application/json' },
      credentials: 'same-origin',
    })
    const isJson = res.headers.get('content-type')?.includes('application/json')
    if (!res.ok || !isJson) {
      if (import.meta.env.DEV) console.warn(`[auth] /api/auth/me unavailable (${res.status})`)
      return unavailable
    }
    const body = (await res.json()) as { user: AuthUser | null; authAvailable?: boolean }
    if (body.user) return { user: body.user, authAvailable: true, preview: false }
    return {
      user: null,
      authAvailable: body.authAvailable === true,
      preview: body.authAvailable === false,
    }
  } catch {
    return unavailable
  }
}

export function loginUrl(returnTo = '/dashboard'): string {
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
