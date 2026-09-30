import { useCallback, useEffect, useSyncExternalStore } from 'react'
import { TasksError } from '../tasks/api'
import { showToast } from '../toast'
import * as api from './api'
import { applyChanges } from './changes'
import type { NewTodo, Todo, TodoChanges } from './types'

/** Data older than this is refetched when the window regains focus (or a view mounts). */
export const TODOS_STALE_MS = 30_000

export const CONFLICT_MESSAGE = 'Someone else changed this to-do. Reloaded the latest version.'
const GONE_MESSAGE = 'That to-do was deleted by someone else. Reloaded the list.'

interface Snapshot {
  data: Todo[] | undefined
  error: TasksError | null
  fetching: boolean
  fetchedAt: number
}

/*
 * One in-memory copy of the team's to-dos for the tab, shared by the To-dos tab and the
 * dashboard widget. Edits show at once (optimistic) and roll back, with a toast, if the
 * server refuses them. Writes to one item run one at a time, each sending the version the
 * server last confirmed, so quick double edits don't trip over their own version check.
 */
let snapshot: Snapshot = { data: undefined, error: null, fetching: false, fetchedAt: 0 }
let inFlight: Promise<void> | null = null
/** Bumped by every local write, so a read that started before it can't undo it on screen. */
let writeGeneration = 0
/** The server's latest copy of each item, the rollback target and the version to send. */
let confirmed = new Map<string, Todo>()
/** Per-item chains of pending writes, and how many are queued. */
const queues = new Map<string, Promise<unknown>>()
const queued = new Map<string, number>()
let tempIds = 0
const listeners = new Set<() => void>()

