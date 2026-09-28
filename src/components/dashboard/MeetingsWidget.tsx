import { ArrowRight, CalendarDays, FileText, Video } from 'lucide-react'
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { CALENDAR_URL } from '../../config/meetings'
import { isSourceConfigured } from '../../config/sources'
import {
  isHappeningNow,
  meetingDayLabel,
  meetingTimeRange,
  type DashboardQuery,
  type MeetingsWidget as MeetingsData,
} from '../../lib/dashboard'
import { useFeed } from '../../lib/drive'
import { joinAgendas, type JoinedMeeting, type Meeting } from '../../lib/meetings'
import EmptyState from '../EmptyState'
import ExternalLinkLabel from '../ExternalLinkLabel'
import Skeleton from '../Skeleton'
import { FOOTER_LINK, WidgetBody, WidgetCard } from './Widget'

/**
 * The meeting's tag: "Retro" for retros, "Recurring" for any other event that's part of a
 * repeating series in Google Calendar, and none for one-off events.
 */
function meetingTag(meeting: Meeting): { label: string; className: string } | null {
  if (meeting.kind === 'retro') {
    return { label: 'Retro', className: 'bg-status-purple-bg text-status-purple-text' }
  }
  if (meeting.recurring) {
    return { label: 'Recurring', className: 'bg-status-blue-bg text-status-blue-text' }
  }
  return null
}

export default function MeetingsWidget({ query, now }: { query: DashboardQuery; now: Date }) {
  return (
    <WidgetCard
      id="meetings"
      title="Upcoming meetings"
      icon={CalendarDays}
      footer={
        <>
          <Link to="/meetings" className={FOOTER_LINK}>
            All meetings
            <ArrowRight aria-hidden="true" className="size-3.5" />
          </Link>
          {CALENDAR_URL && (
            <a href={CALENDAR_URL} target="_blank" rel="noreferrer" className={FOOTER_LINK}>
              Open calendar
              <ExternalLinkLabel />
            </a>
          )}
        </>
      }
    >
      <WidgetBody
        query={query}
        value={query.data?.meetings}
        skeleton={
          <div className="space-y-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex gap-4">
                <Skeleton className="h-10 w-16" />
                <div className="flex-1">
                  <Skeleton className="h-5 w-48" />
                  <Skeleton className="mt-2 h-4 w-28" />
                </div>
              </div>
            ))}
          </div>
        }
      >
        {(data) => <MeetingList data={data} now={now} />}
      </WidgetBody>
    </WidgetCard>
  )
}

function MeetingList({ data, now }: { data: MeetingsData; now: Date }) {
  const agendas = useFeed('agendas')
  const agendasShown = isSourceConfigured('agendas')
  // Official meetings show agenda state only once the feed has loaded (never a false "not posted").
  const meetings: JoinedMeeting[] = useMemo(
    () => (agendasShown && agendas.data ? joinAgendas(data.meetings, agendas.data) : data.meetings),
    [agendasShown, agendas.data, data.meetings],
  )

  if (!data.connected) {
    return (
      <EmptyState>
        Calendar not connected. Meetings will show up here once the team calendar is linked.
      </EmptyState>
    )
  }
  if (meetings.length === 0) {
    return <EmptyState>Nothing on the team calendar for the next two weeks.</EmptyState>
  }
  return (
    <ul className="space-y-2">
      {meetings.map((meeting, i) => (
        <MeetingRow key={meeting.id} meeting={meeting} next={i === 0} now={now} />
      ))}
    </ul>
  )
}

function MeetingRow({ meeting, next, now }: { meeting: JoinedMeeting; next: boolean; now: Date }) {
  const live = isHappeningNow(meeting, now)
  const day = meetingDayLabel(meeting, now)
  const tag = meetingTag(meeting)
  return (
    <li className={`flex gap-4 rounded-xl p-3 ${next ? 'bg-cream ring-1 ring-apricot/60' : ''}`}>
      <div className="w-28 shrink-0 text-sm">
        <p className={`font-semibold ${day === 'Today' ? 'text-ember' : ''}`}>{day}</p>
        <p className="text-xs whitespace-nowrap text-dusk">{meetingTimeRange(meeting)}</p>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          {live ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-apricot px-2 py-0.5 text-xs font-semibold text-night">
              <span
                aria-hidden="true"
                className="size-1.5 rounded-full bg-night motion-safe:animate-pulse"
              />
              Happening now
            </span>
          ) : (
            next && <span className="text-xs font-semibold text-ember">Next up</span>
          )}
          {tag && (
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${tag.className}`}>
              {tag.label}
            </span>
          )}
        </div>
        <a
          href={meeting.htmlLink}
          target="_blank"
          rel="noreferrer"
          className="mt-1 block rounded-sm font-medium underline-offset-4 hover:text-ember hover:underline"
        >
          {meeting.title}
          <span className="sr-only"> (details in Google Calendar)</span>
          <span className="ml-1.5 inline-block align-[-2px] text-dusk">
            <ExternalLinkLabel />
          </span>
        </a>
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {meeting.joinUrl && (
            <a
              href={meeting.joinUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-sm font-medium text-ember underline-offset-4 hover:underline"
            >
              <Video aria-hidden="true" className="size-4" />
              Join<span className="sr-only"> {meeting.title}</span>
              <ExternalLinkLabel />
            </a>
          )}
          {meeting.agenda !== undefined &&
            (meeting.agenda ? (
              <a
                href={meeting.agenda.file.webViewLink}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-sm font-medium text-ember underline-offset-4 hover:underline"
              >
                <FileText aria-hidden="true" className="size-4" />
                Agenda<span className="sr-only"> for {meeting.title}</span>
                <ExternalLinkLabel />
              </a>
            ) : (
              <span className="text-dusk">Agenda not posted yet</span>
            ))}
        </div>
      </div>
    </li>
  )
}
