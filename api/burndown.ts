import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  computeSnapshot,
  isIterationId,
  listSnapshotIterations,
  mergeDay,
  readFile,
  upsertDay,
  type BurndownDay,
  type BurndownUnit,
} from './_lib/burndown.js'
import { BURNDOWN_UNIT } from './_lib/config.js'
import { findCurrentIteration, todayKey } from './_lib/dates.js'
import { getProjectMeta } from './_lib/github/project.js'
import type { Iteration } from './_lib/github/types.js'
import { sendError, sendJson, withErrors } from './_lib/http.js'
import { getValidToken } from './_lib/session.js'
import { InputError } from './_lib/taskInput.js'

/** GET /api/burndown?iteration=<id>. Mirrored for the browser in src/lib/burndown/types.ts. */
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

export default withErrors(async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET')
    return sendError(res, 405, 'method-not-allowed', 'Use GET for this endpoint.')
  }
  return getBurndown(req, res)
})

async function getBurndown(req: VercelRequest, res: VercelResponse): Promise<void> {
  const token = await getValidToken(req, res)

  const now = new Date()
  const today = todayKey(now)
  const meta = await getProjectMeta(token)
  const iterations = meta.iteration.iterations
  const current = findCurrentIteration(iterations, today)

  const requested = Array.isArray(req.query.iteration)
    ? req.query.iteration[0]
    : req.query.iteration
  let target = current
  if (requested !== undefined && requested !== '') {
    target = isIterationId(requested) ? iterations.find((it) => it.id === requested) : undefined
    if (!target) throw new InputError('That sprint is not one of the project’s iterations.')
  }

  let storageOk = true
  const storage = async <T>(what: string, fallback: T, run: () => Promise<T>): Promise<T> => {
    try {
      return await run()
    } catch (err) {
      // The chart must not break because of storage: log it and carry on without history.
      storageOk = false
      console.error(
        `[burndown] ${what} failed: ${err instanceof Error ? err.message : String(err)}`,
      )
      return fallback
    }
  }

  const listed = storage('listing snapshots', [] as string[], () => listSnapshotIterations())
  const base = { unit: BURNDOWN_UNIT, today }

  if (!target) {
    return send(res, {
      ...base,
      iteration: null,
      isCurrent: false,
      days: [],
      iterationsWithSnapshots: await listed,
      storageOk,
    })
  }

  const iteration: Iteration = {
    id: target.id,
    title: target.title,
    startDate: target.startDate,
    duration: target.duration,
  }
  const isCurrent = target.id === current?.id
  const readStored = () => storage('reading snapshots', null, () => readFile(iteration.id))
  let days: BurndownDay[]

  // Only the current iteration is ever written; past ones are read-only.
  const snapshot = isCurrent ? await computeSnapshot(token, now) : null
  if (snapshot && snapshot.iteration.id === iteration.id) {
    const saved = await storage('saving today’s snapshot', null, () =>
      upsertDay(iteration, snapshot.day),
    )
    // Couldn't write: show whatever is stored (if readable) plus today's live numbers.
    days = saved
      ? saved.days
      : mergeDay((await readStored())?.file ?? { iteration, days: [] }, iteration, snapshot.day)
          .days
  } else {
    days = (await readStored())?.file.days ?? []
  }

  const withSnapshots = new Set(await listed)
  if (days.length > 0) withSnapshots.add(iteration.id)
  send(res, {
    ...base,
    iteration,
    isCurrent,
    days,
    iterationsWithSnapshots: [...withSnapshots],
    storageOk,
  })
}

function send(res: VercelResponse, body: BurndownResponse): void {
  sendJson(res, 200, body)
}
