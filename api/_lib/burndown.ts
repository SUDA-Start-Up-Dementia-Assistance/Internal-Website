import { BlobPreconditionFailedError, get, list, put } from '@vercel/blob'
import { BURNDOWN_UNIT } from './config.js'
import { addDays, findCurrentIteration, parseDateKey, todayKey } from './dates.js'
import { ConfigError } from './env.js'
import { getProjectMeta, listItems } from './github/project.js'
import type { Iteration, Task } from './github/types.js'

/*
 * Sprint burndown snapshots. There is no scheduled job: when a signed-in user views the
 * CURRENT iteration, today's totals are computed with their token and upserted into
 * burndown/<iterationId>.json in the PRIVATE Blob store. Days nobody views are gaps.
 *
 * Only totals are stored, never task titles or assignees. computeSnapshot takes a token, so
 * a cron job with a read-only token can reuse it later if the gaps become a problem.
 */

export type BurndownUnit = typeof BURNDOWN_UNIT

/** One day's totals, measured in `unit`. */
export interface BurndownDay {
  /** "YYYY-MM-DD" in the team's time zone. */
  date: string
  remaining: number
  done: number
  scope: number
  /** Items in the iteration with no value for `unit`; they count as 0. */
  unestimatedCount: number
  unit: BurndownUnit
}

export interface BurndownFile {
  iteration: Iteration
  /** One entry per date, oldest first. */
  days: BurndownDay[]
}

export type Totals = Omit<BurndownDay, 'date' | 'unit'>

/** Sums, rounded to 2 decimals so 0.1 + 0.2 hours doesn't store as 0.30000000000000004. */
const round = (n: number) => Math.round(n * 100) / 100

/**
 * Totals for the items in `iterationId`, chosen by the Iteration field (never by Status), in
 * Estimate hours. scope = sum of estimates; done = sum where Status is Done; remaining =
 * scope - done. Items with no estimate add 0 and are counted in unestimatedCount.
 */
export function aggregate(tasks: readonly Task[], iterationId: string): Totals {
  let scope = 0
  let done = 0
  let unestimatedCount = 0
  for (const task of tasks) {
    if (task.iteration?.id !== iterationId) continue
    const value = task.estimateHours
    if (value === undefined) {
      unestimatedCount += 1
      continue
    }
    scope += value
    if (task.statusKey === 'done') done += value
  }
  return {
    scope: round(scope),
    done: round(done),
    remaining: round(scope - done),
    unestimatedCount,
  }
}

export interface Snapshot {
  iteration: Iteration
  day: BurndownDay
}

/**
 * Today's totals for the current iteration, read from GitHub with `token`. Null when no
 * iteration is running today.
 */
export async function computeSnapshot(token: string, now = new Date()): Promise<Snapshot | null> {
  const today = todayKey(now)
  const [meta, { tasks }] = await Promise.all([getProjectMeta(token), listItems(token)])
  const current = findCurrentIteration(meta.iteration.iterations, today)
  if (!current) return null
  const { id, title, startDate, duration } = current
  return {
    iteration: { id, title, startDate, duration },
    day: { date: today, ...aggregate(tasks, id), unit: BURNDOWN_UNIT },
  }
}

// ─── Storage (Vercel Blob, private) ──────────────────────────────────────────

const PREFIX = 'burndown/'
/** GitHub iteration ids are short opaque strings; anything else never becomes a path. */
const ITERATION_ID = /^[A-Za-z0-9_-]{1,100}$/

export function isIterationId(value: unknown): value is string {
  return typeof value === 'string' && ITERATION_ID.test(value)
}

/**
 * Hours snapshots live in burndown/<iterationId>.estimateHours.json. Plain
 * burndown/<iterationId>.json files are from when the unit was Story Points: they are left
 * untouched (never read or overwritten), so units never mix.
 */
const FILE_SUFFIX = `.${BURNDOWN_UNIT}.json`

export function blobPath(iterationId: string): string {
  if (!isIterationId(iterationId)) throw new Error(`Bad iteration id for a blob path`)
  return `${PREFIX}${iterationId}${FILE_SUFFIX}`
}

function blobToken(): string {
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim()
  if (!token) {
    throw new ConfigError('Missing required environment variable(s): BLOB_READ_WRITE_TOKEN.')
  }
  return token
}

