import { useSearchParams } from 'react-router-dom'
import LoadingState from '../components/LoadingState'
import PageTitle from '../components/PageTitle'
import Skeleton from '../components/Skeleton'
import SignInPanel from '../components/tasks/SignInPanel'
import TasksView from '../components/tasks/TasksView'
import { SESSION_EXPIRED_MESSAGE, useAuth } from '../lib/auth'

const ERROR_MESSAGES: Record<string, string> = {
  'not-a-member':
    "That GitHub account isn't an active member of the team's GitHub organization. If you were just invited, accept the invitation on GitHub, then sign in again.",
  'signin-failed': "Signing in with GitHub didn't work. Please try again.",
  'app-not-installed':
    "The DAWN Team Site app isn't installed on the team's GitHub organization, so we can't confirm you're a member. Ask an org owner to install it.",
  'app-missing-permission':
    "The DAWN Team Site app can't read the organization's members yet. An org owner needs to grant (or approve) its \"Members: read\" permission in the organization's GitHub App settings.",
}

export default function Tasks() {
  const { user, loading, sessionExpired } = useAuth()
  const [params] = useSearchParams()
  const error = sessionExpired ? SESSION_EXPIRED_MESSAGE : ERROR_MESSAGES[params.get('error') ?? '']
  const returnTo = safeReturnTo(params.get('returnTo'))

  return (
    <div className="mx-auto max-w-5xl px-6 py-12 sm:py-16">
      <PageTitle title="Tasks" />
      <h1 className="text-4xl font-semibold">Tasks</h1>
      <div aria-hidden="true" className="mt-6 horizon-line w-24" />

      <div className="mt-10">
        {loading ? (
          <LoadingState>
            <Skeleton className="h-5 w-72" />
            <Skeleton className="mt-6 h-10 w-52 rounded-full" />
          </LoadingState>
        ) : user ? (
          <TasksView login={user.login} />
        ) : (
          <SignInPanel error={error} returnTo={returnTo} />
        )}
      </div>
    </div>
  )
}

/** Only same-site paths ("/dashboard"); the server re-checks it too. */
function safeReturnTo(value: string | null): string | undefined {
  return value && value.startsWith('/') && !value.startsWith('//') && !value.includes('\\')
    ? value
    : undefined
}
