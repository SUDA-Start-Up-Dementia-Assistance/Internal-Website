// Shared with /api (Node ESM): relative imports keep their .js extension.
import { REVIEW_SLA_BUSINESS_DAYS } from '../config/process.js'
import {
  TEAM_TIME_ZONE,
  addDaysToDateKey,
  weekdayOf,
  zonedDateKey,
  zonedMidnight,
} from './teamTime.js'

/*
 * Business time = time that falls on Monday–Friday in America/New_York (all 24 hours of
 * those days; weekends don't count). No holidays. Shared by the browser and /api.
 */

const HOUR_MS = 3_600_000

export function isBusinessDay(dateKey: string): boolean {
  const day = weekdayOf(dateKey)
  return day !== 0 && day !== 6
}

/** Business hours elapsed from `a` to `b` (0 if `b` is not after `a`). */
export function businessHoursBetween(a: Date, b: Date, timeZone = TEAM_TIME_ZONE): number {
  if (b.getTime() <= a.getTime()) return 0
  let total = 0
  const lastKey = zonedDateKey(b, timeZone)
  for (let key = zonedDateKey(a, timeZone); key <= lastKey; key = addDaysToDateKey(key, 1)) {
    if (!isBusinessDay(key)) continue
    // Real day boundaries, so DST days count 23 or 25 hours.
    const start = Math.max(a.getTime(), zonedMidnight(key, timeZone).getTime())
    const end = Math.min(b.getTime(), zonedMidnight(addDaysToDateKey(key, 1), timeZone).getTime())
    if (end > start) total += end - start
  }
  return total / HOUR_MS
}

/**
 * A review requested at `requestedAt` is late once a full business day (24 business hours by
 * default) has passed: requested Friday 4pm → late at Monday 4pm.
 */
export function isPastSla(
  requestedAt: Date,
  now: Date,
  slaBusinessDays = REVIEW_SLA_BUSINESS_DAYS,
): boolean {
  return businessHoursBetween(requestedAt, now) >= slaBusinessDays * 24
}

/** Business days from `fromKey` through `throughKey`, both included (0 if reversed). */
export function businessDaysInclusive(fromKey: string, throughKey: string): number {
  let count = 0
  for (let key = fromKey; key <= throughKey; key = addDaysToDateKey(key, 1)) {
    if (isBusinessDay(key)) count += 1
  }
  return count
}
