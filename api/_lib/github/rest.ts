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
 * The GitHub App can't check membership in the org, so we can't tell whether the user is a
 * member: it isn't installed there, or the installation lacks (or hasn't approved) the
 * organization "Members: read" permission.
 */
export class OrgAccessError extends Error {
  readonly reason: 'app-not-installed' | 'app-missing-permission'

  constructor(reason: OrgAccessError['reason'], detail: string) {
    super(detail)
    this.name = 'OrgAccessError'
    this.reason = reason
  }
}

/**
 * The user's membership state in `org`: "active", "pending" (invited, not accepted), or
 * null when they aren't a member. A GitHub App user token only sees orgs where the app is
 * installed with "Members: read"; those setup problems throw OrgAccessError instead of
 * masquerading as "not a member".
 */
export async function getOrgMembershipState(
  token: string,
  org: string,
): Promise<'active' | 'pending' | null> {
  const res = await githubGet(token, `/user/memberships/orgs/${encodeURIComponent(org)}`)
  // GitHub answers 403 or 404 both when the app isn't installed on the org and when it
  // lacks "Members: read"; a 404 from an installed app means "not a member".
  if (res.status === 403 || res.status === 404) {
    const { message } = (await res.json().catch(() => ({}))) as { message?: string }
    const detail = `${res.status} ${message ?? ''}`.trim()
    if (!(await isAppInstalledOn(token, org))) {
      throw new OrgAccessError('app-not-installed', `${detail}; no installation on ${org}`)
    }
    if (res.status === 403) throw new OrgAccessError('app-missing-permission', detail)
    return null
  }
  if (!res.ok) throw new GitHubError('Could not check organization membership.', res.status)
  const body = (await res.json()) as { state?: string }
  return body.state === 'active' ? 'active' : body.state === 'pending' ? 'pending' : null
}

/** Whether this GitHub App is installed on `org` (among installations the user can see). */
async function isAppInstalledOn(token: string, org: string): Promise<boolean> {
  const res = await githubGet(token, '/user/installations?per_page=100')
  // Can't tell: assume installed, so the user gets the plain "not a member" answer.
  if (!res.ok) return true
  const body = (await res.json()) as { installations?: { account?: { login?: string } }[] }
  return (body.installations ?? []).some(
    (i) => i.account?.login?.toLowerCase() === org.toLowerCase(),
  )
}
