import type { VercelRequest, VercelResponse } from '@vercel/node'
import { parseDateKey } from './_lib/dates.js'
import { listMeetings, type Meeting } from './_lib/google/calendar.js'
import { sendError, sendJson, withErrors } from './_lib/http.js'
import { getValidToken } from './_lib/session.js'
import { daysBetweenKeys } from '../src/lib/teamTime.js'

/** GET /api/meetings?from=YYYY-MM-DD&to=YYYY-MM-DD. Mirrored in src/lib/meetings.ts. */
export interface MeetingsResponse {
  /** False when the calendar isn't set up on this deployment (no Google env vars). */
  connected: boolean
  from: string
  /** Inclusive. */
  to: string
  meetings: Meeting[]
}

/** The widest range one request may ask for, in days (`to` - `from`). */
export const MAX_RANGE_DAYS = 62

export default withErrors(async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET')
    return sendError(res, 405, 'method-not-allowed', 'Use GET for this endpoint.')
  }
  return getMeetings(req, res)
})

async function getMeetings(req: VercelRequest, res: VercelResponse): Promise<void> {
  // Signed-in only. The calendar is read with the service account, not this token.
  await getValidToken(req, res)

  const from = parseDateKey(single(req.query.from))
  const to = parseDateKey(single(req.query.to))
  if (!from || !to || from !== single(req.query.from) || to !== single(req.query.to)) {
    return sendError(res, 400, 'invalid-input', 'Pass from and to as YYYY-MM-DD dates.')
  }
  const span = daysBetweenKeys(from, to)
  if (span < 0) return sendError(res, 400, 'invalid-input', '"to" must not be before "from".')
  if (span > MAX_RANGE_DAYS) {
    return sendError(res, 400, 'invalid-input', `Ask for at most ${MAX_RANGE_DAYS} days at a time.`)
  }

  const meetings = await listMeetings(from, to)
  sendJson(res, 200, {
    connected: meetings !== null,
    from,
    to,
    meetings: meetings ?? [],
  } satisfies MeetingsResponse)
}

function single(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}
