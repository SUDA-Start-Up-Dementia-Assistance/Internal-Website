import { devRefreshAfterSeconds } from '../env.js'
import { GitHubError } from './errors.js'

/*
 * Sign-in uses a GitHub App. Its permissions are configured on the app itself (see
 * CLAUDE.md), so the authorize URL carries no `scope`. User tokens expire (~8h) and come
 * with a refresh token (~6 months).
 */
export const USER_AGENT = 'dawn-team-site'

/** Access tokens are refreshed this long before GitHub says they expire. */
export const REFRESH_MARGIN_SECONDS = 5 * 60

interface OAuthApp {
  clientId: string
  clientSecret: string
}

/** A user's tokens. Times are Unix seconds; absent when GitHub didn't send an expiry. */
export interface TokenSet {
  accessToken: string
  accessTokenExpiresAt?: number
  refreshToken?: string
  refreshTokenExpiresAt?: number
}

export function authorizeUrl(clientId: string, redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    state,
    allow_signup: 'false',
  })
  return `https://github.com/login/oauth/authorize?${params}`
}

/** Exchanges the callback's `code` for the user's tokens. */
export async function exchangeCode(
  app: OAuthApp,
  code: string,
  redirectUri: string,
): Promise<TokenSet> {
  return requestTokens(
    { client_id: app.clientId, client_secret: app.clientSecret, code, redirect_uri: redirectUri },
    'Could not exchange the OAuth code.',
  )
}

/** Trades a refresh token for a new access token AND a new refresh token (single use). */
export async function refreshTokens(app: OAuthApp, refreshToken: string): Promise<TokenSet> {
  return requestTokens(
    {
      client_id: app.clientId,
      client_secret: app.clientSecret,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    },
    'Could not refresh the GitHub token.',
  )
}

interface TokenResponse {
  access_token?: string
  expires_in?: number
  refresh_token?: string
  refresh_token_expires_in?: number
  error?: string
}

async function requestTokens(params: Record<string, string>, failure: string): Promise<TokenSet> {
  let res: Response
  try {
    res = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': USER_AGENT,
      },
      body: JSON.stringify(params),
    })
  } catch (err) {
    throw new GitHubError(failure, 0, `network: ${String(err)}`)
  }
  // GitHub reports failures like bad_refresh_token with a 200 and an `error` field.
  const body = (await res.json().catch(() => ({}))) as TokenResponse
  if (!res.ok || !body.access_token) {
    throw new GitHubError(failure, res.status, body.error ?? '')
  }
  return toTokenSet(body, Math.floor(Date.now() / 1000))
}

export function toTokenSet(body: TokenResponse, now: number): TokenSet {
  const tokens: TokenSet = { accessToken: body.access_token! }
  const devAfter = devRefreshAfterSeconds()
  if (devAfter !== undefined) {
    tokens.accessTokenExpiresAt = now + devAfter + REFRESH_MARGIN_SECONDS
  } else if (isPositive(body.expires_in)) {
    tokens.accessTokenExpiresAt = now + body.expires_in
  }
  if (body.refresh_token) {
    tokens.refreshToken = body.refresh_token
    if (isPositive(body.refresh_token_expires_in)) {
      tokens.refreshTokenExpiresAt = now + body.refresh_token_expires_in
    }
  }
  return tokens
}

function isPositive(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

/**
 * Revokes the user's access token, so signing out on the site also ends GitHub access.
 * Basic auth with the app's client id/secret.
 */
export async function revokeToken(app: OAuthApp, accessToken: string): Promise<void> {
  const res = await fetch(`https://api.github.com/applications/${app.clientId}/token`, {
    method: 'DELETE',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Basic ${Buffer.from(`${app.clientId}:${app.clientSecret}`).toString('base64')}`,
      'Content-Type': 'application/json',
      'User-Agent': USER_AGENT,
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: JSON.stringify({ access_token: accessToken }),
  })
  // 404: the token was already revoked or had expired.
  if (!res.ok && res.status !== 404) {
    throw new GitHubError('Could not revoke the GitHub token.', res.status)
  }
}
