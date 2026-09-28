import { CircleAlert, TriangleAlert } from 'lucide-react'
import { useId, useState, type ReactNode } from 'react'
import {
  addDaysToKey,
  daysBetween,
  formatAmount,
  formatLongDate,
  UNIT_LABELS,
  useBurndown,
  type BurndownResponse,
} from '../../../lib/burndown'
import { selectSprintBacklogWithoutIteration, type Task, type TaskMeta } from '../../../lib/tasks'
import EmptyState from '../../EmptyState'
import ErrorState from '../../ErrorState'
import LoadingState from '../../LoadingState'
import Skeleton from '../../Skeleton'
import BurndownChart, { LineKey, type ChartView } from './BurndownChart'

interface SprintViewProps {
  meta: TaskMeta
  tasks: Task[]
}

/**
 * The Sprint tab: pick a sprint (current by default, or a past one with snapshots), see
 * warnings about what the numbers leave out, summary tiles, and the burndown/burn-up chart.
 * Opening it for the current sprint records today's snapshot.
 */
export default function SprintView({ meta, tasks }: SprintViewProps) {
  // undefined = the current sprint (the server decides which that is).
  const [iterationId, setIterationId] = useState<string>()
  const [view, setView] = useState<ChartView>('burndown')
  const { data, loading, error, refetch } = useBurndown(iterationId)

  if (!data) {
    if (error) return <ErrorState message={error.message} onRetry={refetch} />
    return <SprintSkeleton />
  }

  const picker = (
    <SprintPicker
      meta={meta}
      data={data}
      value={iterationId ?? data.iteration?.id ?? ''}
      onChange={setIterationId}
    />
  )

  return (
    // Refetch keeps the frame: the previous sprint stays, dimmed, while the next loads.
    <div aria-busy={loading} className={`space-y-8 ${loading ? 'opacity-60' : ''}`}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        {picker}
        {data.iteration && <ViewToggle view={view} onChange={setView} />}
      </div>
      {error && <ErrorState message={error.message} onRetry={refetch} />}
      {data.iteration ? (
        <SprintDetails data={data} tasks={tasks} view={view} />
      ) : (
        <EmptyState>
          No sprint is running right now.
          {data.iterationsWithSnapshots.length > 0 && ' Pick a past sprint to see its burndown.'}
        </EmptyState>
      )}
    </div>
  )
}

function SprintDetails({
  data,
  tasks,
  view,
}: {
  data: BurndownResponse
  tasks: Task[]
  view: ChartView
}) {
  const iteration = data.iteration!
  const { unit, days } = data
  const latest = days.at(-1)
  const lastDay = addDaysToKey(iteration.startDate, iteration.duration - 1)
  const inSprint = tasks.filter((t) => t.iteration?.id === iteration.id)
  const blocked = inSprint.filter((t) => t.statusKey === 'blocked').length
  const daysLeft = data.isCurrent ? daysBetween(data.today, lastDay) + 1 : 0

  const warnings: ReactNode[] = []
  if (!data.storageOk) {
    warnings.push(
      "Snapshot history couldn't be loaded or saved right now, so earlier days may be missing.",
    )
  }
  if (latest && latest.unestimatedCount > 0) {
    const n = latest.unestimatedCount
    warnings.push(
      `${n} ${n === 1 ? 'item' : 'items'} in this sprint ${n === 1 ? 'has' : 'have'} ${UNIT_LABELS[unit].missing}.`,
    )
  }
  if (data.isCurrent) {
    const loose = selectSprintBacklogWithoutIteration(tasks).length
    if (loose > 0) {
      warnings.push(
        `${loose} ${loose === 1 ? 'item is' : 'items are'} in Sprint Backlog but not assigned to this iteration.`,
      )
    }
  }
  if (days.length > 0 && days[0].date > iteration.startDate) {
    warnings.push(
      `Snapshots start on ${formatLongDate(days[0].date)}; earlier days weren't recorded.`,
    )
  }

  return (
    <>
      {warnings.length > 0 && (
        <ul className="space-y-2">
          {warnings.map((w, i) => (
            <li
              key={i}
              className="shadow-card flex gap-2.5 rounded-2xl border border-link/30 bg-surface px-4 py-3 text-sm"
            >
              <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-link" />
              {w}
            </li>
          ))}
        </ul>
      )}

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Tile label="Scope" value={latest ? formatAmount(latest.scope, unit) : '–'} />
        <Tile label="Done" value={latest ? formatAmount(latest.done, unit) : '–'} />
        <Tile label="Remaining" value={latest ? formatAmount(latest.remaining, unit) : '–'} />
        <Tile
          label="Blocked items"
          value={String(blocked)}
          icon={
            blocked > 0 ? <CircleAlert aria-hidden="true" className="size-4 text-link" /> : null
          }
        />
        <Tile
          label="Days left"
          value={data.isCurrent ? String(daysLeft) : 'Ended'}
          note={data.isCurrent ? 'including today' : `on ${formatLongDate(lastDay)}`}
        />
      </dl>
      {latest && !data.isCurrent && (
        <p className="-mt-5 text-sm text-ink-muted">
          Totals are from the last snapshot, on {formatLongDate(latest.date)}.
        </p>
      )}

      <section
        aria-labelledby="burndown-heading"
        className="shadow-card rounded-2xl bg-surface p-4 sm:p-6"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
          <h2 id="burndown-heading" className="text-xl font-semibold">
            {iteration.title}
            <span className="ml-3 font-body text-sm font-normal text-ink-muted">
              {formatLongDate(iteration.startDate)} – {formatLongDate(lastDay)}
            </span>
          </h2>
          <Legend view={view} />
        </div>
        <div className="mt-4">
          {days.length > 0 ? (
            <BurndownChart
              iteration={iteration}
              days={days}
              unit={unit}
              view={view}
              liveDate={data.isCurrent ? data.today : null}
            />
          ) : (
            <EmptyState>No snapshots were recorded for this sprint.</EmptyState>
          )}
        </div>
      </section>
    </>
  )
}

