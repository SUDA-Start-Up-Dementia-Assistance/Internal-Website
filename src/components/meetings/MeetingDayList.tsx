import { useId } from 'react'
import { isHappeningNow, meetingTimeRange } from '../../lib/dashboard'
import type { JoinedMeeting } from '../../lib/meetings'
import type { DayGroup } from '../../lib/meetingsView'
import { MeetingDocLinks, DetailsLink, JoinLink } from './MeetingLinks'
import MeetingTag, { HappeningNowBadge } from './MeetingTag'

interface MeetingDayListProps {
  days: DayGroup<JoinedMeeting>[]
  todayKey: string
  now: Date
  /** Heading level for the day labels. */
  level?: 3 | 4
}

/** Meetings under day headings ("Tue, Oct 6"), each with its time, tag, and links. */
export default function MeetingDayList({ days, todayKey, now, level = 3 }: MeetingDayListProps) {
  return (
    <div className="space-y-6">
      {days.map((day) => (
        <Day key={day.dateKey} day={day} today={day.dateKey === todayKey} now={now} level={level} />
      ))}
    </div>
  )
}

function Day({
  day,
  today,
  now,
  level,
}: {
  day: DayGroup<JoinedMeeting>
  today: boolean
  now: Date
  level: 3 | 4
}) {
  const headingId = useId()
  const Heading = level === 3 ? 'h3' : 'h4'
  return (
    <div role="group" aria-labelledby={headingId}>
      <Heading
        id={headingId}
        className={`font-body text-sm font-semibold tracking-wide uppercase ${
          today ? 'text-ember' : 'text-dusk'
        }`}
      >
        {day.label}
        {today && <span className="normal-case">{' · Today'}</span>}
      </Heading>
      <ul className="mt-2 divide-y divide-night/10 rounded-2xl bg-surface px-4 shadow-card sm:px-5">
        {day.meetings.map((meeting) => (
          <MeetingListRow key={meeting.id} meeting={meeting} now={now} />
        ))}
      </ul>
    </div>
  )
}

export function MeetingListRow({ meeting, now }: { meeting: JoinedMeeting; now: Date }) {
  return (
    <li className="flex flex-col gap-1 py-3.5 sm:flex-row sm:gap-5">
      <p className="shrink-0 text-sm font-medium whitespace-nowrap text-dusk sm:w-36">
        {meetingTimeRange(meeting)}
      </p>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium">{meeting.title}</p>
          {isHappeningNow(meeting, now) && <HappeningNowBadge />}
          <MeetingTag meeting={meeting} />
        </div>
        <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <JoinLink meeting={meeting} />
          <MeetingDocLinks meeting={meeting} />
          <DetailsLink meeting={meeting} />
        </div>
      </div>
    </li>
  )
}
