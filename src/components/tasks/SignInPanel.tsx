import { CircleAlert, LogIn } from 'lucide-react'
import { useAuth } from '../../lib/auth'
import { buttonClasses } from '../buttonStyles'

/**
 * "Tasks are for the team: sign in", with an optional error from a failed sign-in. After
 * signing in, the user lands on `returnTo` (a same-site path), else the Dashboard.
 */
export default function SignInPanel({ error, returnTo }: { error?: string; returnTo?: string }) {
  const { authAvailable, signIn } = useAuth()
  return (
    <div className="max-w-prose">
      {error && (
        <p
          role="alert"
          className="shadow-card mb-6 flex gap-3 rounded-2xl border border-link/30 bg-surface p-4 text-ink"
        >
          <CircleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-link" />
          {error}
        </p>
      )}
      <p className="text-lg">Tasks are for the D.A.W.N. team. Sign in with your GitHub account.</p>
      {authAvailable ? (
        <button
          type="button"
          onClick={() => signIn(returnTo)}
          className={`mt-6 ${buttonClasses('primary')}`}
        >
          <LogIn aria-hidden="true" className="size-4" />
          Sign in with GitHub
        </button>
      ) : (
        <p className="mt-4 text-ink-muted">
          Sign-in isn&apos;t available right now. Please try again in a few minutes.
        </p>
      )}
    </div>
  )
}
