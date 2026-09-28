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
 * - no-access: the user can't see the org or the project
 * - app-not-installed: the GitHub App isn't installed on a repo the call touched (user tokens
 *   from a GitHub App only reach repos where the app is installed)
 * - rate-limited: GitHub's rate limit; retry later
 * - upstream: anything else GitHub got wrong
 */
export type GitHubErrorKind =
  'session-expired' | 'no-access' | 'app-not-installed' | 'rate-limited' | 'upstream'

export class GitHubApiError extends GitHubError {
  readonly kind: GitHubErrorKind
  /** Seconds until GitHub will accept requests again, when it told us. */
  readonly retryAfter?: number
  /** "owner/name" of the repo the call was about, when the caller knew it. */
  readonly repo?: string

  constructor(
    kind: GitHubErrorKind,
    status: number,
    detail = '',
    retryAfter?: number,
    repo?: string,
  ) {
    super(CLIENT_ERRORS[kind].message, status, detail)
    this.name = 'GitHubApiError'
    this.kind = kind
    this.retryAfter = retryAfter
    this.repo = repo
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

/**
 * The issue was created, but adding it to the project failed. Its own error (not a GitHub
 * failure) so the user learns the issue exists and doesn't retry into a duplicate.
 */
export class IssueNotAddedError extends Error {
  readonly issueUrl: string

  constructor(repo: string, number: number, issueUrl: string) {
    super(
      `Issue #${number} was created in ${repo}, but it couldn't be added to the project. Add it from the project board (it's at ${issueUrl}) rather than creating it again.`,
    )
    this.name = 'IssueNotAddedError'
    this.issueUrl = issueUrl
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
    message: "GitHub denied access: you don't have access to the team's project.",
  },
  'app-not-installed': {
    status: 403,
    code: 'app-not-installed',
    message: appNotInstalledMessage(),
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

export function appNotInstalledMessage(repo?: string): string {
  return `The DAWN Team Site app isn't installed on ${repo ?? 'that repository'}. Ask an org owner to add it.`
}

/**
 * GitHub's wording when a GitHub App user token reaches a repo the app isn't installed on
 * (or lacks a permission there). REST sends it as a 403 message, GraphQL as a FORBIDDEN error.
 */
export function isNotAccessibleByIntegration(message: string | undefined): boolean {
  return /Resource not accessible by integration/i.test(message ?? '')
}

/** The safe, client-facing version of a GitHub failure. */
export function toClientError(err: GitHubApiError): ClientError {
  if (err.kind === 'app-not-installed') {
    return { ...CLIENT_ERRORS[err.kind], message: appNotInstalledMessage(err.repo) }
  }
  return CLIENT_ERRORS[err.kind]
}
