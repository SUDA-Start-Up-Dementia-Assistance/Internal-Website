import { CalendarPlus, ChevronLeft, ChevronRight, List, Rss, Table2 } from 'lucide-react'
import { useMemo } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import { buttonClasses } from '../components/buttonStyles'
import EmptyState from '../components/EmptyState'
import ErrorState from '../components/ErrorState'
import ExternalLinkLabel from '../components/ExternalLinkLabel'
import LoadingState from '../components/LoadingState'
import PastMeetings from '../components/meetings/PastMeetings'
import UpcomingList from '../components/meetings/UpcomingList'
import WeekGrid from '../components/meetings/WeekGrid'
import PageTitle from '../components/PageTitle'
import Skeleton from '../components/Skeleton'
import PreviewBanner from '../components/tasks/PreviewBanner'
import { ADD_MEETING_URL, CALENDAR_URL } from '../config/meetings'
import { useAuth } from '../lib/auth'
import { formatDateKey } from '../lib/dashboard'
import {
  isUpcoming,
  meetingDateKey,
  useMeetings,
  useWithAgendas,
  type MeetingsQuery,
} from '../lib/meetings'
import { weekStartKey } from '../lib/meetingsView'
import { addDaysToDateKey, zonedDateKey } from '../lib/teamTime'
import { useNow } from '../lib/useNow'

const SIGN_IN = `/tasks?returnTo=${encodeURIComponent('/meetings')}`
const UPCOMING_DAYS = 21
const PAST_DAYS = 14
const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/

/** Team meetings from the "DAWN Team" Google Calendar (signed-in only). */
export default function Meetings() {
  const { user, loading } = useAuth()
  return (
    <div className="mx-auto max-w-5xl px-6 py-12 sm:py-16">
      <PageTitle title="Meetings" />
      {loading ? (
        <LoadingState>
          <Skeleton className="h-10 w-56" />
        </LoadingState>
      ) : user ? (
        <SignedInMeetings />
      ) : (
        <Navigate to={SIGN_IN} replace />
      )}
    </div>
  )
}

type View = 'list' | 'week'

function SignedInMeetings() {
  const now = useNow(60_000)
  const today = zonedDateKey(now)
  const [params, setParams] = useSearchParams()
  const view: View = params.get('view') === 'week' ? 'week' : 'list'
  const weekParam = params.get('week')
  const weekStart = weekStartKey(weekParam && DATE_KEY.test(weekParam) ? weekParam : today)

  // One request covers the list and "Past 2 weeks"; the week grid asks for its own week.
  const range = useMeetings(
    addDaysToDateKey(today, -PAST_DAYS),
    addDaysToDateKey(today, UPCOMING_DAYS - 1),
  )

  const setView = (next: View) =>
    setParams(next === 'week' ? { view: 'week' } : {}, { replace: true })
  const goToWeek = (start: string) =>
    setParams(start === weekStartKey(today) ? { view: 'week' } : { view: 'week', week: start }, {
      replace: true,
    })

  return (
    <div className="space-y-10">
      <PreviewBanner />
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <h1 className="text-4xl font-semibold">Meetings</h1>
          <div aria-hidden="true" className="mt-6 horizon-line w-24" />
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <div className="flex flex-wrap gap-3">
            <a
              href={ADD_MEETING_URL}
              target="_blank"
              rel="noreferrer"
              aria-describedby="add-meeting-hint"
              className={buttonClasses('primary')}
            >
              <CalendarPlus aria-hidden="true" className="size-4" />
              Add a meeting
              <ExternalLinkLabel />
            </a>
            {CALENDAR_URL && (
              <a
                href={CALENDAR_URL}
                target="_blank"
                rel="noreferrer"
                className={buttonClasses('secondary')}
              >
                <Rss aria-hidden="true" className="size-4" />
                Subscribe
                <ExternalLinkLabel />
              </a>
            )}
          </div>
          <p id="add-meeting-hint" className="text-sm text-ink-muted">
            Choose the DAWN Team calendar so everyone sees it.
          </p>
        </div>
      </header>

      <ViewToggle view={view} onChange={setView} />

      {view === 'list' ? (
        <ListView query={range} today={today} now={now} />
      ) : (
        <WeekView weekStart={weekStart} today={today} now={now} onWeekChange={goToWeek} />
      )}

      <PastSection query={range} today={today} now={now} />
    </div>
  )
}

