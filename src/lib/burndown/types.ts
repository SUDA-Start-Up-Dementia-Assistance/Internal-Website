import type { Iteration } from '../tasks/types'

/**
 * The /api/burndown response, as the browser sees it. Mirrors api/_lib/burndown.ts and
 * api/burndown.ts: keep them in sync.
 */

/** Hours, from the Estimate field. Stored with each day so units never mix. */
export type BurndownUnit = 'estimateHours'

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

export interface BurndownResponse {
  /** Null when no iteration was asked for and none is running. */
  iteration: Iteration | null
  isCurrent: boolean
  unit: BurndownUnit
  /** Today in the team's time zone. */
  today: string
  /** Stored days (plus today's live one for the current iteration), oldest first. */
  days: BurndownDay[]
  /** Iterations with stored snapshots, for the picker. */
  iterationsWithSnapshots: string[]
  /** False when the snapshot store couldn't be read or written (history may be missing). */
  storageOk: boolean
}
