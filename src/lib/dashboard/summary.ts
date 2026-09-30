import { isDone } from '../tasks/selectors'
import type { Task } from '../tasks/types'
import { isTodoOverdue } from '../todos/selectors'
import { zonedDateKey } from '../teamTime'
import { isWidgetError, type DashboardResponse, type MyTasks, type TodosWidget } from './types'

/*
 * The header's "Waiting on you" line. Each count is null when its widget has no data (it
 * failed to load), so the header never claims "all caught up" about something it couldn't see.
 */

export interface WaitingCounts {
  reviews: number | null
  overdue: number | null
  blocked: number | null
  failingCi: number | null
  overdueTodos: number | null
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

/** The to-do widget's full counts, minus the listed to-dos checked off here since it loaded. */
export function todoCounts(widget: TodosWidget, now = new Date()) {
  const today = zonedDateKey(now)
  const checked = widget.items.filter((t) => t.done)
  const checkedOverdue = checked.filter((t) => isTodoOverdue({ ...t, done: false }, today))
  return {
    open: Math.max(0, widget.counts.open - checked.length),
    overdue: Math.max(0, widget.counts.overdue - checkedOverdue.length),
  }
}

export function waitingCounts(data: DashboardResponse, now = new Date()): WaitingCounts {
  const tasks = isWidgetError(data.tasks) ? null : taskCounts(data.tasks)
  return {
    reviews: isWidgetError(data.reviewQueue) ? null : data.reviewQueue.length,
    overdue: tasks?.overdue ?? null,
    blocked: tasks?.blocked ?? null,
    failingCi: isWidgetError(data.myPrs)
      ? null
      : data.myPrs.filter((pr) => pr.ciState === 'FAILURE').length,
    overdueTodos: isWidgetError(data.todos) ? null : todoCounts(data.todos, now).overdue,
  }
}

/** Every count is known and zero. */
export function isAllCaughtUp(counts: WaitingCounts): boolean {
  return Object.values(counts).every((n) => n === 0)
}
