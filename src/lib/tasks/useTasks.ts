import { useCallback, useEffect, useSyncExternalStore } from 'react'
import { TASKS_MOCK } from '../../config/tasks'
import { fetchTasks, TasksError } from './api'
import { createMockTasks } from './mock'
import type { TasksResponse } from './types'

/** Data older than this is refetched when the window regains focus (or a view mounts). */
export const STALE_AFTER_MS = 60_000

interface Snapshot {
  data: TasksResponse | undefined
  error: TasksError | null
  /** A request is in flight (possibly a background refresh of data already shown). */
  fetching: boolean
  fetchedAt: number
}

/*
 * One in-memory cache for the whole app, so the Home card and the Tasks page share a single
 * request. It lives only as long as the tab: signing out reloads the page, which clears it.
 */
let snapshot: Snapshot = { data: undefined, error: null, fetching: false, fetchedAt: 0 }
let inFlight: Promise<void> | null = null
/** Bumped by every local write, so a read that started before it can't undo it on screen. */
let writeGeneration = 0
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

/** The cached tasks response, if loaded. */
export function peekTasks(): TasksResponse | undefined {
  return snapshot.data
}

/**
 * Rewrites the cached response in place (for optimistic writes). A no-op until data has
 * loaded. Doesn't touch fetchedAt: an edit isn't a fresh read from GitHub.
 */
export function mutateTasks(fn: (data: TasksResponse) => TasksResponse): void {
  if (!snapshot.data) return
  writeGeneration += 1
  update({ data: fn(snapshot.data) })
}

function isStale(now = Date.now()): boolean {
  return !snapshot.data || now - snapshot.fetchedAt > STALE_AFTER_MS
}

// Mock writes only live in memory, so a mock "refetch" keeps them.
const load = TASKS_MOCK ? () => Promise.resolve(snapshot.data ?? createMockTasks()) : fetchTasks

/** Fetches (or joins the request already in flight). Never rejects: errors land in state. */
export function loadTasks(): Promise<void> {
  if (inFlight) return inFlight
  // Keep showing data we already have; only a first load clears an old error.
  update({ fetching: true, error: snapshot.data ? snapshot.error : null })
  const generation = writeGeneration
  inFlight = load()
    .then(
      (data) =>
        generation === writeGeneration
          ? update({ data, error: null, fetching: false, fetchedAt: Date.now() })
          : // Read before a local edit landed: keep what's shown, and stay stale so the next
            // focus or mount reads again.
            update({ fetching: false }),
      (err: unknown) => {
        const error =
          err instanceof TasksError ? err : new TasksError('unknown', "We couldn't load tasks.")
        // A dead session means the data isn't ours to show anymore.
        update({ error, fetching: false, ...(error.needsSignIn ? { data: undefined } : {}) })
      },
    )
    .finally(() => {
      inFlight = null
    })
  return inFlight
}

/** For tests. */
export function resetTasksCache(): void {
  snapshot = { data: undefined, error: null, fetching: false, fetchedAt: 0 }
  inFlight = null
  writeGeneration = 0
}

export interface TasksQuery {
  data: TasksResponse | undefined
  /** True only until the first result (data or error) arrives. */
  loading: boolean
  /** Set when there's no data to show. A failed background refresh keeps the old data. */
  error: TasksError | null
  refetch: () => void
}

/**
 * Tasks, meta, and team from /api/tasks (or the mock). Pass `enabled: false` while signed
 * out: nothing is fetched. Data is refetched when a view mounts or the window regains focus,
 * if it's older than 60 seconds.
 */
export function useTasks(enabled = true): TasksQuery {
  const current = useSyncExternalStore(subscribe, getSnapshot)

  useEffect(() => {
    if (!enabled) return
    if (isStale()) void loadTasks()

    const revalidate = () => {
      if (document.visibilityState === 'visible' && isStale()) void loadTasks()
    }
    window.addEventListener('focus', revalidate)
    document.addEventListener('visibilitychange', revalidate)
    return () => {
      window.removeEventListener('focus', revalidate)
      document.removeEventListener('visibilitychange', revalidate)
    }
  }, [enabled])

  const refetch = useCallback(() => void loadTasks(), [])

  if (!enabled) return { data: undefined, loading: false, error: null, refetch }
  const { data, error } = current
  return {
    data,
    loading: !data && !error,
    error: data ? null : error,
    refetch,
  }
}