function update(next: Partial<Snapshot>): void {
  snapshot = { ...snapshot, ...next }
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

const getSnapshot = () => snapshot

function isStale(now = Date.now()): boolean {
  return !snapshot.data || now - snapshot.fetchedAt > TODOS_STALE_MS
}

/** Rewrites the list on screen (a no-op until it has loaded). */
function mutate(fn: (todos: Todo[]) => Todo[]): void {
  if (!snapshot.data) return
  writeGeneration += 1
  update({ data: fn(snapshot.data) })
}

const replace = (id: string, todo: Todo | null) =>
  mutate((todos) =>
    todo === null ? todos.filter((t) => t.id !== id) : todos.map((t) => (t.id === id ? todo : t)),
  )

/** The list on screen, if loaded. */
export function peekTodos(): Todo[] | undefined {
  return snapshot.data
}

/** Not yet saved on the server: its row can't be edited until it is. */
export const isPendingTodo = (todo: Todo) => todo.id.startsWith('temp-')

/** Fetches (or joins the request already in flight). Never rejects: errors land in state. */
export function loadTodos(): Promise<void> {
  if (inFlight) return inFlight
  update({ fetching: true, error: snapshot.data ? snapshot.error : null })
  const generation = writeGeneration
  inFlight = api
    .fetchTodos()
    .then(
      (data) => {
        if (generation !== writeGeneration || queues.size > 0) {
          // Read before a local edit landed: keep what's shown, and stay stale.
          update({ fetching: false, fetchedAt: 0 })
          return
        }
        confirmed = new Map(data.map((t) => [t.id, t]))
        update({ data, error: null, fetching: false, fetchedAt: Date.now() })
      },
      (err: unknown) => {
        const error =
          err instanceof TasksError
            ? err
            : new TasksError('unknown', "We couldn't load the team's to-dos.")
        update({ error, fetching: false, ...(error.needsSignIn ? { data: undefined } : {}) })
      },
    )
    .finally(() => {
      inFlight = null
    })
  return inFlight
}

/** Marks the list stale, so the next view refetches it (e.g. after a dashboard write). */
export function invalidateTodos(): void {
  update({ fetchedAt: 0 })
}

/** A copy the server just returned from somewhere else (the dashboard widget). */
export function applyServerTodo(todo: Todo): void {
  if (!confirmed.has(todo.id) || queues.has(todo.id)) return
  confirmed.set(todo.id, todo)
  replace(todo.id, todo)
}

/** Runs `work` after the item's earlier writes, keeping count of what's queued. */
function enqueue<T>(id: string, work: () => Promise<T>): Promise<T> {
  queued.set(id, (queued.get(id) ?? 0) + 1)
  const run = (queues.get(id) ?? Promise.resolve()).then(work, work)
  const tail = run.then(
    () => undefined,
    () => undefined,
  )
  queues.set(id, tail)
  void tail.then(() => {
    const left = (queued.get(id) ?? 1) - 1
    if (left > 0) queued.set(id, left)
    else {
      queued.delete(id)
      if (queues.get(id) === tail) queues.delete(id)
    }
  })
  return run
}

const hasLaterWrites = (id: string) => (queued.get(id) ?? 0) > 1

function reason(err: unknown): string {
  return err instanceof TasksError ? err.message : 'Something went wrong.'
}

/** A refused write: conflicts and deletions reload the list; everything else just says so. */
function reportFailure(err: unknown, what: string): void {
  const code = err instanceof TasksError ? err.code : 'unknown'
  if (code === 'conflict') {
    showToast('error', CONFLICT_MESSAGE)
    void loadTodosAfterWrites()
  } else if (code === 'not-found') {
    showToast('error', GONE_MESSAGE)
    void loadTodosAfterWrites()
  } else {
    showToast('error', `Couldn't ${what}: ${reason(err)}`)
  }
}

async function loadTodosAfterWrites(): Promise<void> {
  await Promise.all(queues.values())
  update({ fetchedAt: 0 })
  await loadTodos()
}

/** Adds a to-do (shown at once). Resolves false, after a toast, if it wasn't saved. */
export async function addTodo(input: NewTodo, login: string): Promise<boolean> {
  const at = new Date().toISOString()
  const temp: Todo = {
    id: `temp-${++tempIds}`,
    ...input,
    done: false,
    createdBy: login,
    createdAt: at,
    updatedBy: login,
    updatedAt: at,
    version: 0,
  }
  mutate((todos) => [...todos, temp])
  try {
    const saved = await api.createTodo(input)
    confirmed.set(saved.id, saved)
    replace(temp.id, saved)
    return true
  } catch (err) {
    replace(temp.id, null)
    showToast('error', `Couldn't add “${input.title}”: ${reason(err)}`)
    return false
  }
}

/**
 * Saves `changes` (only the fields that changed) to the to-do, showing them at once. On
 * failure the item goes back to the server's copy, with a toast; a conflict reloads the list.
 */
export function editTodo(id: string, changes: TodoChanges, login: string): Promise<boolean> {
  const shown = snapshot.data?.find((t) => t.id === id)
  if (!shown || isPendingTodo(shown)) return Promise.resolve(false)
  replace(id, applyChanges(shown, changes, login, new Date()))

  return enqueue(id, async () => {
    const base = confirmed.get(id) ?? shown
    try {
      const saved = await api.updateTodo(id, base.version, changes)
      confirmed.set(id, saved)
      // A later edit is already on screen; it'll bring the final copy when it lands.
      if (!hasLaterWrites(id)) replace(id, saved)
      return true
    } catch (err) {
      const server = confirmed.get(id)
      if (server) replace(id, server)
      reportFailure(err, 'save that change')
      return false
    }
  })
}

/** Deletes the to-do (removed at once; put back, with a toast, if the server refuses). */
export function removeTodo(id: string): Promise<boolean> {
  const shown = snapshot.data?.find((t) => t.id === id)
  if (!shown || isPendingTodo(shown)) return Promise.resolve(false)
  const index = snapshot.data!.indexOf(shown)
  replace(id, null)

  return enqueue(id, async () => {
    const base = confirmed.get(id) ?? shown
    try {
      await api.deleteTodo(id, base.version)
      confirmed.delete(id)
      return true
    } catch (err) {
      const server = confirmed.get(id) ?? shown
      mutate((todos) => [...todos.slice(0, index), server, ...todos.slice(index)])
      reportFailure(err, `delete “${shown.title}”`)
      return false
    }
  })
}

/** For tests. */
export function resetTodosCache(): void {
  snapshot = { data: undefined, error: null, fetching: false, fetchedAt: 0 }
  inFlight = null
  writeGeneration = 0
  confirmed = new Map()
  queues.clear()
  queued.clear()
}

export interface TodosQuery {
  data: Todo[] | undefined
  /** True only until the first result (data or error) arrives. */
  loading: boolean
  /** Set when there's no data to show. A failed background refresh keeps the old data. */
  error: TasksError | null
  refetch: () => void
}

/**
 * The team's to-dos (GET /api/todos, or the mock in sample mode). Pass `enabled: false`
 * while signed out: nothing is fetched. Refetched on mount and focus when older than 30s.
 */
export function useTodos(enabled = true): TodosQuery {
  const current = useSyncExternalStore(subscribe, getSnapshot)

  useEffect(() => {
    if (!enabled) return
    if (isStale()) void loadTodos()
    const revalidate = () => {
      if (document.visibilityState === 'visible' && isStale()) void loadTodos()
    }
    window.addEventListener('focus', revalidate)
    document.addEventListener('visibilitychange', revalidate)
    return () => {
      window.removeEventListener('focus', revalidate)
      document.removeEventListener('visibilitychange', revalidate)
    }
  }, [enabled])

  const refetch = useCallback(() => void loadTodos(), [])

  if (!enabled) return { data: undefined, loading: false, error: null, refetch }
  const { data, error } = current
  return { data, loading: !data && !error, error: data ? null : error, refetch }
}
