import type { SessionUser } from '../session.js'
import { GitHubError } from './errors.js'
import { USER_AGENT } from './oauth.js'

async function githubGet(token: string, path: string): Promise<Response> {
  return fetch(`https://api.github.com${path}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'User-Agent': USER_AGENT,
      'X-GitHub-Api-Version': '2022-11-28',
    },
  })
}

/** The signed-in user's public profile. */
export async function getViewer(token: string): Promise<SessionUser> {
  const res = await githubGet(token, '/user')
  if (!res.ok) throw new GitHubError('Could not load the GitHub user.', res.status)
  const user = (await res.json()) as { login: string; name: string | null; avatar_url: string }
  return { login: user.login, name: user.name || user.login, avatarUrl: user.avatar_url }
}

/**
 * The user's membership state in `org`: "active", "pending" (invited, not accepted), or
 * null when they aren't a member. GitHub answers 404 for non-members, and also when the org
 * restricts third-party OAuth apps and hasn't approved this one.
 */
export async function getOrgMembershipState(
  token: string,
  org: string,
): Promise<'active' | 'pending' | null> {
  const res = await githubGet(token, `/user/memberships/orgs/${encodeURIComponent(org)}`)
  if (res.status === 404 || res.status === 403) return null
  if (!res.ok) throw new GitHubError('Could not check organization membership.', res.status)
  const body = (await res.json()) as { state?: string }
  return body.state === 'active' ? 'active' : body.state === 'pending' ? 'pending' : null
}
