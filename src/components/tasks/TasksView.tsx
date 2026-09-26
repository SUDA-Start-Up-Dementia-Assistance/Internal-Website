import { ChartNoAxesColumnDecreasing } from 'lucide-react'
import { useRef, useState, type KeyboardEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { formatDayMonth } from '../../lib/dates'
import { parseLocalDate } from '../../lib/drive/parse'
import {
  applyFilters,
  DEFAULT_FILTERS,
  isOpen,
  selectMine,
  selectSprintBacklogWithoutIteration,
  useTasks,
  type TaskFilters as Filters,
  type TaskMeta,
} from '../../lib/tasks'
import ErrorState from '../ErrorState'
import HiddenItemsNotice from './HiddenItemsNotice'
import LoadingState from '../LoadingState'
import Skeleton from '../Skeleton'
import MyTasks from './MyTasks'
import SignInPanel from './SignInPanel'
import TaskFilters from './TaskFilters'
import TeamTasks from './TeamTasks'
import UnscheduledNotice from './UnscheduledNotice'

const TABS = [
  { id: 'mine', label: 'My tasks' },
  { id: 'team', label: 'Team' },
  { id: 'sprint', label: 'Sprint' },
] as const

type TabId = (typeof TABS)[number]['id']

/** The signed-in Tasks page: tabs, filters, and the unscheduled-items notice. */
export default function TasksView({ login }: { login: string }) {
  const { data, loading, error, refetch } = useTasks()
  const [params, setParams] = useSearchParams()
  const tab: TabId = TABS.find((t) => t.id === params.get('tab'))?.id ?? 'mine'
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS)

  function selectTab(id: TabId) {
    setParams(id === 'mine' ? {} : { tab: id }, { replace: true })
  }

  if (loading) return <TasksSkeleton />
  if (error) {
    return error.needsSignIn ? (
      <SignInPanel error="Your GitHub session has expired. Sign in again to see tasks." />
    ) : (
      <ErrorState message={error.message} onRetry={refetch} />
    )
  }
  if (!data) return null

  const { tasks, hiddenCount, meta, team } = data
  const filtered = applyFilters(tasks, filters, meta)
  // Inside one sprint, every row would repeat its name.
  const showIteration = !(filters.currentSprintOnly && meta.currentIterationId)
  // Filters (including the default "current sprint only") hid every one of the user's tasks.
  const hasAnyOfMine = selectMine(tasks, login).length > 0

  return (
    <div className="space-y-8">
      <HiddenItemsNotice count={hiddenCount} />
      <UnscheduledNotice
        tasks={selectSprintBacklogWithoutIteration(tasks)}
        projectUrl={meta.projectUrl}
      />
      <Tabs selected={tab} onSelect={selectTab} />

      <div
        id={`panel-${tab}`}
        role="tabpanel"
        aria-labelledby={`tab-${tab}`}
        tabIndex={0}
        className="space-y-8 focus-visible:outline-offset-8"
      >
        {tab !== 'sprint' && (
          <TaskFilters
            filters={filters}
            onChange={setFilters}
            meta={meta}
            showDoneToggle={tab === 'mine'}
          />
        )}
        {tab === 'mine' && (
          <MyTasks
            tasks={selectMine(filtered, login)}
            meta={meta}
            filtered={hasAnyOfMine}
            showIteration={showIteration}
          />
        )}
        {tab === 'team' && (
          <TeamTasks
            tasks={applyFilters(tasks, { ...filters, showDone: false }, meta).filter(isOpen)}
            team={team}
            meta={meta}
            showIteration={showIteration}
          />
        )}
        {tab === 'sprint' && <SprintPlaceholder meta={meta} />}
      </div>
    </div>
  )
}

/** WAI-ARIA tabs: arrow keys, Home and End move between tabs (and select them). */
function Tabs({ selected, onSelect }: { selected: TabId; onSelect: (id: TabId) => void }) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({})

  function onKeyDown(e: KeyboardEvent) {
    const index = TABS.findIndex((t) => t.id === selected)
    const next = {
      ArrowRight: (index + 1) % TABS.length,
      ArrowLeft: (index - 1 + TABS.length) % TABS.length,
      Home: 0,
      End: TABS.length - 1,
    }[e.key]
    if (next === undefined) return
    e.preventDefault()
    onSelect(TABS[next].id)
    refs.current[TABS[next].id]?.focus()
  }

  return (
    <div
      role="tablist"
      aria-label="Task views"
      onKeyDown={onKeyDown}
      className="flex gap-1 border-b border-night/10"
    >
      {TABS.map((t) => {
        const active = t.id === selected
        return (
          <button
            key={t.id}
            ref={(el) => {
              refs.current[t.id] = el
            }}
            id={`tab-${t.id}`}
            type="button"
            role="tab"
            aria-selected={active}
            aria-controls={`panel-${t.id}`}
            tabIndex={active ? 0 : -1}
            onClick={() => onSelect(t.id)}
            className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              active
                ? 'border-ember text-ember'
                : 'border-transparent text-dusk hover:border-night/20 hover:text-night'
            }`}
          >
            {t.label}
          </button>
        )
      })}
    </div>
  )
}

function SprintPlaceholder({ meta }: { meta: TaskMeta }) {
  const current = meta.iterations.find((it) => it.id === meta.currentIterationId)
  const start = current && parseLocalDate(current.startDate)
  const end =
    start && new Date(start.getFullYear(), start.getMonth(), start.getDate() + current.duration - 1)

  return (
    <div className="rounded-2xl bg-surface p-6 shadow-card sm:p-8">
      <ChartNoAxesColumnDecreasing aria-hidden="true" className="size-8 text-dusk" />
      {current && start && end ? (
        <p className="mt-4 font-heading text-2xl">
          {current.title}
          <span className="ml-3 font-body text-base text-dusk">
            {formatDayMonth(start)} – {formatDayMonth(end)}
          </span>
        </p>
      ) : (
        <p className="mt-4 font-heading text-2xl">No sprint is running right now</p>
      )}
      <p className="mt-2 max-w-prose text-dusk">
        The sprint burndown chart is coming soon. Until then, the Team tab shows who has what.
      </p>
    </div>
  )
}

function TasksSkeleton() {
  return (
    <LoadingState>
      <div className="flex gap-4 border-b border-night/10 pb-3">
        <Skeleton className="h-5 w-20" />
        <Skeleton className="h-5 w-14" />
        <Skeleton className="h-5 w-16" />
      </div>
      <div className="mt-8 flex flex-wrap gap-4">
        <Skeleton className="h-8 w-32 rounded-full" />
        <Skeleton className="h-8 w-36 rounded-full" />
        <Skeleton className="h-8 w-32 rounded-full" />
      </div>
      <Skeleton className="mt-10 h-6 w-40" />
      <div className="mt-4 space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-2xl bg-surface p-4 shadow-card">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="mt-3 h-4 w-1/2" />
          </div>
        ))}
      </div>
    </LoadingState>
  )
}
