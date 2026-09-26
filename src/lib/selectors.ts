import { startOfDay } from './dates'
import type { ArtifactCategory, DriveFile, Meeting } from './drive'
import { artifactDisplayName } from './files'

/** The soonest meeting dated today or later, or undefined if none. */
export function selectNextMeeting(meetings: Meeting[], today = new Date()): Meeting | undefined {
  const cutoff = startOfDay(today).getTime()
  return meetings
    .filter((m) => m.date.getTime() >= cutoff)
    .sort((a, b) => a.date.getTime() - b.date.getTime())[0]
}

/**
 * The most recent meeting, dated today or earlier, that has a 4Up. 4Ups posted ahead of
 * future meetings are skipped. Undefined if none.
 */
export function selectLatestFourUp(meetings: Meeting[], today = new Date()): Meeting | undefined {
  const endOfToday = startOfDay(today).getTime()
  return meetings
    .filter((m) => m.fourUp && m.date.getTime() <= endOfToday)
    .sort((a, b) => b.date.getTime() - a.date.getTime())[0]
}

export interface PublishedFileRef {
  file: DriveFile
  category: ArtifactCategory
}

/** The most recently modified files across all categories. */
export function selectRecentlyPublished(
  categories: ArtifactCategory[],
  limit: number,
): PublishedFileRef[] {
  return categories
    .flatMap((category) => category.files.map((file) => ({ file, category })))
    .sort((a, b) => b.file.modifiedTime.localeCompare(a.file.modifiedTime))
    .slice(0, limit)
}

export type MeetingFilter = 'all' | 'agendas' | 'fourUps'

/** Upcoming (today or later, soonest first) and past (most recent first). */
export function splitMeetings(
  meetings: Meeting[],
  today = new Date(),
): { upcoming: Meeting[]; past: Meeting[] } {
  const cutoff = startOfDay(today).getTime()
  const upcoming = meetings
    .filter((m) => m.date.getTime() >= cutoff)
    .sort((a, b) => a.date.getTime() - b.date.getTime())
  const past = meetings
    .filter((m) => m.date.getTime() < cutoff)
    .sort((a, b) => b.date.getTime() - a.date.getTime())
  return { upcoming, past }
}

/**
 * Meetings that have something to show for the filter. Under "agendas", upcoming meetings
 * without one are kept so their card can say the agenda isn't posted yet.
 */
export function filterMeetings(
  meetings: Meeting[],
  show: MeetingFilter,
  today = new Date(),
): Meeting[] {
  const cutoff = startOfDay(today).getTime()
  switch (show) {
    case 'agendas':
      return meetings.filter((m) => m.agenda || m.date.getTime() >= cutoff)
    case 'fourUps':
      return meetings.filter((m) => m.fourUp)
    default:
      return meetings
  }
}

/** "YYYY-MM" for a date's local month. */
export function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

/** The distinct months that have meetings, newest first. */
export function meetingMonths(meetings: Meeting[]): { key: string; date: Date }[] {
  const byKey = new Map<string, Date>()
  for (const m of meetings) {
    const key = monthKey(m.date)
    if (!byKey.has(key)) byKey.set(key, new Date(m.date.getFullYear(), m.date.getMonth(), 1))
  }
  return [...byKey.entries()]
    .map(([key, date]) => ({ key, date }))
    .sort((a, b) => b.date.getTime() - a.date.getTime())
}

/** The most recent modifiedTime among a category's files, or undefined if it's empty. */
export function categoryLastUpdated(category: ArtifactCategory): string | undefined {
  return category.files.reduce<string | undefined>(
    (latest, f) => (!latest || f.modifiedTime > latest ? f.modifiedTime : latest),
    undefined,
  )
}

/**
 * Searches published file names (as displayed: no "NN " prefix or .pdf) and category names.
 * Every word in the query must match. Most recently modified first.
 */
export function searchPublished(query: string, categories: ArtifactCategory[]): PublishedFileRef[] {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (terms.length === 0) return []
  return categories
    .flatMap((category) => category.files.map((file) => ({ file, category })))
    .filter(({ file, category }) => {
      const haystack = `${artifactDisplayName(file.name)} ${category.displayName}`.toLowerCase()
      return terms.every((term) => haystack.includes(term))
    })
    .sort((a, b) => b.file.modifiedTime.localeCompare(a.file.modifiedTime))
}
