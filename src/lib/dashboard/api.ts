import { hasKey, request } from '../tasks/api'
import type { DashboardResponse } from './types'

export function fetchDashboard(): Promise<DashboardResponse> {
  return request(
    '/api/dashboard',
    {},
    hasKey('generatedAt'),
    "We couldn't load your dashboard right now.",
  )
}
