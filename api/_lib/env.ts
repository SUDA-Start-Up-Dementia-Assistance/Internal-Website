/**
 * Server env vars. Never prefixed VITE_ and never sent to the browser.
 * Missing GitHub App credentials mean "auth unavailable" (e.g. preview deployments), not a crash;
 * a partial setup fails with an error naming what's missing.
 */

export class ConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ConfigError'
  }
}

export interface AuthConfig {
  clientId: string
  clientSecret: string
  sessionSecret: string
  org: string
}

function read(name: string): string | undefined {
  const value = process.env[name]?.trim()
  return value ? value : undefined
}

/** GitHub App sign-in settings, or null when sign-in isn't configured for this deployment. */
export function getAuthConfig(): AuthConfig | null {
  const clientId = read('GITHUB_CLIENT_ID')
  const clientSecret = read('GITHUB_CLIENT_SECRET')
  // Previews may run without sign-in (the site then shows sample tasks); production may not.
  if (!clientId && !clientSecret && process.env.VERCEL_ENV !== 'production') return null

  const values = {
    GITHUB_CLIENT_ID: clientId,
    GITHUB_CLIENT_SECRET: clientSecret,
    SESSION_SECRET: read('SESSION_SECRET'),
    GITHUB_ORG: read('GITHUB_ORG'),
  }
  const missing = Object.entries(values)
    .filter(([, v]) => !v)
    .map(([k]) => k)
  if (missing.length > 0) {
    throw new ConfigError(`Missing required environment variable(s): ${missing.join(', ')}.`)
  }
  return {
    clientId: values.GITHUB_CLIENT_ID!,
    clientSecret: values.GITHUB_CLIENT_SECRET!,
    sessionSecret: values.SESSION_SECRET!,
    org: values.GITHUB_ORG!,
  }
}

export interface ProjectConfig {
  org: string
  projectNumber: number
}

/** Which GitHub Project holds the tasks. Both variables are required for task endpoints. */
export function getProjectConfig(): ProjectConfig {
  const org = read('GITHUB_ORG')
  const rawNumber = read('GITHUB_PROJECT_NUMBER')
  const missing = [!org && 'GITHUB_ORG', !rawNumber && 'GITHUB_PROJECT_NUMBER'].filter(Boolean)
  if (missing.length > 0) {
    throw new ConfigError(`Missing required environment variable(s): ${missing.join(', ')}.`)
  }
  const projectNumber = Number(rawNumber)
  if (!Number.isInteger(projectNumber) || projectNumber <= 0) {
    throw new ConfigError('GITHUB_PROJECT_NUMBER must be a positive whole number.')
  }
  return { org: org!, projectNumber }
}

/** Like getAuthConfig, but for code paths that can't run without auth. */
export function requireAuthConfig(): AuthConfig {
  const config = getAuthConfig()
  if (!config) {
    throw new ConfigError(
      'Sign-in is not configured: set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET.',
    )
  }
  return config
}

/** True everywhere except real deployments (local `vercel dev`, tests). */
export function isDevEnvironment(): boolean {
  const env = read('VERCEL_ENV')
  return env !== 'production' && env !== 'preview'
}

/**
 * Dev-only testing aid: DEV_TOKEN_REFRESH_AFTER_SECONDS=10 pretends every new GitHub
 * access token is due for refresh 10 seconds after it was issued, so the refresh path can
 * be exercised without waiting ~8 hours. Ignored on production and preview deployments.
 */
export function devRefreshAfterSeconds(): number | undefined {
  if (!isDevEnvironment()) return undefined
  const raw = read('DEV_TOKEN_REFRESH_AFTER_SECONDS')
  if (raw === undefined) return undefined
  const seconds = Number(raw)
  if (!Number.isFinite(seconds) || seconds < 0) {
    throw new ConfigError('DEV_TOKEN_REFRESH_AFTER_SECONDS must be a number of seconds.')
  }
  return seconds
}