function Tile({
  label,
  value,
  note,
  icon,
}: {
  label: string
  value: string
  note?: string
  icon?: ReactNode
}) {
  return (
    <div className="shadow-card rounded-2xl bg-surface p-4">
      <dt className="text-sm text-ink-muted">{label}</dt>
      <dd className="mt-1 flex items-center gap-1.5 font-body text-2xl font-semibold text-ink">
        {icon}
        {value}
      </dd>
      {note && <dd className="mt-0.5 text-xs text-ink-muted">{note}</dd>}
    </div>
  )
}

function Legend({ view }: { view: ChartView }) {
  const items =
    view === 'burnup'
      ? [
          { label: 'Scope', stroke: 'stroke-ink' },
          { label: 'Done', stroke: 'stroke-accent' },
        ]
      : [
          { label: 'Remaining', stroke: 'stroke-link' },
          { label: 'Ideal', stroke: 'stroke-ink-muted', dashed: true },
        ]
  return (
    <ul aria-label="Legend" className="flex flex-wrap gap-4 text-sm text-ink-muted">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5">
          <LineKey stroke={item.stroke} dashed={item.dashed} />
          {item.label}
        </li>
      ))}
    </ul>
  )
}

function ViewToggle({ view, onChange }: { view: ChartView; onChange: (v: ChartView) => void }) {
  const options: { id: ChartView; label: string }[] = [
    { id: 'burndown', label: 'Burndown' },
    { id: 'burnup', label: 'Burn-up' },
  ]
  return (
    <div
      role="group"
      aria-label="Chart view"
      className="flex rounded-full border border-border p-0.5"
    >
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          aria-pressed={view === o.id}
          onClick={() => onChange(o.id)}
          className={`rounded-full px-3.5 py-1 text-sm font-medium transition-colors ${
            view === o.id
              ? 'bg-ink text-page dark:bg-surface-raised dark:text-ink dark:ring-1 dark:ring-border'
              : 'text-ink-muted hover:text-ink'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** The current sprint, then past sprints that have snapshots (newest first). */
function SprintPicker({
  meta,
  data,
  value,
  onChange,
}: {
  meta: TaskMeta
  data: BurndownResponse
  value: string
  onChange: (id: string) => void
}) {
  const id = useId()
  const withSnapshots = new Set(data.iterationsWithSnapshots)
  const current = meta.iterations.find((it) => it.id === meta.currentIterationId)
  const past = meta.iterations.filter((it) => it.completed && withSnapshots.has(it.id)).reverse()
  const options = [
    ...(current ? [{ id: current.id, label: `${current.title} (current)` }] : []),
    ...past.map((it) => ({ id: it.id, label: it.title })),
  ]
  if (options.length === 0) return <span />

  return (
    <label htmlFor={id} className="flex items-center gap-2 text-sm font-medium text-ink-muted">
      Sprint
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-full border border-border bg-surface py-1.5 pr-8 pl-3.5 text-sm text-ink"
      >
        {!options.some((o) => o.id === value) && <option value={value}>Choose a sprint</option>}
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}

function SprintSkeleton() {
  return (
    <LoadingState>
      <Skeleton className="h-8 w-48 rounded-full" />
      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-20 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="mt-8 h-80 rounded-2xl" />
    </LoadingState>
  )
}
