import { History } from 'lucide-react'
import { formatDateKey, meetingTimeRange } from '../../lib/dashboard'
import { meetingDateKey, type JoinedMeeting } from '../../lib/meetings'
import { MeetingDocLinks } from './MeetingLinks'

/** Official meetings from the past 2 weeks with their agendas and 4Ups, newest first. Collapsed. */
export default function PastMeetings({ meetings }: { meetings: JoinedMeeting[] }) {
  return (
    <details className="group rounded-2xl bg-surface p-5 shadow-card sm:p-6">
      <summary className="flex cursor-pointer items-center gap-2 rounded-sm font-heading text-xl font-semibold marker:text-dusk">
        <History aria-hidden="true" className="size-5 text-dusk" />
        Past 2 weeks
        <span className="font-body text-base font-normal text-dusk">
          ({meetings.length} official {meetings.length === 1 ? 'meeting' : 'meetings'})
        </span>
      </summary>
      {meetings.length === 0 ? (
        <p className="mt-4 text-dusk">No official meetings in the past 2 weeks.</p>
      ) : (
        <ul className="mt-4 divide-y divide-night/10">
          {meetings.map((meeting) => (
            <li
              key={meeting.id}
              className="flex flex-col gap-1 py-3 sm:flex-row sm:items-baseline sm:gap-5"
            >
              <p className="shrink-0 text-sm text-dusk sm:w-44">
                <span className="font-medium text-night">
                  {formatDateKey(meetingDateKey(meeting))}
                </span>{' '}
                · {meetingTimeRange(meeting)}
              </p>
              <p className="min-w-0 flex-1 font-medium">{meeting.title}</p>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                <MeetingDocLinks meeting={meeting} past />
              </div>
            </li>
          ))}
        </ul>
      )}
    </details>
  )
}
