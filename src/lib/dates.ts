const DAY_MS = 86_400_000

// The team site is English-only; pinning the locale keeps labels consistent and testable.
const LOCALE = 'en-US'

/** Midnight local time on the same calendar day. */
export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

const longDate = new Intl.DateTimeFormat(LOCALE, {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
})

const shortDate = new Intl.DateTimeFormat(LOCALE, {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
})

/** "Thursday, October 2" */
export function formatMeetingDate(date: Date): string {
  return longDate.format(date)
}

/** "Oct 2, 2026" from an ISO timestamp. */
export function formatShortDate(timestamp: string): string {
  return shortDate.format(new Date(timestamp))
}

/** "Today", "Tomorrow", "In 5 days" for a date on or after today. */
export function relativeDayLabel(date: Date, today = new Date()): string {
  const days = Math.round((startOfDay(date).getTime() - startOfDay(today).getTime()) / DAY_MS)
  if (days === 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  return `In ${days} days`
}

export function isSameDay(a: Date, b: Date): boolean {
  return startOfDay(a).getTime() === startOfDay(b).getTime()
}

const cardDate = new Intl.DateTimeFormat(LOCALE, {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
})

const cardDateWithYear = new Intl.DateTimeFormat(LOCALE, {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  year: 'numeric',
})

/** "Tue, Sep 29", with the year added when it isn't the current year. */
export function formatCardDate(date: Date, today = new Date()): string {
  return (date.getFullYear() === today.getFullYear() ? cardDate : cardDateWithYear).format(date)
}

const monthYear = new Intl.DateTimeFormat(LOCALE, { month: 'long', year: 'numeric' })

/** "September 2026" */
export function formatMonth(date: Date): string {
  return monthYear.format(date)
}

const dayMonth = new Intl.DateTimeFormat(LOCALE, { month: 'short', day: 'numeric' })
const dayMonthYear = new Intl.DateTimeFormat(LOCALE, {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
})

/** "Sep 29", with the year added when it isn't the current year. */
export function formatDayMonth(date: Date, today = new Date()): string {
  return (date.getFullYear() === today.getFullYear() ? dayMonth : dayMonthYear).format(date)
}

const relative = new Intl.RelativeTimeFormat(LOCALE, { numeric: 'auto' })

/** "today", "yesterday", "3 days ago", "2 weeks ago", "last month", "2 years ago". */
export function formatRelative(when: Date | string, now = new Date()): string {
  const date = typeof when === 'string' ? new Date(when) : when
  const days = Math.round((startOfDay(date).getTime() - startOfDay(now).getTime()) / DAY_MS)
  const size = Math.abs(days)
  if (size < 7) return relative.format(days, 'day')
  if (size < 30) return relative.format(Math.round(days / 7), 'week')
  if (size < 365) return relative.format(Math.round(days / 30), 'month')
  return relative.format(Math.round(days / 365), 'year')
}