const isNumber = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n)

/** A stored file, keeping only well-formed days in the burndown unit. Null if it isn't a burndown file. */
export function parseFile(raw: unknown): BurndownFile | null {
  if (typeof raw !== 'object' || raw === null) return null
  const { iteration, days } = raw as Partial<BurndownFile>
  if (!iteration || !isIterationId(iteration.id) || !Array.isArray(days)) return null
  const valid = days.filter(
    (d): d is BurndownDay =>
      typeof d === 'object' &&
      d !== null &&
      parseDateKey(d.date) === d.date &&
      d.unit === BURNDOWN_UNIT &&
      [d.remaining, d.done, d.scope, d.unestimatedCount].every(isNumber),
  )
  return { iteration, days: valid.sort((a, b) => a.date.localeCompare(b.date)) }
}

/** Adds or replaces `day` by date. The same day twice gives the same file. */
export function mergeDay(file: BurndownFile, iteration: Iteration, day: BurndownDay): BurndownFile {
  const days = file.days.filter((d) => d.date !== day.date && d.unit === day.unit)
  days.push(day)
  days.sort((a, b) => a.date.localeCompare(b.date))
  return { iteration, days }
}

/** The stored file and its ETag, or null if none exists yet. */
export async function readFile(
  iterationId: string,
): Promise<{ file: BurndownFile; etag: string } | null> {
  const result = await get(blobPath(iterationId), {
    access: 'private',
    token: blobToken(),
    // Read the latest write, not a cached copy: this is read-modify-write.
    useCache: false,
  })
  if (!result || result.statusCode !== 200) return null
  const text = await new Response(result.stream).text()
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    raw = null
  }
  const file = parseFile(raw)
  if (!file) {
    console.error(`[burndown] ignoring malformed ${blobPath(iterationId)}`)
    return null
  }
  return { file, etag: result.blob.etag }
}

/** Two people viewing at once can race; a lost race re-reads and tries again. */
const MAX_ATTEMPTS = 3

/**
 * Upserts `day` into the iteration's file (the latest view of the day wins). Idempotent per
 * date, and skips the write when nothing changed. Refuses a date outside the iteration, so a
 * past iteration's file is never rewritten by a later day.
 */
export async function upsertDay(iteration: Iteration, day: BurndownDay): Promise<BurndownFile> {
  const end = addDays(iteration.startDate, iteration.duration)
  if (day.date < iteration.startDate || day.date >= end) {
    throw new Error(`[burndown] ${day.date} is outside iteration ${iteration.id}; not writing`)
  }
  const token = blobToken()
  const path = blobPath(iteration.id)

  for (let attempt = 1; ; attempt++) {
    const current = await readFile(iteration.id)
    const next = mergeDay(current?.file ?? { iteration, days: [] }, iteration, day)
    if (current && JSON.stringify(current.file) === JSON.stringify(next)) return next

    try {
      await put(path, JSON.stringify(next), {
        access: 'private',
        token,
        contentType: 'application/json',
        addRandomSuffix: false,
        // Overwrite only the version we read; create only if it still doesn't exist.
        ...(current ? { ifMatch: current.etag } : { allowOverwrite: false }),
      })
      return next
    } catch (err) {
      const lostRace = err instanceof BlobPreconditionFailedError || !current
      if (!lostRace || attempt >= MAX_ATTEMPTS) throw err
    }
  }
}

/** Ids of iterations with a stored hours file. */
export async function listSnapshotIterations(): Promise<string[]> {
  const token = blobToken()
  const suffix = FILE_SUFFIX
  const ids = new Set<string>()
  let cursor: string | undefined
  do {
    const page = await list({ prefix: PREFIX, token, cursor, limit: 1000 })
    for (const blob of page.blobs) {
      const name = blob.pathname.slice(PREFIX.length)
      if (!name.endsWith(suffix)) continue
      const id = name.slice(0, -suffix.length)
      // Old story-point files ("abc.json") don't end with the suffix, so they never count.
      if (isIterationId(id)) ids.add(id)
    }
    cursor = page.hasMore ? page.cursor : undefined
  } while (cursor)
  return [...ids]
}
