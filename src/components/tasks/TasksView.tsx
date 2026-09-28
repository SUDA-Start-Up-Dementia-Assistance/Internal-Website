import { Plus } from 'lucide-react'
import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  applyFilters,
  DEFAULT_FILTERS,
  isOpen,
  selectMine,
  useTasks,
  type Task,
  type TaskFilters as Filters,
} from '../../lib/tasks'
import { showToast } from '../../lib/toast'
import { buttonClasses } from '../buttonStyles'
import ErrorState from '../ErrorState'
import LoadingState from '../LoadingState'
import Skeleton from '../Skeleton'
import MyTasks from './MyTasks'
import NewTaskDialog from './NewTaskDialog'
import { listNames, SAVED_MESSAGE } from './saveTask'
import SignInPanel from './SignInPanel'
import SprintView from './sprint/SprintView'
import TaskFilters from './TaskFilters'
import TeamTasks from './TeamTasks'
import Toaster from '../Toaster'

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
  const [creating, setCreating] = useState(false)
  const ready = Boolean(data)

  function selectTab(id: TabId) {
    setParams(id === 'mine' ? {} : { tab: id }, { replace: true })
  }

  // "n" opens New task, unless the user is typing or another dialog is open.
  useEffect(() => {
    if (!ready) return
    function onKeyDown(e: globalThis.KeyboardEvent) {
      if (e.key !== 'n' || e.metaKey || e.ctrlKey || e.altKey || e.repeat) return
      if (isTypingTarget(e.target) || document.querySelector('dialog[open]')) return
      e.preventDefault()
      setCreating(true)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [ready])

  if (loading) return <TasksSkeleton />
  if (error) {
    return error.needsSignIn ? (
      <SignInPanel error="Your GitHub session has expired. Sign in again to see tasks." />
    ) : (
      <ErrorState message={error.message} onRetry={refetch} />
    )
  }
  if (!data) return null

  const { tasks, meta, team } = data
  const filtered = applyFilters(tasks, filters, meta)
  // Inside one sprint, every row would repeat its name.
  const showIteration = !(filters.currentSprintOnly && meta.currentIterationId)
  // Filters (including the default "current sprint only") hid every one of the user's tasks.
  const hasAnyOfMine = selectMine(tasks, login).length > 0

  function onCreated(task: Task | null, failedFields: string[]) {
    setCreating(false)
    if (failedFields.length > 0) {
      showToast(
        'error',
        `Task created, but GitHub didn't set ${listNames(failedFields)}. Set ${failedFields.length === 1 ? 'it' : 'them'} on the task.`,
      )
      return
    }
    // A new task can land outside the current view (e.g. no sprint, "current sprint only").
    const visible =
      !task ||
      (applyFilters([task], filters, meta).length > 0 &&
        (tab !== 'mine' || selectMine([task], login).length > 0))
    showToast(
      'success',
      visible ? SAVED_MESSAGE : `${SAVED_MESSAGE}. The current filters or tab hide the new task.`,
    )
  }

  return (
    <div className="space-y-8">
      {/* <HiddenItemsNotice count={hiddenCount} /> */}
      {/* <UnscheduledNotice
        tasks={selectSprintBacklogWithoutIteration(tasks)}
        projectUrl={meta.projectUrl}
      /> */}
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3 border-b border-night/10">
        <Tabs selected={tab} onSelect={selectTab} />
        <button
          type="button"
          onClick={() => setCreating(true)}
          aria-keyshortcuts="n"
          className={`mb-2 ${buttonClasses('primary', 'sm')}`}
        >
          <Plus aria-hidden="true" className="size-4" />
          New task
          <kbd
            aria-hidden="true"
            className="ml-1 hidden rounded border border-night/20 px-1 font-body text-xs sm:inline"
          >
            N
          </kbd>
        </button>
      </div>
      {creating && (
        <NewTaskDialog
          meta={meta}
          team={team}
          login={login}
          onClose={() => setCreating(false)}
          onCreated={onCreated}
        />
      )}
      <Toaster />

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
            team={team}
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
        {tab === 'sprint' && <SprintView meta={meta} tasks={tasks} />}
      </div>
    </div>
  )
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
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
    <div role="tablist" aria-label="Task views" onKeyDown={onKeyDown} className="flex gap-1">
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
