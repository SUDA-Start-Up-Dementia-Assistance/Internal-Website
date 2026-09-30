// Shared with /api (Node ESM): relative imports keep their .js extension.
import { addDaysToDateKey } from '../teamTime.js'

/*
 * Pure to-do selection, used by the /tasks To-dos tab, the dashboard widget, and the server's
 * /api/dashboard. Dates are "YYYY-MM-DD" keys in America/New_York, compared as strings.
 */

/** The fields selection needs; both the server's and the browser's Todo fit. */
export interface TodoLike {
  id: string
  title: string
  dueDate?: string
  assignee?: string
  done: boolean
  createdAt: string
}

export const DASHBOARD_TODOS_LIMIT = 5
/** "Due this week" = today through the next 6 days. */
export const TODO_WEEK_DAYS = 7

export const isTodoOverdue = (todo: TodoLike, today: string) =>
  !todo.done && todo.dueDate !== undefined && todo.dueDate < today

export const isAssignedToLogin = (todo: TodoLike, login: string) =>
  todo.assignee !== undefined && todo.assignee.toLowerCase() === login.toLowerCase()

/** Soonest due date first (no date last), then oldest first. */
export function compareTodos(a: TodoLike, b: TodoLike): number {
  if (a.dueDate !== b.dueDate) {
    if (a.dueDate === undefined) return 1
    if (b.dueDate === undefined) return -1
    return a.dueDate.localeCompare(b.dueDate)
  }
  return a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)
}

export interface DashboardTodos<T> {
  /** Up to 5 open to-dos assigned to me or to nobody, most urgent first. */
  items: T[]
  counts: {
    /** Open to-dos assigned to me or to nobody (the full count; `items` is capped). */
    open: number
    overdue: number
    mine: number
    unassigned: number
  }
}

export function selectDashboardTodos<T extends TodoLike>(
  todos: readonly T[],
  login: string,
  today: string,
): DashboardTodos<T> {
  const relevant = todos.filter(
    (t) => !t.done && (t.assignee === undefined || isAssignedToLogin(t, login)),
  )
  return {
    items: [...relevant].sort(compareTodos).slice(0, DASHBOARD_TODOS_LIMIT),
    counts: {
      open: relevant.length,
      overdue: relevant.filter((t) => isTodoOverdue(t, today)).length,
      mine: relevant.filter((t) => t.assignee !== undefined).length,
      unassigned: relevant.filter((t) => t.assignee === undefined).length,
    },
  }
}

export type TodoFilter = 'all' | 'mine' | 'unassigned'

export function filterTodos<T extends TodoLike>(
  todos: readonly T[],
  filter: TodoFilter,
  login: string,
): T[] {
  if (filter === 'mine') return todos.filter((t) => isAssignedToLogin(t, login))
  if (filter === 'unassigned') return todos.filter((t) => t.assignee === undefined)
  return [...todos]
}

export interface TodoGroups<T> {
  overdue: T[]
  thisWeek: T[]
  later: T[]
  noDate: T[]
  /** Newest first. */
  done: T[]
}

export function groupTodos<T extends TodoLike & { doneAt?: string }>(
  todos: readonly T[],
  today: string,
): TodoGroups<T> {
  const weekEnd = addDaysToDateKey(today, TODO_WEEK_DAYS - 1)
  const groups: TodoGroups<T> = { overdue: [], thisWeek: [], later: [], noDate: [], done: [] }
  for (const todo of [...todos].sort(compareTodos)) {
    if (todo.done) groups.done.push(todo)
    else if (todo.dueDate === undefined) groups.noDate.push(todo)
    else if (todo.dueDate < today) groups.overdue.push(todo)
    else if (todo.dueDate <= weekEnd) groups.thisWeek.push(todo)
    else groups.later.push(todo)
  }
  groups.done.sort((a, b) => (b.doneAt ?? '').localeCompare(a.doneAt ?? ''))
  return groups
}
