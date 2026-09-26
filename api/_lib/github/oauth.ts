import { GitHubError } from './errors.js'

/**
 * `repo` is needed to read (and later edit) issues and PRs in PRIVATE repos: without it,
 * GitHub returns those project items with their content redacted. OAuth apps have no
 * read-only variant.
 */
export const OAUTH_SCOPES = 'read:user read:org project repo'
export const USER_AGENT = 'dawn-team-site'

interface OAuthApp {
  clientId: string
  clientSecret: string
}

export function authorizeUrl(clientId: string, redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: OAUTH_SCOPES,
    state,
    allow_signup: 'false',
  })
  return `https://github.com/login/oauth/authorize?${params}`
}

/** Exchanges the callback's `code` for a user access token. */
export async function exchangeCode(
  app: OAuthApp,
  code: string,
  redirectUri: string,
): Promise<string> {
  const res = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'User-Agent': USER_AGENT,
    },
    body: JSON.stringify({
      client_id: app.clientId,
      client_secret: app.clientSecret,
      code,
      redirect_uri: redirectUri,
    }),
  })
  const body = (await res.json().catch(() => ({}))) as {
    access_token?: string
    error?: string
  }
  if (!res.ok || !body.access_token) {
    throw new GitHubError('Could not exchange the OAuth code.', res.status, body.error ?? '')
  }
  return body.access_token
}

/**
 * Revokes the OAuth grant (all of this app's tokens for the user), so signing out on the
 * site also ends GitHub access. Basic auth with the app's client id/secret.
 */
export async function revokeGrant(app: OAuthApp, accessToken: string): Promise<void> {
  const res = await fetch(`https://api.github.com/applications/${app.clientId}/grant`, {
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
  if (!res.ok && res.status !== 404) {
    throw new GitHubError('Could not revoke the GitHub grant.', res.status)
  }
}
