/**
 * A failed GitHub call. `detail` is for server logs only: never send it (or GitHub's raw
 * response) to the client.
 */
export class GitHubError extends Error {
  readonly status: number
  readonly detail: string

  constructor(message: string, status: number, detail = '') {
    super(message)
    this.name = 'GitHubError'
    this.status = status
    this.detail = detail
  }
}

/**
 * What went wrong, from the user's point of view:
 * - session-expired: the token was revoked or expired (the session cookie should be cleared)
 * - no-access: the org hasn't approved this OAuth app, or the user can't see the project
 * - rate-limited: GitHub's rate limit; retry later
 * - upstream: anything else GitHub got wrong
 */
export type GitHubErrorKind = 'session-expired' | 'no-access' | 'rate-limited' | 'upstream'

export class GitHubApiError extends GitHubError {
  readonly kind: GitHubErrorKind
  /** Seconds until GitHub will accept requests again, when it told us. */
  readonly retryAfter?: number

  constructor(kind: GitHubErrorKind, status: number, detail = '', retryAfter?: number) {
    super(CLIENT_ERRORS[kind].message, status, detail)
    this.name = 'GitHubApiError'
    this.kind = kind
    this.retryAfter = retryAfter
  }
}

/**
 * The project exists but is set up differently than the site expects (e.g. a required field
 * was renamed). The message names the field, so it is safe and useful to show.
 */
export class ProjectSetupError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ProjectSetupError'
  }
}

export interface ClientError {
  status: number
  code: string
  message: string
}

const CLIENT_ERRORS: Record<GitHubErrorKind, ClientError> = {
  'session-expired': {
    status: 401,
    code: 'session-expired',
    message: 'Your GitHub session has expired. Sign in again to continue.',
  },
  'no-access': {
    status: 403,
    code: 'no-project-access',
    message:
      "GitHub denied access: the organization hasn't approved this app, or you lack access to the team's project.",
  },
  'rate-limited': {
    status: 429,
    code: 'rate-limited',
    message: "GitHub's rate limit was reached. Please try again in a few minutes.",
  },
  upstream: {
    status: 502,
    code: 'github-unavailable',
    message: "GitHub didn't respond as expected. Please try again.",
  },
}

/** The safe, client-facing version of a GitHub failure. */
export function toClientError(err: GitHubApiError): ClientError {
  return CLIENT_ERRORS[err.kind]
}