function ViewToggle({ view, onChange }: { view: View; onChange: (view: View) => void }) {
  const option = (value: View, label: string, Icon: typeof List) => (
    <button
      type="button"
      aria-pressed={view === value}
      onClick={() => onChange(value)}
      className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
        view === value
          ? 'bg-ink text-page dark:bg-surface-raised dark:text-ink dark:ring-1 dark:ring-border'
          : 'text-ink hover:text-link'
      }`}
    >
      <Icon aria-hidden="true" className="size-4" />
      {label}
    </button>
  )
  return (
    <div
      role="group"
      aria-label="View"
      className="inline-flex gap-1 rounded-full border border-border bg-surface p-1"
    >
      {option('list', 'List', List)}
      {option('week', 'Week', Table2)}
    </div>
  )
}

function ListSkeleton() {
  return (
    <LoadingState>
      <Skeleton className="h-8 w-40" />
      <Skeleton className="mt-6 h-4 w-24" />
      <Skeleton className="mt-3 h-20 w-full rounded-2xl" />
      <Skeleton className="mt-6 h-4 w-24" />
      <Skeleton className="mt-3 h-20 w-full rounded-2xl" />
    </LoadingState>
  )
}

/**
 * The shared states for a meetings query: skeleton, error with retry, and "Calendar not
 * connected". Renders children only with data from a connected calendar.
 */
function QueryState({
  query,
  skeleton,
  children,
}: {
  query: MeetingsQuery
  skeleton: React.ReactNode
  children: () => React.ReactNode
}) {
  if (query.loading) return <>{skeleton}</>
  if (query.error) {
    return (
      <div className="shadow-card rounded-2xl bg-surface p-6">
        <ErrorState message={query.error.message} onRetry={query.refetch} />
      </div>
    )
  }
  if (!query.data?.connected) {
    return (
      <EmptyState>
        Calendar not connected. Meetings will show up here once the team calendar is linked.
      </EmptyState>
    )
  }
  return <>{children()}</>
}

function ListView({ query, today, now }: { query: MeetingsQuery; today: string; now: Date }) {
  const lastDay = addDaysToDateKey(today, UPCOMING_DAYS - 1)
  const upcoming = useMemo(
    () => query.data?.meetings.filter((m) => isUpcoming(m, now) && meetingDateKey(m) <= lastDay),
    [query.data, now, lastDay],
  )
  const joined = useWithAgendas(upcoming)
  return (
    <QueryState query={query} skeleton={<ListSkeleton />}>
      {() => <UpcomingList meetings={joined ?? []} todayKey={today} now={now} />}
    </QueryState>
  )
}

function WeekView({
  weekStart,
  today,
  now,
  onWeekChange,
}: {
  weekStart: string
  today: string
  now: Date
  onWeekChange: (weekStart: string) => void
}) {
  const weekEnd = addDaysToDateKey(weekStart, 6)
  const query = useMeetings(weekStart, weekEnd)
  const joined = useWithAgendas(query.data?.meetings)
  const isThisWeek = weekStart === weekStartKey(today)

  return (
    <section aria-labelledby="week-title" className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="week-title" aria-live="polite" className="text-2xl font-semibold">
          {formatDateKey(weekStart)} – {formatDateKey(weekEnd)}
        </h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onWeekChange(addDaysToDateKey(weekStart, -7))}
            aria-label="Previous week"
            className={buttonClasses('secondary', 'sm')}
          >
            <ChevronLeft aria-hidden="true" className="size-4" />
            Previous
          </button>
          <button
            type="button"
            onClick={() => onWeekChange(weekStartKey(today))}
            disabled={isThisWeek}
            className={`${buttonClasses('secondary', 'sm')} disabled:cursor-default disabled:opacity-50`}
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => onWeekChange(addDaysToDateKey(weekStart, 7))}
            aria-label="Next week"
            className={buttonClasses('secondary', 'sm')}
          >
            Next
            <ChevronRight aria-hidden="true" className="size-4" />
          </button>
        </div>
      </div>
      <QueryState
        query={query}
        skeleton={
          <LoadingState>
            <Skeleton className="h-80 w-full rounded-2xl" />
          </LoadingState>
        }
      >
        {() => (
          <WeekGrid weekStart={weekStart} meetings={joined ?? []} todayKey={today} now={now} />
        )}
      </QueryState>
    </section>
  )
}

function PastSection({ query, today, now }: { query: MeetingsQuery; today: string; now: Date }) {
  const firstDay = addDaysToDateKey(today, -PAST_DAYS)
  const past = useMemo(
    () =>
      query.data?.meetings
        .filter(
          (m) => m.kind === 'official' && !isUpcoming(m, now) && meetingDateKey(m) >= firstDay,
        )
        .reverse(),
    [query.data, now, firstDay],
  )
  const joined = useWithAgendas(past)
  // Loading and errors show in the main view; this section only appears with data.
  if (!joined || !query.data?.connected) return null
  return <PastMeetings meetings={joined} />
}
