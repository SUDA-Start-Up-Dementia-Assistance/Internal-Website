import { hasKey, request } from '../tasks/api'
import type { BurndownResponse } from './types'

/** GET /api/burndown; without an id, the server picks the current iteration. */
export function fetchBurndown(iterationId?: string): Promise<BurndownResponse> {
  const query = iterationId ? `?iteration=${encodeURIComponent(iterationId)}` : ''
  return request(
    `/api/burndown${query}`,
    {},
    hasKey('days'),
    "We couldn't load the sprint burndown right now.",
  )
}
