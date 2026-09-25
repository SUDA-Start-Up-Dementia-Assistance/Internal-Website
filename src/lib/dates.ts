const DAY_MS = 86_400_000

/** Midnight local time on the same calendar day. */
export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

const longDate = new Intl.DateTimeFormat(undefined, {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
})

const shortDate = new Intl.DateTimeFormat(undefined, {
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

const cardDate = new Intl.DateTimeFormat(undefined, {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
})

const cardDateWithYear = new Intl.DateTimeFormat(undefined, {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  year: 'numeric',
})

/** "Tue, Sep 29", with the year added when it isn't the current year. */
export function formatCardDate(date: Date, today = new Date()): string {
  return (date.getFullYear() === today.getFullYear() ? cardDate : cardDateWithYear).format(date)
}

const monthYear = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' })

/** "September 2026" */
export function formatMonth(date: Date): string {
  return monthYear.format(date)
}
