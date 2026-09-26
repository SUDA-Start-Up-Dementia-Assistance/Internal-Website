import type { ArtifactCategory, DriveFile, FeedItem, Meeting } from './types'

const FEED_FILENAME = /^(\d{4}-\d{2}-\d{2})\s+(.+?)\s*$/
const ORDER_PREFIX = /^(\d+)\s+/

/**
 * Parses "YYYY-MM-DD" as a local calendar date (midnight local time), so it never shifts
 * a day in time zones west of UTC the way `new Date("2026-09-29")` does.
 * Returns null for impossible dates like 2026-02-30.
 */
export function parseLocalDate(iso: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!match) return null
  const [year, month, day] = match.slice(1).map(Number)
  const date = new Date(year, month - 1, day)
  const valid =
    date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
  return valid ? date : null
}

/** "YYYY-MM-DD" for a Date's local calendar day. */
export function toDateKey(date: Date): string {
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${mm}-${dd}`
}

function normalizeSuffix(suffix: string): string {
  return suffix.trim().replace(/\s+/g, ' ').toLowerCase()
}

export interface FeedMatcher {
  key: string
  suffix: string
}

/**
 * Matches "YYYY-MM-DD <Suffix>" against the feeds sharing a folder. The suffix match is
 * case-insensitive and whitespace-tolerant but otherwise exact, so "Agenda (1)" or
 * "Agenda copy" don't match. There is no fallback to modifiedTime: no match means null.
 */
export function classifyFeedFile(file: DriveFile, feeds: readonly FeedMatcher[]): FeedItem | null {
  const match = FEED_FILENAME.exec(file.name)
  if (!match) return null

  const date = parseLocalDate(match[1])
  if (!date) return null

  const suffix = normalizeSuffix(match[2])
  const feed = feeds.find((f) => normalizeSuffix(f.suffix) === suffix)
  return feed ? { file, date, sourceKey: feed.key } : null
}

/**
 * Pairs agendas and 4Ups that share a date. A date with only one of the two still yields
 * a Meeting. If a date has duplicates, the most recently modified file wins.
 * Returned newest first.
 */
export function groupMeetings(
  agendas: readonly FeedItem[],
  fourUps: readonly FeedItem[],
): Meeting[] {
  const byDate = new Map<string, Meeting>()

  function add(item: FeedItem, slot: 'agenda' | 'fourUp') {
    const key = toDateKey(item.date)
    const meeting = byDate.get(key) ?? { date: item.date }
    const existing = meeting[slot]
    if (!existing || item.file.modifiedTime > existing.file.modifiedTime) meeting[slot] = item
    byDate.set(key, meeting)
  }

  agendas.forEach((item) => add(item, 'agenda'))
  fourUps.forEach((item) => add(item, 'fourUp'))

  return [...byDate.values()].sort((a, b) => b.date.getTime() - a.date.getTime())
}

export function slugify(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** "02 Requirements" → { displayName: "Requirements", slug: "requirements", order: 2 }. */
export function parseCategory(
  folder: Pick<DriveFile, 'id' | 'name'>,
  files: DriveFile[] = [],
): ArtifactCategory {
  const { order, name: displayName } = parseOrderedName(folder.name)
  return { id: folder.id, slug: slugify(displayName), displayName, order, files }
}

/**
 * Published subfolders and files use an optional "NN " prefix for ordering:
 * "02 Requirements" → { order: 2, name: "Requirements" }. Unprefixed names get
 * order Infinity so they sort after prefixed ones.
 */
export function parseOrderedName(raw: string): { order: number; name: string } {
  const trimmed = raw.trim()
  const prefix = ORDER_PREFIX.exec(trimmed)
  if (!prefix) return { order: Number.POSITIVE_INFINITY, name: trimmed }
  return { order: Number(prefix[1]), name: trimmed.slice(prefix[0].length).trim() }
}

/** Sort comparator for "NN "-prefixed names: by prefix number, then by name. */
export function compareOrderedNames(a: string, b: string): number {
  const x = parseOrderedName(a)
  const y = parseOrderedName(b)
  if (x.order !== y.order) return x.order < y.order ? -1 : 1
  return x.name.localeCompare(y.name, undefined, { numeric: true })
}
