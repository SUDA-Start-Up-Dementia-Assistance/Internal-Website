import { GitHubApiError, isNotAccessibleByIntegration, type GitHubErrorKind } from './errors.js'
import { USER_AGENT } from './oauth.js'

const ENDPOINT = 'https://api.github.com/graphql'

interface GraphQLErrorEntry {
  type?: string
  message?: string
  path?: (string | number)[]
}

interface GraphQLBody<T> {
  data?: T | null
  errors?: GraphQLErrorEntry[]
  message?: string
}

const NO_ACCESS_TYPES = new Set(['FORBIDDEN', 'NOT_FOUND', 'INSUFFICIENT_SCOPES'])

/**
 * Errors this deep are about a single node (e.g. organization.projectV2.items.nodes.3.content
 * for an issue in a repo the user can't see). They don't invalidate the rest of the
 * response, so they're logged and skipped. Shallower ones (the org, the project, a whole
 * connection) fail the request.
 */
const TOLERATED_ERROR_DEPTH = 5

export interface GraphQLContext {
  /** "owner/name" of the repo a query or mutation is about, named in app-not-installed errors. */
  repo?: string
}

/**
 * Runs a GraphQL query as the signed-in user. Failures become typed GitHubApiErrors:
 * 401 → session-expired, the app missing from a repo → app-not-installed, other permission
 * problems → no-access, rate limits → rate-limited.
 */
export async function graphql<T>(
  token: string,
  query: string,
  variables: Record<string, unknown> = {},
  context: GraphQLContext = {},
): Promise<T> {
  let res: Response
  try {
    res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'User-Agent': USER_AGENT,
      },
      body: JSON.stringify({ query, variables }),
    })
  } catch (err) {
    throw new GitHubApiError('upstream', 0, `network: ${String(err)}`)
  }

  const body = (await res.json().catch(() => ({}))) as GraphQLBody<T>

  if (!res.ok) {
    const kind = httpErrorKind(res, body)
    throw new GitHubApiError(
      kind,
      res.status,
      body.message ?? '',
      retryAfterSeconds(res),
      context.repo,
    )
  }

  const errors = body.errors ?? []
  const fatal = errors.filter(
    (e) =>
      !body.data || !e.path || e.path.length < TOLERATED_ERROR_DEPTH || e.type === 'RATE_LIMITED',
  )
  if (fatal.length > 0 || !body.data) {
    const first = fatal[0] ?? errors[0]
    throw new GitHubApiError(
      graphqlErrorKind(fatal.length > 0 ? fatal : errors),
      res.status,
      first ? `${first.type ?? 'ERROR'}: ${first.message ?? ''}` : 'empty response',
      retryAfterSeconds(res),
      context.repo,
    )
  }
  if (errors.length > 0) {
    console.warn(
      `[github] ignoring ${errors.length} item-level GraphQL error(s), e.g. ${errors[0].type ?? 'ERROR'}`,
    )
  }
  return body.data
}

function httpErrorKind(res: Response, body: GraphQLBody<unknown>): GitHubErrorKind {
  if (res.status === 401) return 'session-expired'
  if (isRateLimited(res, body)) return 'rate-limited'
  if (res.status === 403 && isNotAccessibleByIntegration(body.message)) return 'app-not-installed'
  if (res.status === 403 || res.status === 404) return 'no-access'
  return 'upstream'
}

function isRateLimited(res: Response, body: GraphQLBody<unknown>): boolean {
  if (res.status === 429) return true
  if (res.status !== 403) return false
  return (
    res.headers.get('x-ratelimit-remaining') === '0' ||
    res.headers.has('retry-after') ||
    /rate limit/i.test(body.message ?? '')
  )
}

function graphqlErrorKind(errors: GraphQLErrorEntry[]): GitHubErrorKind {
  if (errors.some((e) => e.type === 'RATE_LIMITED')) return 'rate-limited'
  if (errors.some((e) => isNotAccessibleByIntegration(e.message))) return 'app-not-installed'
  if (errors.some((e) => e.type && NO_ACCESS_TYPES.has(e.type))) return 'no-access'
  return 'upstream'
}

function retryAfterSeconds(res: Response): number | undefined {
  const retryAfter = Number(res.headers.get('retry-after'))
  if (Number.isFinite(retryAfter) && retryAfter > 0) return retryAfter
  const reset = Number(res.headers.get('x-ratelimit-reset'))
  if (res.headers.get('x-ratelimit-remaining') === '0' && Number.isFinite(reset) && reset > 0) {
    return Math.max(1, Math.ceil(reset - Date.now() / 1000))
  }
  return undefined
}
