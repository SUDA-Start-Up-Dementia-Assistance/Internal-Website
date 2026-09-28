import type { AuthUser } from '../auth'
import type { Meeting } from '../meetings'
import type { StatusOption, Task } from '../tasks/types'

/**
 * The /api/dashboard response, as the browser sees it. Mirrors api/_lib/dashboard.ts and
 * api/_lib/github/pulls.ts: keep them in sync.
 */

export interface WidgetError {
  error: { code: string; message: string }
}

/** A widget is its data, or { error } when its source failed on the server. */
export type Widget<T> = T | WidgetError

export interface SprintSummary {
  id: string
  title: string
  /** "YYYY-MM-DD". */
  startDate: string
  /** The sprint's last day, "YYYY-MM-DD" (inclusive). */
  endDate: string
  /** Business days left, today included. */
  daysLeft: number
  /** Live totals for the sprint; null if tasks couldn't be read. */
  burndown: {
    unit: 'estimateHours'
    scope: number
    done: number
    remaining: number
    unestimatedCount: number
  } | null
}

export interface MyTasks {
  /** Up to 5 each, most urgent first. */
  overdue: Task[]
  dueThisWeek: Task[]
  blocked: Task[]
  inProgress: Task[]
  /** The full counts (the lists above are capped). */
  counts: {
    overdue: number
    dueThisWeek: number
    blocked: number
    inProgress: number
    open: number
  }
  hiddenCount: number
  /** Status options with colors; [] when the project meta couldn't be read. */
  statuses: StatusOption[]
}

export interface MeetingsWidget {
  connected: boolean
  /** The next 5 meetings, not yet ended. */
  meetings: Meeting[]
}

export type CiState = 'SUCCESS' | 'FAILURE' | 'PENDING'

export interface PrReview {
  author: string
  state: 'APPROVED' | 'CHANGES_REQUESTED' | 'COMMENTED' | 'DISMISSED' | 'PENDING'
  submittedAt: string | null
}

export interface DashboardPr {
  id: string
  title: string
  url: string
  /** "owner/name". */
  repo: string
  number: number
  author: string | null
  authorAvatarUrl: string | null
  isDraft: boolean
  createdAt: string
  baseRefName: string
  headRefName: string
  requestedReviewers: string[]
  reviews: PrReview[]
  /** Distinct reviewers, requested or already reviewed (never the author). */
  reviewerCount: number
  requiredReviewers: number
  hasDemoVideo: boolean
  /** Null when the head commit has no checks. */
  ciState: CiState | null
  /** Feature → canary, canary → main. */
  targetsCorrectBase: boolean
}

export interface ReviewQueuePr extends DashboardPr {
  /** When my review was requested. */
  waitingSince: string
  isPastSla: boolean
}

export interface MyPr extends DashboardPr {
  reviewsApproved: number
  changesRequested: number
}

export interface DashboardResponse {
  me: AuthUser
  /** Null when no sprint is running today. */
  sprint: Widget<SprintSummary | null>
  tasks: Widget<MyTasks>
  reviewQueue: Widget<ReviewQueuePr[]>
  myPrs: Widget<MyPr[]>
  meetings: Widget<MeetingsWidget>
  /** ISO instant the server built this response. */
  generatedAt: string
}

export function isWidgetError(value: unknown): value is WidgetError {
  return typeof value === 'object' && value !== null && 'error' in value
}
