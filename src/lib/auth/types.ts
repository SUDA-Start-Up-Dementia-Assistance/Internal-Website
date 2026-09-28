export interface AuthUser {
  login: string
  name: string
  avatarUrl: string
}

export interface AuthState {
  user: AuthUser | null
  loading: boolean
  /** False when sign-in isn't configured here (preview deployments, or no /api running). */
  authAvailable: boolean
  /** A preview deployment without sign-in: `user` is a sample user and tasks are sample data. */
  preview: boolean
  /** The server stopped accepting the session and the user was signed out. */
  sessionExpired: boolean
  /** Starts GitHub sign-in; afterwards the user lands on `returnTo` (default /tasks). */
  signIn: (returnTo?: string) => void
  signOut: () => void
}
