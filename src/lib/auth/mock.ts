import type { AuthUser } from './types'

/** The fake signed-in user for VITE_TASKS_MOCK=true. */
export const MOCK_USER: AuthUser = {
  login: 'mock-teammate',
  name: 'Mock Teammate',
  avatarUrl: '',
}
