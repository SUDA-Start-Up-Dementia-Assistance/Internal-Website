import { isSampleMode } from '../sampleMode'
import { hasKey, request } from '../tasks/api'
import { mockTodosApi } from './mock'
import type { NewTodo, Todo, TodoChanges } from './types'

/*
 * /api/todos calls, or the in-memory mock in sample mode. Failures throw a TasksError with
 * the server's code: "conflict" (409, changed by someone else), "not-found", and so on.
 */

export async function fetchTodos(): Promise<Todo[]> {
  if (isSampleMode()) return mockTodosApi.list()
  const body = await request<{ todos: Todo[] }>(
    '/api/todos',
    {},
    hasKey('todos'),
    "We couldn't load the team's to-dos right now.",
  )
  return body.todos
}

export async function createTodo(input: NewTodo): Promise<Todo> {
  if (isSampleMode()) return mockTodosApi.create(input)
  const body = await request<{ todo: Todo }>(
    '/api/todos',
    { method: 'POST', body: input },
    hasKey('todo'),
    "We couldn't add that to-do.",
  )
  return body.todo
}

export async function updateTodo(id: string, version: number, changes: TodoChanges): Promise<Todo> {
  if (isSampleMode()) return mockTodosApi.update(id, version, changes)
  const body = await request<{ todo: Todo }>(
    `/api/todos/${encodeURIComponent(id)}`,
    { method: 'PATCH', body: { version, ...changes } },
    hasKey('todo'),
    "We couldn't save that change.",
  )
  return body.todo
}

export async function deleteTodo(id: string, version: number): Promise<void> {
  if (isSampleMode()) return mockTodosApi.remove(id, version)
  await request(
    `/api/todos/${encodeURIComponent(id)}?version=${version}`,
    { method: 'DELETE' },
    hasKey('ok'),
    "We couldn't delete that to-do.",
  )
}
