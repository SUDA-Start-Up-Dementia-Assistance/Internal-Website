import { formatDateKey } from './dashboard/format'
import { meetingDateKey, meetingEnd, meetingStart, type Meeting } from './meetings'
import { addDaysToDateKey, weekdayOf, zonedDateKey, zonedMinuteOfDay } from './teamTime'

/*
 * Pure layout logic for the /meetings page. Every date is a "YYYY-MM-DD" key in the team's
 * time zone (America/New_York), so grouping never shifts a meeting to another day, DST or not.
 */

/** Weeks run Monday–Sunday. */
export function weekStartKey(dateKey: string): string {
  return addDaysToDateKey(dateKey, -((weekdayOf(dateKey) + 6) % 7))
}

/** The 7 date keys of the week starting `weekStart` (a Monday). */
export function weekDays(weekStart: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDaysToDateKey(weekStart, i))
}

const byStart = (a: Meeting, b: Meeting) => meetingStart(a).getTime() - meetingStart(b).getTime()

export interface DayGroup<T extends Meeting = Meeting> {
  dateKey: string
  /** "Tue, Oct 6". */
  label: string
  meetings: T[]
}

export interface WeekSection<T extends Meeting = Meeting> {
  id: 'this-week' | 'next-week' | 'later'
  heading: 'This week' | 'Next week' | 'Later'
  days: DayGroup<T>[]
}

/**
 * Meetings grouped by their New York date, under "This week" / "Next week" / "Later"
 * (Monday–Sunday weeks, relative to `todayKey`). Empty sections are left out.
 */
export function groupByWeekAndDay<T extends Meeting>(
  meetings: readonly T[],
  todayKey: string,
): WeekSection<T>[] {
  const nextWeek = addDaysToDateKey(weekStartKey(todayKey), 7)
  const later = addDaysToDateKey(nextWeek, 7)
  const sections: WeekSection<T>[] = [
    { id: 'this-week', heading: 'This week', days: [] },
    { id: 'next-week', heading: 'Next week', days: [] },
    { id: 'later', heading: 'Later', days: [] },
  ]
  for (const meeting of [...meetings].sort(byStart)) {
    const key = meetingDateKey(meeting)
    const section = sections[key < nextWeek ? 0 : key < later ? 1 : 2]
    let day = section.days[section.days.length - 1]
    if (day?.dateKey !== key) {
      day = { dateKey: key, label: formatDateKey(key), meetings: [] }
      section.days.push(day)
    }
    day.meetings.push(meeting)
  }
  return sections.filter((s) => s.days.length > 0)
}

// ─── Week grid ───────────────────────────────────────────────────────────────

/** Most meetings are evenings: the grid shows 4pm–9pm unless the week needs more. */
export const DEFAULT_HOURS = { start: 16, end: 21 } as const

const DAY_MINUTES = 24 * 60

/**
 * A timed meeting's minutes on its own (start) day, in New York time. A meeting that runs
 * past midnight is cut off at the end of its first day.
 */
export function minutesOnDay(meeting: Meeting): { start: number; end: number } {
  const start = zonedMinuteOfDay(meetingStart(meeting))
  const endInstant = meetingEnd(meeting)
  const sameDay = zonedDateKey(endInstant) === meetingDateKey(meeting)
  const end = sameDay ? zonedMinuteOfDay(endInstant) : DAY_MINUTES
  return { start, end: Math.max(end, start + 15) }
}

/**
 * The hours the week grid shows: 4pm–9pm, widened to whole hours that fit every timed
 * meeting starting in the week of `weekStart`. All-day events don't count (they have their
 * own row).
 */
export function weekHourRange(
  meetings: readonly Meeting[],
  weekStart: string,
): { start: number; end: number } {
  const weekEnd = addDaysToDateKey(weekStart, 6)
  let start: number = DEFAULT_HOURS.start
  let end: number = DEFAULT_HOURS.end
  for (const meeting of meetings) {
    if (meeting.allDay) continue
    const key = meetingDateKey(meeting)
    if (key < weekStart || key > weekEnd) continue
    const minutes = minutesOnDay(meeting)
    start = Math.min(start, Math.floor(minutes.start / 60))
    end = Math.max(end, Math.min(24, Math.ceil(minutes.end / 60)))
  }
  return { start, end }
}

/** Whether an all-day meeting covers `dateKey` (its end date is exclusive). */
export function allDayCovers(meeting: Meeting, dateKey: string): boolean {
  return meeting.allDay && meeting.start <= dateKey && dateKey < meeting.end
}

export interface PlacedMeeting<T extends Meeting = Meeting> {
  meeting: T
  /** Percent of the visible hours, from the top. */
  top: number
  height: number
  /** Side-by-side columns for overlapping meetings. */
  lane: number
  lanes: number
}

/**
 * Positions for one day's timed meetings in a column showing `hours`. Overlapping meetings
 * sit side by side: each cluster of overlaps is split into as many lanes as it needs.
 */
export function layoutDay<T extends Meeting>(
  meetings: readonly T[],
  hours: { start: number; end: number },
): PlacedMeeting<T>[] {
  const span = (hours.end - hours.start) * 60
  const sorted = meetings
    .filter((m) => !m.allDay)
    .map((meeting) => ({ meeting, ...minutesOnDay(meeting) }))
    .sort((a, b) => a.start - b.start || b.end - a.end)

  const placed: PlacedMeeting<T>[] = []
  let cluster: { lane: number; end: number; index: number }[] = []
  let clusterEnd = -1
  const closeCluster = () => {
    const lanes = Math.max(1, ...cluster.map((c) => c.lane + 1))
    for (const c of cluster) placed[c.index].lanes = lanes
    cluster = []
  }
  for (const item of sorted) {
    if (item.start >= clusterEnd) closeCluster()
    const busy = new Set(cluster.filter((c) => c.end > item.start).map((c) => c.lane))
    let lane = 0
    while (busy.has(lane)) lane += 1
    const top = ((item.start - hours.start * 60) / span) * 100
    const bottom = ((item.end - hours.start * 60) / span) * 100
    placed.push({ meeting: item.meeting, top, height: bottom - top, lane, lanes: 1 })
    cluster.push({ lane, end: item.end, index: placed.length - 1 })
    clusterEnd = Math.max(clusterEnd, item.end)
  }
  closeCluster()
  return placed
}
