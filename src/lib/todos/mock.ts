import { MOCK_USER } from '../auth/mock'
import { addDaysToDateKey, zonedDateKey } from '../teamTime'
import { TasksError } from '../tasks/api'
import { applyChanges } from './changes'
import type { NewTodo, Todo, TodoChanges } from './types'

/*
 * Sample to-dos and an in-memory stand-in for /api/todos, used in sample mode
 * (VITE_TASKS_MOCK=true, or a preview deployment). Writes only change this tab's memory. It
 * checks versions like the server, so conflicts can be exercised too. Covers: an overdue
 * to-do, an unassigned one, one with a description, and one done recently.
 */

const HOUR_MS = 3_600_000
const DONE_VISIBLE_MS = 14 * 24 * HOUR_MS

function sampleTodos(now = new Date()): Todo[] {
  const today = zonedDateKey(now)
  const ago = (hours: number) => new Date(now.getTime() - hours * HOUR_MS).toISOString()
  const base = (id: string, title: string, createdHoursAgo: number, createdBy: string) => ({
    id,
    title,
    done: false,
    createdBy,
    createdAt: ago(createdHoursAgo),
    updatedBy: createdBy,
    updatedAt: ago(createdHoursAgo),
    version: 1,
  })
  return [
    {
      ...base(
        '9b1c7a52-6a0e-4f0e-9d41-0a6f3c1e2b01',
        'Email Gerry the beta feedback summary',
        120,
        'river-b',
      ),
      dueDate: addDaysToDateKey(today, -2),
      assignee: MOCK_USER.login,
    },
    {
      ...base('9b1c7a52-6a0e-4f0e-9d41-0a6f3c1e2b02', "Set up next St. Ann's visit", 72, 'priya-n'),
      dueDate: addDaysToDateKey(today, 3),
    },
    {
      ...base(
        '9b1c7a52-6a0e-4f0e-9d41-0a6f3c1e2b03',
        'Book a room for the sprint demo',
        48,
        MOCK_USER.login,
      ),
      description:
        'Golisano 1400 or the library study rooms. Needs a TV with HDMI for the tablet mirror, and seats for Gerry and Drew.',
      dueDate: addDaysToDateKey(today, 10),
      assignee: MOCK_USER.login,
    },
    {
      ...base(
        '9b1c7a52-6a0e-4f0e-9d41-0a6f3c1e2b04',
        'Order tablet stands for the dayroom',
        30,
        'sam-k',
      ),
      assignee: 'sam-k',
    },
    {
      ...base(
        '9b1c7a52-6a0e-4f0e-9d41-0a6f3c1e2b05',
        'Collect questions for the Tuesday sponsor meeting',
        20,
        'sam-k',
      ),
    },
    {
      ...base(
        '9b1c7a52-6a0e-4f0e-9d41-0a6f3c1e2b06',
        'Send Drew the updated project plan',
        200,
        MOCK_USER.login,
      ),
      assignee: 'river-b',
      done: true,
      doneBy: 'river-b',
      doneAt: ago(26),
      updatedBy: 'river-b',
      updatedAt: ago(26),
      version: 2,
    },
  ]
}

let store: Todo[] | null = null

function all(): Todo[] {
  store ??= sampleTodos()
  return store
}

/** For tests. */
export function resetMockTodos(todos?: Todo[]): void {
  store = todos ?? null
}

const copy = <T>(value: T): T => structuredClone(value)

function find(id: string): Todo {
  const todo = all().find((t) => t.id === id)
  if (!todo) throw new TasksError('not-found', 'That to-do no longer exists.')
  return todo
}

function checkVersion(todo: Todo, version: number): void {
  if (todo.version !== version) {
    throw new TasksError('conflict', 'This to-do was changed by someone else.')
  }
}

export const mockTodosApi = {
  async list(now = new Date()): Promise<Todo[]> {
    return copy(
      all().filter(
        (t) => !t.done || (t.doneAt && now.getTime() - Date.parse(t.doneAt) <= DONE_VISIBLE_MS),
      ),
    )
  },

  async create(input: NewTodo): Promise<Todo> {
    const at = new Date().toISOString()
    const todo: Todo = {
      id: crypto.randomUUID(),
      ...input,
      done: false,
      createdBy: MOCK_USER.login,
      createdAt: at,
      updatedBy: MOCK_USER.login,
      updatedAt: at,
      version: 1,
    }
    all().push(todo)
    return copy(todo)
  },

  async update(id: string, version: number, changes: TodoChanges): Promise<Todo> {
    const todo = find(id)
    checkVersion(todo, version)
    const next = applyChanges(todo, changes, MOCK_USER.login, new Date())
    next.version = todo.version + 1
    store = all().map((t) => (t.id === id ? next : t))
    return copy(next)
  },

  async remove(id: string, version: number): Promise<void> {
    checkVersion(find(id), version)
    store = all().filter((t) => t.id !== id)
  },
}
