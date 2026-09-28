/*
 * Dates and times in the team's time zone (America/New_York), independent of where the code
 * runs: a browser anywhere, or a server in UTC. Pure functions with no browser APIs, so the
 * server (/api) imports this file too.
 *
 * Date keys are "YYYY-MM-DD" calendar dates. Instants are Dates. Converting between them
 * always goes through the zone's real UTC offset at that moment, so DST days (23 or 25
 * hours long) come out right.
 */

export const TEAM_TIME_ZONE = 'America/New_York'

const formatters = new Map<string, Intl.DateTimeFormat>()

function partsFormatter(timeZone: string): Intl.DateTimeFormat {
  let format = formatters.get(timeZone)
  if (!format) {
    format = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
    formatters.set(timeZone, format)
  }
  return format
}

interface WallClock {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
}

function wallClock(instant: Date, timeZone: string): WallClock {
  const parts: Record<string, number> = {}
  for (const part of partsFormatter(timeZone).formatToParts(instant)) {
    if (part.type !== 'literal') parts[part.type] = Number(part.value)
  }
  const { year, month, day, hour, minute, second } = parts
  return { year, month, day, hour, minute, second }
}

const pad = (n: number) => String(n).padStart(2, '0')

/** The calendar date ("YYYY-MM-DD") of `instant` in `timeZone`. */
export function zonedDateKey(instant: Date, timeZone = TEAM_TIME_ZONE): string {
  const { year, month, day } = wallClock(instant, timeZone)
  return `${year}-${pad(month)}-${pad(day)}`
}

/** The wall-clock hour (0–23) of `instant` in `timeZone`. */
export function zonedHour(instant: Date, timeZone = TEAM_TIME_ZONE): number {
  return wallClock(instant, timeZone).hour
}

/** Minutes since midnight (0–1439) of `instant`'s wall clock in `timeZone`. */
export function zonedMinuteOfDay(instant: Date, timeZone = TEAM_TIME_ZONE): number {
  const { hour, minute } = wallClock(instant, timeZone)
  return hour * 60 + minute
}

/** Milliseconds `timeZone` is ahead of UTC at `instant` (e.g. -4h for EDT). */
function offsetMs(instant: Date, timeZone: string): number {
  const w = wallClock(instant, timeZone)
  const asUtc = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second)
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000
}

/**
 * The instant when the wall clock in `timeZone` reads `hour:minute` on `dateKey`. On the
 * spring-forward day a skipped time (2:30am) lands an hour later, as clocks do.
 */
export function zonedInstant(
  dateKey: string,
  hour = 0,
  minute = 0,
  timeZone = TEAM_TIME_ZONE,
): Date {
  const [year, month, day] = dateKey.split('-').map(Number)
  const wall = Date.UTC(year, month - 1, day, hour, minute)
  // Two passes: the offset at the first guess may differ from the offset at the answer.
  let guess = wall - offsetMs(new Date(wall), timeZone)
  guess = wall - offsetMs(new Date(guess), timeZone)
  return new Date(guess)
}

/** Midnight at the start of `dateKey` in `timeZone`. */
export function zonedMidnight(dateKey: string, timeZone = TEAM_TIME_ZONE): Date {
  return zonedInstant(dateKey, 0, 0, timeZone)
}

/** Calendar arithmetic on a date key. */
export function addDaysToDateKey(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10)
}

/** 0 = Sunday … 6 = Saturday, for a date key. */
export function weekdayOf(dateKey: string): number {
  const [year, month, day] = dateKey.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay()
}

/** Whole days from `a` to `b` (negative if `b` is earlier). */
export function daysBetweenKeys(a: string, b: string): number {
  const toUtc = (key: string) => {
    const [year, month, day] = key.split('-').map(Number)
    return Date.UTC(year, month - 1, day)
  }
  return Math.round((toUtc(b) - toUtc(a)) / 86_400_000)
}
