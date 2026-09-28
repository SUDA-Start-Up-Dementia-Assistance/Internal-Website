import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { TASKS_MOCK } from '../../config/tasks'
import { enableSampleMode } from '../sampleMode'
import { showToast } from '../toast'
import { fetchMe, loginUrl, submitLogout, type MeResult } from './api'
import { AuthContext } from './context'
import { MOCK_USER } from './mock'
import { onSessionExpired, SESSION_EXPIRED_MESSAGE } from './sessionEvents'

type Status = MeResult & { loading: boolean; sessionExpired: boolean }

const INITIAL: Status = TASKS_MOCK
  ? { user: MOCK_USER, authAvailable: true, preview: false, loading: false, sessionExpired: false }
  : { user: null, authAvailable: false, preview: false, loading: true, sessionExpired: false }

/** Loads the signed-in user once (GET /api/auth/me) and shares it with the whole app. */
export default function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>(INITIAL)

  useEffect(() => {
    if (TASKS_MOCK) return
    let cancelled = false
    fetchMe().then((me) => {
      if (cancelled) return
      // No sign-in on this deployment (a preview): browse the Tasks UI on sample data.
      if (me.preview) enableSampleMode()
      setStatus({
        ...me,
        user: me.preview ? MOCK_USER : me.user,
        loading: false,
        sessionExpired: false,
      })
    })
    return () => {
      cancelled = true
    }
  }, [])

  // Any API call that finds the session dead signs the user out here.
  useEffect(
    () =>
      onSessionExpired(() =>
        setStatus((s) => (s.user ? { ...s, user: null, sessionExpired: true } : s)),
      ),
    [],
  )

  // The Tasks page explains it in place; everywhere else, a toast does.
  useEffect(() => {
    if (status.sessionExpired && !window.location.pathname.startsWith('/tasks')) {
      showToast('error', SESSION_EXPIRED_MESSAGE)
    }
  }, [status.sessionExpired])

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
