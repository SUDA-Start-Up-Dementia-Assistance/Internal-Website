import type { AuthUser } from './types'

/** The fake signed-in user for sample data (VITE_TASKS_MOCK=true, or a preview deployment). */
export const MOCK_USER: AuthUser = {
  login: 'sample-teammate',
  name: 'Sample Teammate',
  avatarUrl: '',
}
