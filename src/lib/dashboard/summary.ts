import { isDone } from '../tasks/selectors'
import type { Task } from '../tasks/types'
import { isWidgetError, type DashboardResponse, type MyTasks } from './types'

/*
 * The header's "Waiting on you" line. Each count is null when its widget has no data (it
 * failed to load), so the header never claims "all caught up" about something it couldn't see.
 */

export interface WaitingCounts {
  reviews: number | null
  overdue: number | null
  blocked: number | null
  failingCi: number | null
}

/** A capped list's full count, minus the listed tasks checked off here since it loaded. */
function openCount(total: number, listed: Task[]): number {
  return Math.max(0, total - listed.filter(isDone).length)
}

export function taskCounts(tasks: MyTasks) {
  return {
    overdue: openCount(tasks.counts.overdue, tasks.overdue),
    dueThisWeek: openCount(tasks.counts.dueThisWeek, tasks.dueThisWeek),
    blocked: openCount(tasks.counts.blocked, tasks.blocked),
    inProgress: openCount(tasks.counts.inProgress, tasks.inProgress),
  }
}

export function waitingCounts(data: DashboardResponse): WaitingCounts {
  const tasks = isWidgetError(data.tasks) ? null : taskCounts(data.tasks)
  return {
    reviews: isWidgetError(data.reviewQueue) ? null : data.reviewQueue.length,
    overdue: tasks?.overdue ?? null,
    blocked: tasks?.blocked ?? null,
    failingCi: isWidgetError(data.myPrs)
      ? null
      : data.myPrs.filter((pr) => pr.ciState === 'FAILURE').length,
  }
}

/** Every count is known and zero. */
export function isAllCaughtUp(counts: WaitingCounts): boolean {
  return Object.values(counts).every((n) => n === 0)
}
