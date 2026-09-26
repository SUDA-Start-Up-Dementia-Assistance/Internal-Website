import type { BURNDOWN_UNIT, StatusKey } from '../config.js'

/**
 * The /api/tasks response. Mirrored for the browser in src/lib/tasks/types.ts: keep the two
 * in sync.
 */

export interface Iteration {
  id: string
  title: string
  /** "YYYY-MM-DD" (a calendar date, not an instant). */
  startDate: string
  /** Days. */
  duration: number
}

export interface Assignee {
  login: string
  avatarUrl: string
}

export interface Task {
  /** The project item id (what field edits target). */
  itemId: string
  /** The draft issue, issue, or pull request id. */
  contentId: string
  kind: 'draft' | 'issue' | 'pr'
  title: string
  /** Issues and PRs only; drafts live on the project board. */
  url?: string
  /** "owner/name", issues and PRs only. */
  repo?: string
  number?: number
  assignees: Assignee[]
  /** The Status option's name, or null when unset. */
  status: string | null
  /** The status's role (Done, Blocked, …) from the server config, so renames stay one-line. */
  statusKey: StatusKey | null
  storyPoints?: number
  estimateHours?: number
  priority?: string
  size?: string
  /** "Estimated done date", as "YYYY-MM-DD". */
  doneBy?: string
  type?: string
  iteration?: Iteration
  updatedAt: string
}

export interface Option {
  id: string
  name: string
}

export interface StatusOption extends Option {
  key: StatusKey | null
  /** GitHub's option color (GRAY, BLUE, GREEN, …), so badges match the board. */
  color?: string
}

export interface IterationOption extends Iteration {
  completed: boolean
}

export interface TaskMeta {
  projectUrl: string
  burndownUnit: typeof BURNDOWN_UNIT
  statuses: StatusOption[]
  /** Optional fields are omitted when the project doesn't have them. */
  storyPointOptions?: Option[]
  priorities?: Option[]
  sizes?: Option[]
  types?: Option[]
  hasEstimate: boolean
  /** Completed and upcoming iterations, oldest first. */
  iterations: IterationOption[]
  currentIterationId: string | null
}

export interface TeamMember {
  id: string
  login: string
  name: string
  avatarUrl: string
}

export interface TasksResponse {
  tasks: Task[]
  /** Items GitHub hid from this user (e.g. issues in a private repo they can't read). */
  hiddenCount: number
  meta: TaskMeta
  team: TeamMember[]
}
