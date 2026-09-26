/**
 * The /api/tasks response, as the browser sees it. Mirrors api/_lib/github/types.ts: keep
 * the two in sync.
 */

/** A status's role, from the server config. Other statuses are simply "open". */
export type StatusKey =
  'productBacklog' | 'sprintBacklog' | 'inProgress' | 'inReview' | 'done' | 'blocked'

export interface Iteration {
  id: string
  title: string
  /** "YYYY-MM-DD", a calendar date. */
  startDate: string
  /** Days. */
  duration: number
}

export interface Assignee {
  login: string
  avatarUrl: string
}

export interface Task {
  itemId: string
  contentId: string
  kind: 'draft' | 'issue' | 'pr'
  title: string
  /** Issues and PRs only; drafts live on the project board. */
  url?: string
  repo?: string
  number?: number
  assignees: Assignee[]
  status: string | null
  statusKey: StatusKey | null
  storyPoints?: number
  estimateHours?: number
  priority?: string
  size?: string
  /** "Estimated done date" ("Done by" in the UI), as "YYYY-MM-DD". */
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
  /** GitHub's option color (GRAY, BLUE, …). Unknown or missing renders as GRAY. */
  color?: string
}

export interface IterationOption extends Iteration {
  completed: boolean
}

export interface TaskMeta {
  projectUrl: string
  burndownUnit: 'storyPoints' | 'estimateHours'
  statuses: StatusOption[]
  /** Optional fields are absent when the project doesn't have them: hide their UI. */
  storyPointOptions?: Option[]
  priorities?: Option[]
  sizes?: Option[]
  types?: Option[]
  hasEstimate: boolean
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
  meta: TaskMeta
  team: TeamMember[]
}
