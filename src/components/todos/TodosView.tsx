import { ChevronDown, CircleAlert } from 'lucide-react'
import { useId, useState, type ReactNode } from 'react'
import type { TeamMember } from '../../lib/tasks'
import { zonedDateKey } from '../../lib/teamTime'
import { filterTodos, groupTodos, useTodos, type Todo, type TodoFilter } from '../../lib/todos'
import { useNow } from '../../lib/useNow'
import ErrorState from '../ErrorState'
import LoadingState from '../LoadingState'
import Skeleton from '../Skeleton'
import QuickAdd from './QuickAdd'
import TodoRow from './TodoRow'

const FILTERS: { id: TodoFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'mine', label: 'Mine' },
  { id: 'everyone', label: 'For everyone' },
]

interface TodosViewProps {
  login: string
  /** For names, avatars, and the assignee picker; [] until the team list loads. */
  team: readonly TeamMember[]
  autoFocusAdd?: boolean
}

/** The /tasks "To-dos" tab: small team chores stored on the site, not in GitHub. */
export default function TodosView({ login, team, autoFocusAdd }: TodosViewProps) {
  const { data, loading, error, refetch } = useTodos()
  const [filter, setFilter] = useState<TodoFilter>('all')
  const now = useNow(60_000)
  const today = zonedDateKey(now)

  return (
    <div className="space-y-6">
      <p className="text-sm text-ink-muted">
        Small team chores that don&apos;t belong on the GitHub board. Only the team can see them.
      </p>
      <QuickAdd login={login} team={team} autoFocus={autoFocusAdd} />
      {loading ? (
        <TodosSkeleton />
      ) : error ? (
        <ErrorState message={error.message} onRetry={refetch} />
      ) : data ? (
        <>
          <FilterBar value={filter} onChange={setFilter} />
          <TodoList
            todos={data}
            filter={filter}
            onShowAll={() => setFilter('all')}
            login={login}
            team={team}
            today={today}
            now={now}
          />
        </>
      ) : null}
    </div>
  )
}

function FilterBar({ value, onChange }: { value: TodoFilter; onChange: (f: TodoFilter) => void }) {
  return (
    <div
      role="group"
      aria-label="Show to-dos"
      className="inline-flex rounded-full border border-border p-0.5"
    >
      {FILTERS.map((f) => {
        const active = f.id === value
        return (
          <button
            key={f.id}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(f.id)}
            className={`rounded-full px-3.5 py-1 text-sm font-medium transition-colors ${
              active ? 'bg-accent text-on-accent' : 'text-ink-muted hover:text-link'
            }`}
          >
            {f.label}
          </button>
        )
      })}
    </div>
  )
}

interface TodoListProps {
  todos: Todo[]
  filter: TodoFilter
  onShowAll: () => void
  login: string
  team: readonly TeamMember[]
  today: string
  now: Date
}

function TodoList({ todos, filter, onShowAll, login, team, today, now }: TodoListProps) {
  const visible = filterTodos(todos, filter, login)
  const groups = groupTodos(visible, today)
  const openTotal = todos.filter((t) => !t.done).length
  const openShown = visible.filter((t) => !t.done).length
  const hidden = openTotal - openShown
  const rowProps = { login, team, today, now }

  const sections = [
    { key: 'overdue', title: 'Overdue', items: groups.overdue, accent: true },
    { key: 'thisWeek', title: 'Due this week', items: groups.thisWeek, accent: false },
    { key: 'later', title: 'Later', items: groups.later, accent: false },
    { key: 'noDate', title: 'No date', items: groups.noDate, accent: false },
  ].filter((s) => s.items.length > 0)

  return (
    <div className="space-y-8">
      {openShown === 0 &&
        (hidden > 0 ? (
          <p className="text-ink-muted">
            {hidden === 1 ? '1 to-do is' : `${hidden} to-dos are`} hidden by the filter.{' '}
            <button
              type="button"
              onClick={onShowAll}
              className="font-medium text-link underline underline-offset-4"
            >
              Show all
            </button>
          </p>
        ) : (
          <p className="text-ink-muted">No to-dos. Nice.</p>
        ))}
      {sections.map((s) => (
        <Section key={s.key} title={s.title} count={s.items.length} accent={s.accent}>
          <ul className="space-y-3">
            {s.items.map((todo) => (
              <TodoRow key={todo.id} todo={todo} {...rowProps} />
            ))}
          </ul>
        </Section>
      ))}
      {openShown > 0 && hidden > 0 && (
        <p className="text-sm text-ink-muted">
          {hidden === 1 ? '1 more to-do is' : `${hidden} more to-dos are`} hidden by the filter.{' '}
          <button
            type="button"
            onClick={onShowAll}
            className="font-medium text-link underline underline-offset-4"
          >
            Show all
          </button>
        </p>
      )}
      {groups.done.length > 0 && <DoneSection todos={groups.done} {...rowProps} />}
    </div>
  )
}

function Section({
  title,
  count,
  accent,
  children,
}: {
  title: string
  count: number
  accent: boolean
  children: ReactNode
}) {
  const headingId = useId()
  return (
    <section aria-labelledby={headingId}>
      <h2
        id={headingId}
        className={`flex items-center gap-1.5 font-body text-sm font-semibold tracking-wide uppercase ${
          accent ? 'text-link' : 'text-ink-muted'
        }`}
      >
        {accent && <CircleAlert aria-hidden="true" className="size-4" />}
        {title}
        <span className="font-normal">({count})</span>
      </h2>
      <div className="mt-3">{children}</div>
    </section>
  )
}

/** Done in the last 14 days, collapsed by default. Unchecking one reopens it. */
function DoneSection({
  todos,
  ...rowProps
}: {
  todos: Todo[]
  login: string
  team: readonly TeamMember[]
  today: string
  now: Date
}) {
  const [open, setOpen] = useState(false)
  const listId = useId()
  return (
    <section aria-label="Done in the last 14 days" className="border-t border-border pt-6">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 rounded-sm font-body text-sm font-semibold tracking-wide text-ink-muted uppercase hover:text-link"
      >
        <ChevronDown
          aria-hidden="true"
          className={`size-4 transition-transform motion-reduce:transition-none ${open ? '' : '-rotate-90'}`}
        />
        Done <span className="font-normal">({todos.length})</span>
        <span className="font-normal tracking-normal normal-case">· last 14 days</span>
      </button>
      {open && (
        <ul id={listId} className="mt-3 space-y-3">
          {todos.map((todo) => (
            <TodoRow key={todo.id} todo={todo} {...rowProps} />
          ))}
        </ul>
      )}
    </section>
  )
}

function TodosSkeleton() {
  return (
    <LoadingState>
      <Skeleton className="h-8 w-60 rounded-full" />
      <Skeleton className="mt-8 h-5 w-32" />
      <div className="mt-3 space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="shadow-card rounded-2xl bg-surface p-4">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="mt-3 h-4 w-1/3" />
          </div>
        ))}
      </div>
    </LoadingState>
  )
}
