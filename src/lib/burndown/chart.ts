import type { BurndownDay, BurndownUnit } from './types'

/*
 * Pure burndown math for the hand-built SVG chart. Dates are "YYYY-MM-DD" keys; arithmetic
 * runs in UTC so no time zone or DST can shift a calendar day.
 */

export function addDaysToKey(key: string, days: number): string {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}

/** Every date of the iteration, first to last (duration days). */
export function iterationDates(startDate: string, duration: number): string[] {
  return Array.from({ length: Math.max(0, duration) }, (_, i) => addDaysToKey(startDate, i))
}

/** Whole days from `from` to `to` (negative if `to` is earlier). */
export function daysBetween(from: string, to: string): number {
  const utc = (key: string) => {
    const [y, m, d] = key.split('-').map(Number)
    return Date.UTC(y, m - 1, d)
  }
  return Math.round((utc(to) - utc(from)) / 86_400_000)
}

/** Each iteration date's snapshot, or null where nobody viewed the sprint (a gap). */
export function daysByDate(days: BurndownDay[], dates: string[]): (BurndownDay | null)[] {
  const byDate = new Map(days.map((d) => [d.date, d]))
  return dates.map((date) => byDate.get(date) ?? null)
}

/** The scope the ideal line starts from: the earliest snapshot's. Null with no snapshots. */
export function startingScope(days: BurndownDay[]): number | null {
  return days.length > 0 ? days[0].scope : null
}

/**
 * The ideal line: a straight fall from `startScope` on the first day to 0 on the last,
 * one value per iteration day.
 */
export function idealLine(startScope: number, duration: number): number[] {
  if (duration <= 1) return duration === 1 ? [0] : []
  const last = duration - 1
  return Array.from({ length: duration }, (_, i) =>
    // Exact 0 at the end; rounded so float noise never shows up in labels.
    i === last ? 0 : Math.round(((startScope * (last - i)) / last) * 100) / 100,
  )
}

/**
 * Consecutive runs of non-null values, as [startIndex, endIndex] (inclusive). Lines are
 * drawn per run, so a missing day is a gap, never interpolated across.
 */
export function segments(values: (number | null)[]): [number, number][] {
  const runs: [number, number][] = []
  let start = -1
  values.forEach((v, i) => {
    if (v !== null && start === -1) start = i
    if (v === null && start !== -1) {
      runs.push([start, i - 1])
      start = -1
    }
  })
  if (start !== -1) runs.push([start, values.length - 1])
  return runs
}

/** A clean y-axis: 0 to a round max, in steps of 1, 2, 2.5 or 5 × 10ⁿ (at least 1). */
export function niceScale(maxValue: number, maxTicks = 5): { max: number; ticks: number[] } {
  const target = Math.max(maxValue, 1)
  const rough = target / maxTicks
  const magnitude = 10 ** Math.floor(Math.log10(rough))
  const step = Math.max(
    1,
    [1, 2, 2.5, 5, 10].map((f) => f * magnitude).find((s) => s >= rough) ?? 10 * magnitude,
  )
  const max = Math.ceil(target / step) * step
  const ticks = Array.from(
    { length: Math.round(max / step) + 1 },
    (_, i) => Math.round(i * step * 100) / 100,
  )
  return { max, ticks }
}

export const UNIT_LABELS: Record<BurndownUnit, { one: string; many: string; missing: string }> = {
  storyPoints: { one: 'point', many: 'points', missing: 'no story points' },
  estimateHours: { one: 'hour', many: 'hours', missing: 'no estimate' },
}

/** "1 point", "3.5 hours". */
export function formatAmount(value: number, unit: BurndownUnit): string {
  const label = UNIT_LABELS[unit]
  const number = Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, '')
  return `${number} ${value === 1 ? label.one : label.many}`
}

const utcDate = (key: string) => {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}
const axisDate = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
})
const longDate = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
})

/** "Sep 29", for axis ticks. */
export const formatAxisDate = (key: string) => axisDate.format(utcDate(key))
/** "Tue, Sep 29". */
export const formatLongDate = (key: string) => longDate.format(utcDate(key))
