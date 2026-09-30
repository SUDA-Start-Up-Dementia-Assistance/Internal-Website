import { ArrowRight, CalendarClock, CircleAlert, ClipboardList, Plus } from 'lucide-react'
import { Link } from 'react-router-dom'
import {
  loadDashboard,
  peekDashboardTodo,
  setTodoOverride,
  todoCounts,
  type DashboardQuery,
  type TodosWidget as TodosData,
} from '../../lib/dashboard'
import { TasksError } from '../../lib/tasks'
import { zonedDateKey } from '../../lib/teamTime'
import {
  applyServerTodo,
  applyTodoChanges,
  CONFLICT_MESSAGE,
  dueLabel,
  invalidateTodos,
  isTodoOverdue,
  updateTodo,
  type Todo,
} from '../../lib/todos'
import { showToast } from '../../lib/toast'
import EmptyState from '../EmptyState'
import Skeleton from '../Skeleton'
import { CountBadge, FOOTER_LINK, WidgetBody, WidgetCard } from './Widget'

const TODOS_TAB = '/tasks?tab=todos'

/** Up to 5 open team to-dos for me or nobody, completable in place. */
export default function TodosWidget({ query, now }: { query: DashboardQuery; now: Date }) {
  const todos = query.data?.todos
  const open = todos && !('error' in todos) ? todoCounts(todos, now).open : undefined
  const login = query.data?.me.login ?? ''
  return (
    <WidgetCard
      id="team-todos"
      title="Team to-dos"
      icon={ClipboardList}
      badge={open !== undefined && <CountBadge count={open} label={`${open} open`} />}
      footer={
        <>
          <Link to={`${TODOS_TAB}&add=1`} className={FOOTER_LINK}>
            <Plus aria-hidden="true" className="size-3.5" />
            Add
          </Link>
          <Link to={TODOS_TAB} className={FOOTER_LINK}>
            All to-dos
            <ArrowRight aria-hidden="true" className="size-3.5" />
          </Link>
        </>
      }
    >
      <WidgetBody
        query={query}
        value={todos}
        skeleton={
          <div className="space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        }
      >
        {(data) => <TodoList data={data} login={login} now={now} />}
      </WidgetBody>
    </WidgetCard>
  )
}

function TodoList({ data, login, now }: { data: TodosData; login: string; now: Date }) {
  if (data.items.length === 0) {
    return <EmptyState>No open to-dos for you or the team. Nice.</EmptyState>
  }
  const today = zonedDateKey(now)
  const more = data.counts.open - data.items.length
  return (
    <>
      <ul className="divide-y divide-border">
        {data.items.map((todo) => (
          <TodoItem key={todo.id} todo={todo} login={login} today={today} now={now} />
        ))}
      </ul>
      {more > 0 && (
        <Link
          to={TODOS_TAB}
          className="mt-1 inline-block text-sm text-link underline-offset-4 hover:underline"
        >
          and {more} more
        </Link>
      )}
    </>
  )
}

/**
 * Checks a to-do off (or back on) at once, then saves. The widget keeps the change until the
 * server's copy includes it; a refusal puts it back, with a toast. A conflict reloads.
 */
async function toggleDone(todo: Todo, done: boolean, login: string): Promise<void> {
  const shown = peekDashboardTodo(todo.id) ?? todo
  const hadOverride = shown !== todo
  setTodoOverride(todo.id, applyTodoChanges(shown, { done }, login, new Date()))
  try {
    const saved = await updateTodo(todo.id, shown.version, { done })
    setTodoOverride(todo.id, saved)
    applyServerTodo(saved)
    invalidateTodos()
  } catch (err) {
    setTodoOverride(todo.id, hadOverride ? shown : null)
    const code = err instanceof TasksError ? err.code : 'unknown'
    if (code === 'conflict' || code === 'not-found') {
      showToast(
        'error',
        code === 'conflict' ? CONFLICT_MESSAGE : 'That to-do was deleted by someone else.',
      )
      invalidateTodos()
      void loadDashboard()
    } else {
      const reason = err instanceof TasksError ? err.message : 'Something went wrong.'
      showToast('error', `Couldn't save “${todo.title}”: ${reason}`)
    }
  }
}

function TodoItem({
  todo,
  login,
  today,
  now,
}: {
  todo: Todo
  login: string
  today: string
  now: Date
}) {
  const overdue = isTodoOverdue(todo, today)
  return (
    <li className="flex items-start gap-3 py-2.5">
      <input
        type="checkbox"
        checked={todo.done}
        aria-label={`Mark “${todo.title}” done`}
        onChange={(e) => void toggleDone(todo, e.target.checked, login)}
        className="mt-1 size-4 shrink-0 cursor-pointer accent-link"
      />
      <div className="min-w-0 flex-1">
        <p className={`font-medium break-words ${todo.done ? 'text-ink-muted line-through' : ''}`}>
          {todo.title}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-muted">
          {overdue && (
            <span className="inline-flex items-center gap-1 font-medium text-link">
              <CircleAlert aria-hidden="true" className="size-3.5" />
              Overdue
            </span>
          )}
          {todo.dueDate && (
            <span className="inline-flex items-center gap-1">
              {!overdue && <CalendarClock aria-hidden="true" className="size-3.5" />}
              {dueLabel(todo.dueDate, now)}
            </span>
          )}
          <span>{todo.assignee ? 'Yours' : 'Unassigned'}</span>
        </div>
      </div>
    </li>
  )
}
