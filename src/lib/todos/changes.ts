import type { Todo, TodoChanges } from './types'

/**
 * `changes` applied to `todo` as the server would (doneBy/doneAt from `login`), without
 * touching the version. Also used for optimistic updates.
 */
export function applyChanges(todo: Todo, changes: TodoChanges, login: string, now: Date): Todo {
  const next: Todo = { ...todo, updatedBy: login, updatedAt: now.toISOString() }
  if (changes.title !== undefined) next.title = changes.title
  if (changes.assignees !== undefined) next.assignees = [...changes.assignees]
  for (const key of ['description', 'dueDate'] as const) {
    const value = changes[key]
    if (value === null) delete next[key]
    else if (value !== undefined) next[key] = value
  }
  if (changes.done === true && !todo.done) {
    next.done = true
    next.doneBy = login
    next.doneAt = now.toISOString()
  } else if (changes.done === false) {
    next.done = false
    delete next.doneBy
    delete next.doneAt
  }
  return next
}
