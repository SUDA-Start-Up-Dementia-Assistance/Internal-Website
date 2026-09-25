import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import AgendaFilters from '../components/agendas/AgendaFilters'
import MeetingCard, { type MeetingDoc } from '../components/agendas/MeetingCard'
import { buttonClasses } from '../components/buttonStyles'
import DocumentPanel, { type PanelDocument } from '../components/DocumentPanel'
import EmptyState from '../components/EmptyState'
import ErrorState from '../components/ErrorState'
import LoadingState from '../components/LoadingState'
import Skeleton from '../components/Skeleton'
import { isSourceConfigured } from '../config/sources'
import { formatCardDate, isSameDay } from '../lib/dates'
import { useMeetings, type Meeting } from '../lib/drive'
import {
  filterMeetings,
  meetingMonths,
  monthKey,
  splitMeetings,
  type MeetingFilter,
} from '../lib/selectors'

// URL values for the "Show" filter, so filtered views can be shared as links.
const SHOW_PARAM: Record<MeetingFilter, string | null> = {
  all: null,
  agendas: 'agendas',
  fourUps: '4ups',
}

function parseShow(value: string | null): MeetingFilter {
  return value === '4ups' ? 'fourUps' : value === 'agendas' ? 'agendas' : 'all'
}

const CONFIGURED = isSourceConfigured('agendas') || isSourceConfigured('fourUps')

export default function Agendas() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-12 sm:py-16">
      <h1 className="text-4xl font-semibold">Agendas</h1>
      <p className="mt-3 max-w-prose text-dusk">
        Meeting agendas and 4Up status reports, straight from the team&apos;s Drive folder.
      </p>
      <div aria-hidden="true" className="mt-6 horizon-line w-24" />
      {CONFIGURED ? (
        <MeetingsView />
      ) : (
        <div className="mt-10">
          <EmptyState>Meeting documents aren&apos;t connected yet.</EmptyState>
        </div>
      )}
    </div>
  )
}

function MeetingsView() {
  const meetings = useMeetings()
  const [params, setParams] = useSearchParams()
  const [preview, setPreview] = useState<{ meeting: Meeting; doc: MeetingDoc } | null>(null)

  const show = parseShow(params.get('show'))
  const month = params.get('month') ?? 'all'

  function setParam(key: string, value: string | null) {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (value === null) next.delete(key)
        else next.set(key, value)
        return next
      },
      { replace: true },
    )
  }

  const all = meetings.data ?? []
  const today = new Date()
  const filtered = filterMeetings(all, show, today).filter(
    (m) => month === 'all' || monthKey(m.date) === month,
  )
  const { upcoming, past } = splitMeetings(filtered, today)

  return (
    <>
      <div className="mt-10">
        <AgendaFilters
          show={show}
          onShowChange={(value) => setParam('show', SHOW_PARAM[value])}
          month={month}
          months={meetingMonths(all)}
          onMonthChange={(value) => setParam('month', value === 'all' ? null : value)}
        />
      </div>

      <div className="mt-10 space-y-14">
        {meetings.loading ? (
          <MeetingsSkeleton />
        ) : meetings.error ? (
          <ErrorState message="We couldn't load meetings right now." onRetry={meetings.refetch} />
        ) : all.length === 0 ? (
          <EmptyState>
            No meetings yet. Agendas and 4Ups will show up here once they&apos;re added to Drive.
          </EmptyState>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-start gap-4">
            <EmptyState>No meetings match these filters.</EmptyState>
            <button
              type="button"
              onClick={() => setParams({}, { replace: true })}
              className={buttonClasses('secondary')}
            >
              Clear filters
            </button>
          </div>
        ) : (
          <>
            {upcoming.length > 0 && (
              <MeetingSection
                title="Upcoming"
                meetings={upcoming}
                show={show}
                upcoming
                today={today}
                onOpen={(meeting, doc) => setPreview({ meeting, doc })}
              />
            )}
            {past.length > 0 && (
              <MeetingSection
                title="Past"
                meetings={past}
                show={show}
                upcoming={false}
                today={today}
                onOpen={(meeting, doc) => setPreview({ meeting, doc })}
              />
            )}
          </>
        )}
      </div>

      {preview && (
        <DocumentPanel
          key={`${monthKey(preview.meeting.date)}-${preview.meeting.date.getDate()}-${preview.doc}`}
          title={`Meeting · ${formatCardDate(preview.meeting.date)}`}
          documents={panelDocuments(preview.meeting)}
          initialId={preview.doc}
          onClose={() => setPreview(null)}
        />
      )}
    </>
  )
}

function panelDocuments(meeting: Meeting): PanelDocument[] {
  const docs: PanelDocument[] = []
  if (meeting.agenda) docs.push({ id: 'agenda', label: 'Agenda', file: meeting.agenda.file })
  if (meeting.fourUp) docs.push({ id: 'fourUp', label: '4Up', file: meeting.fourUp.file })
  return docs
}

interface MeetingSectionProps {
  title: string
  meetings: Meeting[]
  show: MeetingFilter
  upcoming: boolean
  today: Date
  onOpen: (meeting: Meeting, doc: MeetingDoc) => void
}

function MeetingSection({ title, meetings, show, upcoming, today, onOpen }: MeetingSectionProps) {
  const headingId = `meetings-${title.toLowerCase()}`
  return (
    <section aria-labelledby={headingId}>
      <h2 id={headingId} className="text-2xl font-semibold">
        {title}
      </h2>
      <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {meetings.map((meeting) => (
          <li key={meeting.date.getTime()}>
            <MeetingCard
              meeting={meeting}
              show={show}
              upcoming={upcoming}
              today={isSameDay(meeting.date, today)}
              onOpen={onOpen}
            />
          </li>
        ))}
      </ul>
    </section>
  )
}

function MeetingsSkeleton() {
  return (
    <LoadingState>
      {['w-32', 'w-20'].map((headingWidth, section) => (
        <div key={section} className={section > 0 ? 'mt-14' : undefined}>
          <Skeleton className={`h-7 ${headingWidth}`} />
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="rounded-2xl bg-surface p-5 shadow-card">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="mt-2 h-7 w-32" />
                <div className="mt-6 flex gap-2">
                  <Skeleton className="h-9 w-24 rounded-full" />
                  <Skeleton className="h-9 w-16 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </LoadingState>
  )
}
