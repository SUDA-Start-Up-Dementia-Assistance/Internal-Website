import type { VercelRequest, VercelResponse } from '@vercel/node'
import { expiredCookie, serializeCookie } from '../_lib/cookies.js'
import { getAuthConfig, type AuthConfig } from '../_lib/env.js'
import { GitHubError } from '../_lib/github/errors.js'
import { authorizeUrl, exchangeCode, revokeGrant } from '../_lib/github/oauth.js'
import { getOrgMembershipState, getViewer } from '../_lib/github/rest.js'
import { redirect, requireSameOrigin, sendError, sendJson, withErrors } from '../_lib/http.js'
import {
  STATE_COOKIE,
  STATE_MAX_AGE,
  createState,
  sanitizeReturnTo,
  sealState,
  unsealState,
  verifyState,
} from '../_lib/oauth.js'
import { appendSetCookie, isLocalhost, requestOrigin } from '../_lib/request.js'
import { SESSION_COOKIE, clearSession, getSession, setSession } from '../_lib/session.js'

/**
 * /api/auth/login | callback | logout | me. One file, because Vercel Hobby allows only 12
 * functions per deployment.
 */
const ACTIONS = {
  login: { method: 'GET', run: login },
  callback: { method: 'GET', run: callback },
  logout: { method: 'POST', run: logout },
  me: { method: 'GET', run: me },
} as const

export default withErrors(async (req, res) => {
  const name = String(req.query.action)
  // Own keys only, so names like "constructor" don't resolve to Object built-ins.
  if (!Object.hasOwn(ACTIONS, name)) return sendError(res, 404, 'not-found', 'Unknown auth action.')
  const action = ACTIONS[name as keyof typeof ACTIONS]
  if (!allow(req, res, action.method)) return
  // Mutating requests must come from the site itself.
  if (action.method === 'POST' && !requireSameOrigin(req, res)) return
  await action.run(req, res)
})

function allow(req: VercelRequest, res: VercelResponse, method: 'GET' | 'POST'): boolean {
  if (req.method === method || (method === 'GET' && req.method === 'HEAD')) return true
  res.setHeader('Allow', method)
  sendError(res, 405, 'method-not-allowed', `Use ${method} for this endpoint.`)
  return false
}

const STATE_COOKIE_PATH = '/api/auth'

function callbackUrl(req: VercelRequest): string {
  return `${requestOrigin(req)}/api/auth/callback`
}

/** Start sign-in: remember a random state (and where to return) in a short-lived cookie. */
async function login(req: VercelRequest, res: VercelResponse): Promise<void> {
  const config = getAuthConfig()
  // Sign-in isn't configured on this deployment; the Tasks page explains that.
  if (!config) return redirect(res, '/tasks')

  const state = createState()
  const returnTo = sanitizeReturnTo(req.query.returnTo)
  appendSetCookie(
    res,
    serializeCookie(STATE_COOKIE, await sealState({ state, returnTo }, config.sessionSecret), {
      maxAgeSeconds: STATE_MAX_AGE,
      secure: !isLocalhost(req),
      path: STATE_COOKIE_PATH,
    }),
  )
  redirect(res, authorizeUrl(config.clientId, callbackUrl(req), state))
}

/** Finish sign-in: verify state, exchange the code, require active org membership. */
async function callback(req: VercelRequest, res: VercelResponse): Promise<void> {
  // The state cookie is single-use: clear it whatever happens next.
  appendSetCookie(
    res,
    expiredCookie(STATE_COOKIE, { secure: !isLocalhost(req), path: STATE_COOKIE_PATH }),
  )
  const fail = (reason: 'signin-failed' | 'not-a-member') => redirect(res, `/tasks?error=${reason}`)

  const config = getAuthConfig()
  if (!config) return fail('signin-failed')

  const stateCookie = req.cookies?.[STATE_COOKIE]
  const stored = stateCookie ? await unsealState(stateCookie, config.sessionSecret) : null
  if (!stored || !verifyState(stored.state, req.query.state)) return fail('signin-failed')
  // e.g. ?error=access_denied when the user cancels on GitHub
  if (req.query.error || typeof req.query.code !== 'string') return fail('signin-failed')

  let token: string
  try {
    token = await exchangeCode(config, req.query.code, callbackUrl(req))
  } catch (err) {
    logGitHubFailure('code exchange', err)
    return fail('signin-failed')
  }

  try {
    const [user, membership] = await Promise.all([
      getViewer(token),
      getOrgMembershipState(token, config.org),
    ])
    if (membership !== 'active') {
      await revokeQuietly(config, token)
      return fail('not-a-member')
    }
    await setSession(req, res, { token, user }, config.sessionSecret)
    redirect(res, stored.returnTo)
  } catch (err) {
    logGitHubFailure('user lookup', err)
    await revokeQuietly(config, token)
    fail('signin-failed')
  }
}

/** Sign out: revoke the GitHub grant (best effort), then always clear the cookie. */
async function logout(req: VercelRequest, res: VercelResponse): Promise<void> {
  const config = getAuthConfig()
  const session = config ? await getSession(req) : null
  if (config && session) await revokeQuietly(config, session.token)
  clearSession(req, res)
  // 303 so the browser follows with a GET to the home page.
  redirect(res, '/', 303)
}

/** Who's signed in, and whether sign-in is available on this deployment at all. */
async function me(req: VercelRequest, res: VercelResponse): Promise<void> {
  const config = getAuthConfig()
  if (!config) return sendJson(res, 200, { user: null, authAvailable: false })

  const session = await getSession(req)
  if (session) return sendJson(res, 200, { user: session.user })
  // A cookie we can't read (expired, tampered, or the secret rotated): drop it.
  if (req.cookies?.[SESSION_COOKIE]) clearSession(req, res)
  sendJson(res, 200, { user: null, authAvailable: true })
}

async function revokeQuietly(config: AuthConfig, token: string): Promise<void> {
  try {
    await revokeGrant(config, token)
  } catch (err) {
    logGitHubFailure('grant revocation', err)
  }
}

function logGitHubFailure(step: string, err: unknown): void {
  // Status and GitHub's error code only; never tokens.
  const detail = err instanceof GitHubError ? `${err.status} ${err.detail}` : String(err)
  console.error(`[auth] ${step} failed: ${detail}`)
}
