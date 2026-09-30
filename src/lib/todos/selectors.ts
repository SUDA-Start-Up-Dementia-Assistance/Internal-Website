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
  /** GitHub logins; [] = for everyone on the team. */
  assignees: readonly string[]
  done: boolean
  createdAt: string
}

export const DASHBOARD_TODOS_LIMIT = 5
/** "Due this week" = today through the next 6 days. */
export const TODO_WEEK_DAYS = 7

export const isTodoOverdue = (todo: TodoLike, today: string) =>
  !todo.done && todo.dueDate !== undefined && todo.dueDate < today

export const isAssignedToLogin = (todo: TodoLike, login: string) =>
  todo.assignees.some((a) => a.toLowerCase() === login.toLowerCase())

/** The same people, in any order and case. */
export function sameLogins(a: readonly string[], b: readonly string[]): boolean {
  const key = (list: readonly string[]) =>
    [...new Set(list.map((l) => l.toLowerCase()))].sort().join(' ')
  return key(a) === key(b)
}

/** Assigned to nobody in particular: it's for the whole team. */
export const isForEveryone = (todo: TodoLike) => todo.assignees.length === 0

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
  /**
   * Up to 5 open team to-dos, whoever they're assigned to. Mine and everyone's come first
   * (they're the ones to act on), then other people's; soonest due first within each.
   */
  items: T[]
  counts: {
    /** Every open team to-do (the full count; `items` is capped). */
    open: number
    /** Every open overdue team to-do. */
    overdue: number
    /** Open overdue to-dos that include me or are for everyone: the "Waiting on you" count. */
    overdueForMe: number
    /** Assigned to me (possibly with others). */
    mine: number
    /** For everyone (no assignees). */
    everyone: number
    /** Assigned only to other people. */
    others: number
  }
}

/** Assigned to `login`, or for everyone: the to-dos that are this person's to pick up. */
export const isForLogin = (todo: TodoLike, login: string) =>
  isForEveryone(todo) || isAssignedToLogin(todo, login)

export function selectDashboardTodos<T extends TodoLike>(
  todos: readonly T[],
  login: string,
  today: string,
): DashboardTodos<T> {
  const open = todos.filter((t) => !t.done)
  const byRelevance = (a: T, b: T) =>
    Number(!isForLogin(a, login)) - Number(!isForLogin(b, login)) || compareTodos(a, b)
  const overdue = open.filter((t) => isTodoOverdue(t, today))
  return {
    items: [...open].sort(byRelevance).slice(0, DASHBOARD_TODOS_LIMIT),
    counts: {
      open: open.length,
      overdue: overdue.length,
      overdueForMe: overdue.filter((t) => isForLogin(t, login)).length,
      mine: open.filter((t) => isAssignedToLogin(t, login)).length,
      everyone: open.filter(isForEveryone).length,
      others: open.filter((t) => !isForLogin(t, login)).length,
    },
  }
}

export type TodoFilter = 'all' | 'mine' | 'everyone'

export function filterTodos<T extends TodoLike>(
  todos: readonly T[],
  filter: TodoFilter,
  login: string,
): T[] {
  if (filter === 'mine') return todos.filter((t) => isAssignedToLogin(t, login))
  if (filter === 'everyone') return todos.filter(isForEveryone)
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
