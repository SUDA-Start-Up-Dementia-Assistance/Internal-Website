import type { Meeting, MeetingsResponse } from './meetings'
import { addDaysToDateKey, weekdayOf, zonedDateKey, zonedInstant } from './teamTime'

/*
 * Fake /api/meetings for sample mode (VITE_TASKS_MOCK=true, or a preview deployment):
 * - official "Sponsor Meeting" every Tuesday 16:00–16:45 (the time is made up). The mock
 *   Drive feed has Tuesday agendas, so these show an agenda link (or "not posted yet" past
 *   the last mock agenda).
 * - "DAWN Team Meeting" every Tue & Thu 17:00–18:15: recurring, no agenda
 * - "Sprint Retro" every Monday 20:00–21:00: recurring, no agenda
 * - one one-off meeting with a Google Meet link, two days from today at 14:00
 */

const CALENDAR = 'https://calendar.google.com/calendar/'

function timed(
  id: string,
  title: string,
  dateKey: string,
  [startHour, startMinute]: [number, number],
  [endHour, endMinute]: [number, number],
  kind: Meeting['kind'],
  recurring: boolean,
  joinUrl?: string,
): Meeting {
  return {
    id,
    title,
    start: zonedInstant(dateKey, startHour, startMinute).toISOString(),
    end: zonedInstant(dateKey, endHour, endMinute).toISOString(),
    allDay: false,
    kind,
    recurring,
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
      meetings.push(
        timed(`mock-retro-${key}`, 'Sprint Retro', key, [20, 0], [21, 0], 'retro', true),
      )
    }
    if (weekday === 2) {
      meetings.push(
        timed(`mock-sponsor-${key}`, 'Sponsor Meeting', key, [16, 0], [16, 45], 'official', true),
      )
    }
    if (weekday === 2 || weekday === 4) {
      meetings.push(
        timed(`mock-team-${key}`, 'DAWN Team Meeting', key, [17, 0], [18, 15], 'adhoc', true),
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
          false,
          'https://meet.google.com/abc-defg-hij',
        ),
      )
    }
  }
  meetings.sort((a, b) => a.start.localeCompare(b.start))
  return { connected: true, from, to, meetings }
}
