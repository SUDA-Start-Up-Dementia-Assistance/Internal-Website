import { CalendarDays, FileText, LayoutGrid } from 'lucide-react'
import { formatMeetingDate, relativeDayLabel } from '../../lib/dates'
import type { DriveQuery, Meeting } from '../../lib/drive'
import { selectNextMeeting } from '../../lib/selectors'
import { buttonClasses } from '../buttonStyles'
import Card from '../Card'
import EmptyState from '../EmptyState'
import ErrorState from '../ErrorState'
import ExternalLinkLabel from '../ExternalLinkLabel'
import LoadingState from '../LoadingState'
import Skeleton from '../Skeleton'

export default function NextMeetingCard({ meetings }: { meetings: DriveQuery<Meeting[]> }) {
  return (
    <Card title="Next meeting" icon={CalendarDays}>
      <NextMeetingBody meetings={meetings} />
    </Card>
  )
}

function NextMeetingBody({ meetings }: { meetings: DriveQuery<Meeting[]> }) {
  if (meetings.loading) {
    return (
      <LoadingState>
        <Skeleton className="h-4 w-20" />
        <Skeleton className="mt-3 h-8 w-56" />
        <Skeleton className="mt-6 h-10 w-32 rounded-full" />
      </LoadingState>
    )
  }
  if (meetings.error) {
    return <ErrorState message="We couldn't load meetings right now." onRetry={meetings.refetch} />
  }

  const next = selectNextMeeting(meetings.data ?? [])
  if (!next) {
    return (
      <EmptyState>
        No upcoming meetings yet. They&apos;ll show up here once an agenda is added.
      </EmptyState>
    )
  }

  return (
    <>
      <p className="text-sm font-medium text-ember">{relativeDayLabel(next.date)}</p>
      <p className="mt-1 font-heading text-2xl sm:text-3xl">{formatMeetingDate(next.date)}</p>
      <div className="mt-6 flex flex-wrap gap-3">
        {next.agenda && (
          <a
            href={next.agenda.file.webViewLink}
            target="_blank"
            rel="noreferrer"
            className={buttonClasses('primary')}
          >
            <FileText aria-hidden="true" className="size-4" />
            Agenda
            <ExternalLinkLabel />
          </a>
        )}
        {next.fourUp && (
          <a
            href={next.fourUp.file.webViewLink}
            target="_blank"
            rel="noreferrer"
            className={buttonClasses('secondary')}
          >
            <LayoutGrid aria-hidden="true" className="size-4" />
            4Up
            <ExternalLinkLabel />
          </a>
        )}
      </div>
    </>
  )
}
