import type { NewTaskRequest, TaskPatch, TasksResponse, WriteResult } from './types'

/** A failed /api/tasks call, carrying the server's { code, message }. */
export class TasksError extends Error {
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = 'TasksError'
    this.code = code
  }

  /** The server no longer accepts this session: the user must sign in again. */
  get needsSignIn(): boolean {
    return this.code === 'session-expired' || this.code === 'unauthenticated'
  }
}

type ErrorBody = { error?: { code?: string; message?: string } }

/**
 * Calls /api and returns its JSON, or throws a TasksError with the server's message. Writes
 * are same-origin fetches, so the browser sends the Origin header the server checks.
 */
async function request<T>(
  path: string,
  init: { method?: string; body?: unknown },
  isValid: (body: unknown) => boolean,
  fallbackMessage: string,
): Promise<T> {
  let res: Response
  try {
    res = await fetch(path, {
      method: init.method ?? 'GET',
      headers: {
        Accept: 'application/json',
        ...(init.body !== undefined && { 'Content-Type': 'application/json' }),
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      credentials: 'same-origin',
    })
  } catch {
    throw new TasksError('network', "We couldn't reach the server. Check your connection.")
  }
  const isJson = res.headers.get('content-type')?.includes('application/json')
  // No /api at all, e.g. `npm run dev` (use `npx vercel dev`, or VITE_TASKS_MOCK=true).
  if (!isJson)
    throw new TasksError('api-unavailable', "Tasks aren't available on this version of the site.")
  const body = (await res.json()) as unknown
  if (!res.ok || !isValid(body)) {
    const error = (body as ErrorBody | null)?.error
    throw new TasksError(error?.code ?? 'unknown', error?.message ?? fallbackMessage)
  }
  return body as T
}

const hasKey = (key: string) => (body: unknown) =>
  typeof body === 'object' && body !== null && key in body

export function fetchTasks(): Promise<TasksResponse> {
  return request('/api/tasks', {}, hasKey('tasks'), "We couldn't load tasks right now.")
}

export function createTask(input: NewTaskRequest): Promise<WriteResult> {
  return request(
    '/api/tasks',
    { method: 'POST', body: input },
    hasKey('failedFields'),
    "We couldn't create the task.",
  )
}

export function updateTask(itemId: string, patch: TaskPatch): Promise<WriteResult> {
  return request(
    `/api/tasks/${encodeURIComponent(itemId)}`,
    { method: 'PATCH', body: patch },
    hasKey('failedFields'),
    "We couldn't save that change.",
  )
}
