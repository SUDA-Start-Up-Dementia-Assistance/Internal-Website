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
  /** Starts GitHub sign-in; afterwards the user lands on `returnTo` (default /tasks). */
  signIn: (returnTo?: string) => void
  signOut: () => void
}
