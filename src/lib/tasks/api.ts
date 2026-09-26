import type { TasksResponse } from './types'

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

export async function fetchTasks(): Promise<TasksResponse> {
  let res: Response
  try {
    res = await fetch('/api/tasks', {
      headers: { Accept: 'application/json' },
      credentials: 'same-origin',
    })
  } catch {
    throw new TasksError('network', "We couldn't reach the server. Check your connection.")
  }
  const isJson = res.headers.get('content-type')?.includes('application/json')
  // No /api at all, e.g. `npm run dev` (use `npx vercel dev`, or VITE_TASKS_MOCK=true).
  if (!isJson)
    throw new TasksError('api-unavailable', "Tasks aren't available on this version of the site.")
  const body = (await res.json()) as TasksResponse | { error?: { code?: string; message?: string } }
  if (!res.ok || !('tasks' in body)) {
    const error = 'error' in body ? body.error : undefined
    throw new TasksError(
      error?.code ?? 'unknown',
      error?.message ?? "We couldn't load tasks right now.",
    )
  }
  return body
}
