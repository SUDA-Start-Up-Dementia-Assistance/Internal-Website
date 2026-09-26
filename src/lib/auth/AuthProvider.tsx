import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { TASKS_MOCK } from '../../config/tasks'
import { fetchMe, loginUrl, submitLogout, type MeResult } from './api'
import { AuthContext } from './context'
import { MOCK_USER } from './mock'

type Status = MeResult & { loading: boolean }

const INITIAL: Status = TASKS_MOCK
  ? { user: MOCK_USER, authAvailable: true, loading: false }
  : { user: null, authAvailable: false, loading: true }

/** Loads the signed-in user once (GET /api/auth/me) and shares it with the whole app. */
export default function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>(INITIAL)

  useEffect(() => {
    if (TASKS_MOCK) return
    let cancelled = false
    fetchMe().then((me) => {
      if (!cancelled) setStatus({ ...me, loading: false })
    })
    return () => {
      cancelled = true
    }
  }, [])

  const signIn = useCallback((returnTo?: string) => {
    if (TASKS_MOCK) return setStatus((s) => ({ ...s, user: MOCK_USER }))
    window.location.assign(loginUrl(returnTo))
  }, [])

  const signOut = useCallback(() => {
    if (TASKS_MOCK) return setStatus((s) => ({ ...s, user: null }))
    submitLogout()
  }, [])

  const value = useMemo(() => ({ ...status, signIn, signOut }), [status, signIn, signOut])
  return <AuthContext value={value}>{children}</AuthContext>
}
