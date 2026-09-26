/**
 * Server env vars. Never prefixed VITE_ and never sent to the browser.
 * Missing OAuth credentials mean "auth unavailable" (e.g. preview deployments), not a crash;
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

/** OAuth settings, or null when sign-in isn't configured for this deployment. */
export function getAuthConfig(): AuthConfig | null {
  const clientId = read('GITHUB_CLIENT_ID')
  const clientSecret = read('GITHUB_CLIENT_SECRET')
  if (!clientId && !clientSecret) return null

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
