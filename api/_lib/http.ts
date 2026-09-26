import type { VercelRequest, VercelResponse } from '@vercel/node'
import { ConfigError } from './env.js'
import { GitHubApiError, ProjectSetupError, toClientError } from './github/errors.js'
import { firstHeader, requestOrigin } from './request.js'
import { clearSession, getSession, type Session } from './session.js'

export interface ErrorBody {
  error: { code: string; message: string }
}

export function sendJson(res: VercelResponse, status: number, body: unknown): void {
  res.setHeader('Cache-Control', 'no-store')
  res.status(status).json(body)
}

/** Every failure uses this shape. Never pass raw GitHub error bodies or tokens here. */
export function sendError(
  res: VercelResponse,
  status: number,
  code: string,
  message: string,
): void {
  sendJson(res, status, { error: { code, message } } satisfies ErrorBody)
}

export function redirect(res: VercelResponse, location: string, status = 302): void {
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('Location', location)
  res.status(status).end()
}

/** Returns the session, or sends 401 and returns null. */
export async function requireSession(
  req: VercelRequest,
  res: VercelResponse,
): Promise<Session | null> {
  const session = await getSession(req)
  if (!session) {
    sendError(res, 401, 'unauthenticated', 'Sign in with GitHub to continue.')
    return null
  }
  return session
}

/**
 * For mutating requests (POST/PATCH/DELETE): the Origin header must be this site's origin.
 * Sends 403 and returns false otherwise.
 */
export function requireSameOrigin(req: VercelRequest, res: VercelResponse): boolean {
  const origin = firstHeader(req, 'origin')
  if (!origin || origin !== requestOrigin(req)) {
    sendError(res, 403, 'bad-origin', 'This request must come from the site itself.')
    return false
  }
  return true
}

type Handler = (req: VercelRequest, res: VercelResponse) => Promise<void> | void

/** Wraps a route so unexpected errors become a JSON error instead of a crash or a leak. */
export function withErrors(handler: Handler): Handler {
  return async (req, res) => {
    try {
      await handler(req, res)
    } catch (err) {
      if (res.headersSent) return
      if (err instanceof GitHubApiError) {
        // Status and GitHub's error code only; never tokens or raw bodies.
        console.error(`[github] ${err.kind} (${err.status}) ${err.detail}`)
        // The token is dead: drop the cookie so the site shows "Sign in" again.
        if (err.kind === 'session-expired') clearSession(req, res)
        if (err.retryAfter) res.setHeader('Retry-After', String(err.retryAfter))
        const { status, code, message } = toClientError(err)
        sendError(res, status, code, message)
      } else if (err instanceof ProjectSetupError) {
        console.error(err.message)
        sendError(res, 500, 'project-misconfigured', err.message)
      } else if (err instanceof ConfigError) {
        console.error(err.message)
        sendError(res, 500, 'server-misconfigured', err.message)
      } else {
        console.error(err)
        sendError(res, 500, 'internal', 'Something went wrong on our end.')
      }
    }
  }
}
