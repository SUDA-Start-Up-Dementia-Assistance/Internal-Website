import { useSearchParams } from 'react-router-dom'
import LoadingState from '../components/LoadingState'
import PageTitle from '../components/PageTitle'
import Skeleton from '../components/Skeleton'
import SignInPanel from '../components/tasks/SignInPanel'
import TasksView from '../components/tasks/TasksView'
import { useAuth } from '../lib/auth'

const ERROR_MESSAGES: Record<string, string> = {
  'not-a-member':
    "That GitHub account isn't an active member of the team's GitHub organization. If you were just invited, accept the invitation on GitHub, then sign in again.",
  'signin-failed': "Signing in with GitHub didn't work. Please try again.",
}

export default function Tasks() {
  const { user, loading } = useAuth()
  const [params] = useSearchParams()
  const error = ERROR_MESSAGES[params.get('error') ?? '']

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
          <SignInPanel error={error} />
        )}
      </div>
    </div>
  )
}
