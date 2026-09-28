import { ArrowRight, Flag } from 'lucide-react'
import { Link } from 'react-router-dom'
import { iterationDates, useBurndown } from '../../lib/burndown'
import {
  formatDateKey,
  sprintEndLabel,
  sprintProgress,
  type DashboardQuery,
  type SprintSummary,
} from '../../lib/dashboard'
import EmptyState from '../EmptyState'
import Skeleton from '../Skeleton'
import { FOOTER_LINK, WidgetBody, WidgetCard } from './Widget'

const SPRINT_TAB = '/tasks?tab=sprint'

export default function SprintCard({ query, now }: { query: DashboardQuery; now: Date }) {
  return (
    <WidgetCard
      id="sprint"
      title="Sprint"
      icon={Flag}
      footer={
        <Link to={SPRINT_TAB} className={FOOTER_LINK}>
          Sprint board
          <ArrowRight aria-hidden="true" className="size-3.5" />
        </Link>
      }
    >
      <WidgetBody
        query={query}
        value={query.data?.sprint}
        skeleton={
          <>
            <Skeleton className="h-7 w-40" />
            <Skeleton className="mt-2 h-4 w-64" />
            <Skeleton className="mt-4 h-2 w-full rounded-full" />
          </>
        }
      >
        {(sprint) =>
          sprint ? (
            <SprintBody sprint={sprint} now={now} />
          ) : (
            <EmptyState>No sprint is running right now.</EmptyState>
          )
        }
      </WidgetBody>
    </WidgetCard>
  )
}

function SprintBody({ sprint, now }: { sprint: SprintSummary; now: Date }) {
  const progress = sprintProgress(sprint.startDate, sprint.endDate, now)
  const burndown = sprint.burndown
  return (
    <div>
      <p className="font-heading text-2xl font-semibold">{sprint.title}</p>
      <p className="mt-1 text-sm text-dusk">
        {sprintEndLabel(sprint.endDate, sprint.daysLeft, now)}
      </p>

      <div className="mt-4">
        <div className="flex justify-between text-xs text-dusk">
          <span id={`${sprint.id}-progress`}>
            Day {progress.day} of {progress.totalDays}
          </span>
          {burndown && (
            <span>
              {burndown.remaining}h of {burndown.scope}h left
            </span>
          )}
        </div>
        <div
          role="progressbar"
          aria-labelledby={`${sprint.id}-progress`}
          aria-valuemin={0}
          aria-valuemax={progress.totalDays}
          aria-valuenow={progress.day}
          aria-valuetext={`Day ${progress.day} of ${progress.totalDays}`}
          className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-night/10"
        >
          <div
            className="h-full rounded-full bg-linear-to-r from-gold to-apricot"
            style={{ width: `${Math.round(progress.fraction * 100)}%` }}
          />
        </div>
      </div>

      <Sparkline sprint={sprint} />
    </div>
  )
}

const WIDTH = 240
const HEIGHT = 40
const PAD = 3

/**
 * Remaining hours per day, from the stored burndown snapshots. Only drawn with at least two
 * days of data; loading or a failure just leaves it out (the card has the essentials).
 */
function Sparkline({ sprint }: { sprint: SprintSummary }) {
  const { data } = useBurndown(undefined)
  if (!data?.iteration || data.iteration.id !== sprint.id || data.days.length < 2) return null

  const { startDate, duration } = data.iteration
  const dates = iterationDates(startDate, duration)
  const max = Math.max(1, ...data.days.map((d) => Math.max(d.remaining, d.scope)))
  const x = (date: string) =>
    PAD + (Math.max(0, dates.indexOf(date)) / Math.max(1, dates.length - 1)) * (WIDTH - 2 * PAD)
  const y = (value: number) => PAD + (1 - value / max) * (HEIGHT - 2 * PAD)
  const points = data.days
    .filter((d) => dates.includes(d.date))
    .map((d) => `${x(d.date).toFixed(1)},${y(d.remaining).toFixed(1)}`)
  const first = data.days[0]
  const last = data.days[data.days.length - 1]

  return (
    <figure className="mt-4">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="h-10 w-full"
        preserveAspectRatio="none"
        role="img"
        aria-label={`Remaining work: ${first.remaining}h on ${formatDateKey(first.date)}, ${last.remaining}h on ${formatDateKey(last.date)}.`}
      >
        {/* Ideal: straight down from the first day's scope to 0 on the last day. */}
        <line
          x1={PAD}
          y1={y(first.scope)}
          x2={WIDTH - PAD}
          y2={y(0)}
          className="stroke-lavender"
          strokeWidth="1"
          strokeDasharray="3 3"
          vectorEffect="non-scaling-stroke"
        />
        <polyline
          points={points.join(' ')}
          fill="none"
          className="stroke-ember"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <figcaption className="mt-1 text-xs text-dusk">Remaining hours (dashed: ideal)</figcaption>
    </figure>
  )
}
