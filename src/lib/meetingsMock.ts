import type { Meeting, MeetingsResponse } from './meetings'
import { addDaysToDateKey, weekdayOf, zonedDateKey, zonedInstant } from './teamTime'

/*
 * Fake /api/meetings for sample mode (VITE_TASKS_MOCK=true, or a preview deployment):
 * - official "DAWN Team Meeting" every Tue & Thu 17:00–18:15. The mock Drive feed has
 *   Tuesday agendas only, so Tuesdays show an agenda and Thursdays show "not posted yet".
 * - "Sprint Retro" every Monday 20:00–21:00 (no agenda)
 * - one ad hoc meeting with a Google Meet link, two days from today at 14:00
 */

const CALENDAR = 'https://calendar.google.com/calendar/'

function timed(
  id: string,
  title: string,
  dateKey: string,
  [startHour, startMinute]: [number, number],
  [endHour, endMinute]: [number, number],
  kind: Meeting['kind'],
  joinUrl?: string,
): Meeting {
  return {
    id,
    title,
    start: zonedInstant(dateKey, startHour, startMinute).toISOString(),
    end: zonedInstant(dateKey, endHour, endMinute).toISOString(),
    allDay: false,
    kind,
    // The team meetings and retros repeat; the ad hoc pairing session is a one-off.
    recurring: kind !== 'adhoc',
    htmlLink: CALENDAR,
    ...(joinUrl && { joinUrl }),
  }
}

export function mockMeetings(from: string, to: string, now = new Date()): MeetingsResponse {
  const adHocDay = addDaysToDateKey(zonedDateKey(now), 2)
  const meetings: Meeting[] = []
  for (let key = from; key <= to; key = addDaysToDateKey(key, 1)) {
    const weekday = weekdayOf(key)
    if (weekday === 1) {
      meetings.push(timed(`mock-retro-${key}`, 'Sprint Retro', key, [20, 0], [21, 0], 'retro'))
    }
    if (weekday === 2 || weekday === 4) {
      meetings.push(
        timed(`mock-team-${key}`, 'DAWN Team Meeting', key, [17, 0], [18, 15], 'official'),
      )
    }
    if (key === adHocDay) {
      meetings.push(
        timed(
          `mock-adhoc-${key}`,
          'Pairing: morning routine screen',
          key,
          [14, 0],
          [14, 30],
          'adhoc',
          'https://meet.google.com/abc-defg-hij',
        ),
      )
    }
  }
  meetings.sort((a, b) => a.start.localeCompare(b.start))
  return { connected: true, from, to, meetings }
}
