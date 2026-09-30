import { formatCardDate, formatRelative } from '../dates'
import type { TeamMember } from '../tasks/types'
import type { Todo } from './types'

/** A "YYYY-MM-DD" key as local midnight, never UTC midnight (which is the day before here). */
export function dateFromKey(key: string): Date {
  const [year, month, day] = key.split('-').map(Number)
  return new Date(year, month - 1, day)
}

/** "Due Fri, Oct 2". */
export function dueLabel(dueDate: string, now = new Date()): string {
  return `Due ${formatCardDate(dateFromKey(dueDate), now)}`
}

/** A login's display name from the team list, or the login itself. */
export function personName(login: string, team: readonly TeamMember[]): string {
  return team.find((m) => m.login.toLowerCase() === login.toLowerCase())?.name ?? login
}

/** "Done by River Bennett · yesterday". */
export function doneLabel(todo: Todo, team: readonly TeamMember[], now = new Date()): string {
  const who = todo.doneBy ? ` by ${personName(todo.doneBy, team)}` : ''
  const when = todo.doneAt ? ` · ${formatRelative(todo.doneAt, now)}` : ''
  return `Done${who}${when}`
}
