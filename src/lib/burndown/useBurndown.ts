import { useCallback, useEffect, useState } from 'react'
import { TASKS_MOCK } from '../../config/tasks'
import { TasksError } from '../tasks/api'
import { fetchBurndown } from './api'
import { mockBurndown } from './mock'
import type { BurndownResponse } from './types'

const load = TASKS_MOCK ? mockBurndown : fetchBurndown

export interface BurndownQuery {
  /** The last loaded response; kept while a different sprint loads. */
  data: BurndownResponse | undefined
  loading: boolean
  error: TasksError | null
  refetch: () => void
}

/**
 * The burndown for `iterationId` (undefined = the current sprint). Loading it for the
 * current sprint also records today's snapshot on the server.
 */
export function useBurndown(iterationId: string | undefined): BurndownQuery {
  const [attempt, setAttempt] = useState(0)
  const key = `${iterationId ?? ''}#${attempt}`
  // The latest settled request. Loading = it isn't the one we're asking for now.
  const [settled, setSettled] = useState<{
    key: string
    data?: BurndownResponse
    error: TasksError | null
  }>()

  useEffect(() => {
    let cancelled = false
    load(iterationId).then(
      (data) => {
        if (!cancelled) setSettled({ key, data, error: null })
      },
      (err: unknown) => {
        if (cancelled) return
        const error =
          err instanceof TasksError
            ? err
            : new TasksError('unknown', "We couldn't load the sprint burndown right now.")
        // Keep the last good data (the frame) behind the error.
        setSettled((prev) => ({ key, data: prev?.data, error }))
      },
    )
    return () => {
      cancelled = true
    }
  }, [iterationId, key])

  const refetch = useCallback(() => setAttempt((n) => n + 1), [])
  const loading = settled?.key !== key
  return {
    data: settled?.data,
    loading,
    error: loading ? null : (settled?.error ?? null),
    refetch,
  }
}
