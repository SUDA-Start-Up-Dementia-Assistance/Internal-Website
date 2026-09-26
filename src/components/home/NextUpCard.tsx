import { ArrowRight, ListTodo } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../lib/auth'
import { selectNextUp, useTasks, type TasksQuery } from '../../lib/tasks'
import Card from '../Card'
import EmptyState from '../EmptyState'
import ErrorState from '../ErrorState'
import LoadingState from '../LoadingState'
import Skeleton from '../Skeleton'
import { TaskStatusBadge } from '../tasks/StatusBadge'
import { DoneByLabel } from '../tasks/TaskRow'

/** Signed in: the user's next 3 open tasks by "Done by". Signed out: renders nothing. */
export default function NextUpCard() {
  const { user } = useAuth()
  const tasks = useTasks(Boolean(user))
  if (!user) return null
  return (
    <Card title="Your next up" icon={ListTodo}>
      <NextUpBody tasks={tasks} login={user.login} />
    </Card>
  )
}

function NextUpBody({ tasks, login }: { tasks: TasksQuery; login: string }) {
  if (tasks.loading) {
    return (
      <LoadingState>
        {[0, 1, 2].map((i) => (
          <div key={i} className="py-2">
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="mt-2 h-4 w-40" />
          </div>
        ))}
      </LoadingState>
    )
  }
  if (tasks.error) {
    const message = tasks.error.needsSignIn
      ? 'Your GitHub session has expired. Sign in again to see your tasks.'
      : "We couldn't load your tasks right now."
    return <ErrorState message={message} onRetry={tasks.refetch} />
  }

  if (!tasks.data) return null
  const { meta } = tasks.data
  const next = selectNextUp(tasks.data.tasks, login)
  return (
    <>
      {next.length === 0 ? (
        <EmptyState>Nothing open is assigned to you. Enjoy the calm.</EmptyState>
      ) : (
        <ul className="divide-y divide-night/10">
          {next.map((task) => (
            <li key={task.itemId} className="py-3 first:pt-0">
              <p className="font-medium">{task.title}</p>
              <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-dusk">
                <TaskStatusBadge task={task} meta={meta} />
                <DoneByLabel task={task} />
              </p>
            </li>
          ))}
        </ul>
      )}
      <Link
        to="/tasks"
        className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-ember underline-offset-4 hover:underline"
      >
        All my tasks
        <ArrowRight aria-hidden="true" className="size-4" />
      </Link>
    </>
  )
}
