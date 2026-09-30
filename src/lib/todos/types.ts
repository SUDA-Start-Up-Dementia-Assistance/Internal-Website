/**
 * Team to-dos as the browser sees them. Mirrors api/_lib/todos.ts: keep them in sync.
 * Small team chores that live in the site's private Blob store, never in GitHub.
 */
export interface Todo {
  id: string
  title: string
  description?: string
  /** "YYYY-MM-DD", a calendar date in America/New_York. */
  dueDate?: string
  /** GitHub logins. [] = not assigned to anyone in particular: it's for the whole team. */
  assignees: string[]
  done: boolean
  doneBy?: string
  /** ISO instant. */
  doneAt?: string
  createdBy: string
  createdAt: string
  updatedBy: string
  updatedAt: string
  version: number
}

export interface NewTodo {
  title: string
  description?: string
  dueDate?: string
  /** Omitted or [] = for everyone. */
  assignees?: string[]
}

/** Only the fields that changed. null clears an optional field. */
export interface TodoChanges {
  title?: string
  description?: string | null
  dueDate?: string | null
  /** The full new list; [] = for everyone. */
  assignees?: string[]
  done?: boolean
}
