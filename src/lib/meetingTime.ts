// Shared with /api (Node ESM): relative imports keep their .js extension.
import { zonedDateKey, zonedMidnight } from './teamTime.js'

/*
 * When a calendar meeting happens, in the team's time zone. Timed meetings carry ISO
 * instants; all-day ones carry "YYYY-MM-DD" dates (end exclusive), which mean midnight in
 * America/New_York.
 */

export interface MeetingTimes {
  start: string
  end: string
  allDay: boolean
}

export function meetingStart(meeting: MeetingTimes): Date {
  return meeting.allDay ? zonedMidnight(meeting.start) : new Date(meeting.start)
}

export function meetingEnd(meeting: MeetingTimes): Date {
  return meeting.allDay ? zonedMidnight(meeting.end) : new Date(meeting.end)
}

/** A meeting counts as upcoming until it ends (so one in progress is still upcoming). */
export function isUpcoming(meeting: MeetingTimes, now = new Date()): boolean {
  return meetingEnd(meeting).getTime() > now.getTime()
}

/** The meeting's calendar date in America/New_York ("YYYY-MM-DD"). */
export function meetingDateKey(meeting: MeetingTimes): string {
  return meeting.allDay ? meeting.start : zonedDateKey(new Date(meeting.start))
}
