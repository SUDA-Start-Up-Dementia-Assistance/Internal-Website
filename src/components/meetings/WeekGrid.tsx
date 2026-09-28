import { meetingDateKey, type JoinedMeeting } from '../../lib/meetings'
import {
  allDayCovers,
  layoutDay,
  weekDays,
  weekHourRange,
  type DayGroup,
} from '../../lib/meetingsView'
import { weekdayOf, zonedDateKey, zonedMinuteOfDay } from '../../lib/teamTime'
import { formatDateKey, meetingTimeRange } from '../../lib/dashboard'
import MeetingDayList from './MeetingDayList'

const HOUR_PX = 56
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function hourLabel(hour: number): string {
  if (hour === 0 || hour === 24) return '12 AM'
  if (hour === 12) return '12 PM'
  return hour < 12 ? `${hour} AM` : `${hour - 12} PM`
}

const BLOCK: Record<JoinedMeeting['kind'], string> = {
  official: 'border-apricot bg-apricot/20',
  retro: 'border-lavender bg-lavender/20',
  adhoc: 'border-dusk/40 bg-night/5',
}

interface WeekGridProps {
  weekStart: string
  meetings: JoinedMeeting[]
  todayKey: string
  now: Date
}

/**
 * A Monday–Sunday grid, in New York time. The grid is a picture for sighted mouse users
 * (hidden from screen readers, its blocks out of the tab order); the list under it has the
 * same meetings with every link, for everyone.
 */
export default function WeekGrid({ weekStart, meetings, todayKey, now }: WeekGridProps) {
  const days = weekDays(weekStart)
  const hours = weekHourRange(meetings, weekStart)
  const hourCount = hours.end - hours.start
  const allDay = meetings.filter((m) => m.allDay && days.some((d) => allDayCovers(m, d)))
  const timedByDay = days.map((day) =>
    meetings.filter((m) => !m.allDay && meetingDateKey(m) === day),
  )
  const nowMinutes = zonedMinuteOfDay(now)
  const nowTop =
    nowMinutes >= hours.start * 60 && nowMinutes <= hours.end * 60
      ? ((nowMinutes - hours.start * 60) / (hourCount * 60)) * 100
      : null

  const listDays: DayGroup<JoinedMeeting>[] = days
    .map((day) => ({
      dateKey: day,
      label: formatDateKey(day),
      meetings: meetings
        .filter((m) => (m.allDay ? allDayCovers(m, day) : meetingDateKey(m) === day))
        .sort((a, b) => a.start.localeCompare(b.start)),
    }))
    .filter((d) => d.meetings.length > 0)

  return (
    <div className="space-y-8">
      <div aria-hidden="true" className="overflow-x-auto rounded-2xl bg-surface shadow-card">
        <div className="min-w-[44rem]">
          {/* Day headers */}
          <div className="grid grid-cols-[3.5rem_repeat(7,1fr)] border-b border-night/10">
            <div />
            {days.map((day) => (
              <div
                key={day}
                className={`px-2 py-2.5 text-center text-sm ${
                  day === todayKey ? 'font-semibold text-ember' : 'text-dusk'
                }`}
              >
                {WEEKDAYS[weekdayOf(day)]}{' '}
                <span
                  className={
                    day === todayKey
                      ? 'inline-flex size-7 items-center justify-center rounded-full bg-apricot text-night'
                      : ''
                  }
                >
                  {Number(day.slice(8))}
                </span>
              </div>
            ))}
          </div>

          {allDay.length > 0 && (
            <div className="grid grid-cols-[3.5rem_repeat(7,1fr)] border-b border-night/10">
              <div className="px-1 py-2 text-right text-xs text-dusk">All day</div>
              {days.map((day) => (
                <div key={day} className="space-y-1 border-l border-night/10 p-1">
                  {allDay
                    .filter((m) => allDayCovers(m, day))
                    .map((m) => (
                      <a
                        key={m.id}
                        href={m.htmlLink}
                        target="_blank"
                        rel="noreferrer"
                        tabIndex={-1}
                        className={`block truncate rounded-md border-l-4 px-1.5 py-0.5 text-xs font-medium ${BLOCK[m.kind]}`}
                      >
                        {m.title}
                      </a>
                    ))}
                </div>
              ))}
            </div>
          )}

          {/* Hours */}
          <div
            className="relative grid grid-cols-[3.5rem_repeat(7,1fr)]"
            style={{ height: hourCount * HOUR_PX }}
          >
            <div className="relative">
              {Array.from({ length: hourCount }, (_, i) => (
                <span
                  key={i}
                  className="absolute right-2 text-xs text-dusk"
                  style={{ top: i * HOUR_PX + 4 }}
                >
                  {hourLabel(hours.start + i)}
                </span>
              ))}
            </div>
            {days.map((day, i) => (
              <div
                key={day}
                className={`relative border-l border-night/10 ${day === todayKey ? 'bg-cream/70' : ''}`}
              >
                {Array.from({ length: hourCount - 1 }, (_, h) => (
                  <div
                    key={h}
                    className="absolute right-0 left-0 border-t border-night/10"
                    style={{ top: (h + 1) * HOUR_PX }}
                  />
                ))}
                {layoutDay(timedByDay[i], hours).map(({ meeting, top, height, lane, lanes }) => (
                  <a
                    key={meeting.id}
                    href={meeting.htmlLink}
                    target="_blank"
                    rel="noreferrer"
                    tabIndex={-1}
                    title={`${meeting.title} · ${meetingTimeRange(meeting)}`}
                    className={`absolute overflow-hidden rounded-md border-l-4 px-1.5 py-1 text-xs leading-tight hover:shadow-card ${BLOCK[meeting.kind]}`}
                    style={{
                      top: `${top}%`,
                      height: `${height}%`,
                      left: `calc(${(lane / lanes) * 100}% + 2px)`,
                      width: `calc(${100 / lanes}% - 4px)`,
                    }}
                  >
                    <span className="block font-medium">{meeting.title}</span>
                    <span className="block text-dusk">{meetingTimeRange(meeting)}</span>
                  </a>
                ))}
                {day === zonedDateKey(now) && nowTop !== null && (
                  <div
                    className="absolute right-0 left-0 border-t-2 border-ember"
                    style={{ top: `${nowTop}%` }}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <section aria-labelledby="week-list-title">
        <h3 id="week-list-title" className="mb-4 text-xl font-semibold">
          Meetings this week
        </h3>
        {listDays.length === 0 ? (
          <p className="text-dusk">No meetings this week.</p>
        ) : (
          <MeetingDayList days={listDays} todayKey={todayKey} now={now} level={4} />
        )}
      </section>
    </div>
  )
}
