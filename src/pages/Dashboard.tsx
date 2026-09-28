import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import DashboardHeader from '../components/dashboard/DashboardHeader'
import MeetingsWidget from '../components/dashboard/MeetingsWidget'
import MyPrsWidget from '../components/dashboard/MyPrsWidget'
import MyTasksWidget from '../components/dashboard/MyTasksWidget'
import ReviewQueueWidget from '../components/dashboard/ReviewQueueWidget'
import SprintCard from '../components/dashboard/SprintCard'
import ErrorState from '../components/ErrorState'
import LoadingState from '../components/LoadingState'
import PageTitle from '../components/PageTitle'
import Skeleton from '../components/Skeleton'
import PreviewBanner from '../components/tasks/PreviewBanner'
import { useAuth, type AuthUser } from '../lib/auth'
import { useDashboard } from '../lib/dashboard'

/** Where signed-out visitors go: the Tasks sign-in panel, returning here afterwards. */
const SIGN_IN = `/tasks?returnTo=${encodeURIComponent('/dashboard')}`

/** The developer dashboard (signed-in only). */
export default function Dashboard() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <Page>
        <LoadingState>
          <Skeleton className="h-10 w-80 max-w-full" />
          <Skeleton className="mt-6 h-6 w-64" />
        </LoadingState>
      </Page>
    )
  }
  if (!user) return <Navigate to={SIGN_IN} replace />
  return (
    <Page>
      <SignedInDashboard user={user} />
    </Page>
  )
}

function Page({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-5xl px-6 py-10 sm:py-14">
      <PageTitle title="Dashboard" />
      {children}
    </div>
  )
}

/** The current time, ticking every 30 seconds ("Updated 2 min ago", "Happening now"). */
function useNow(intervalMs = 30_000): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}

function SignedInDashboard({ user }: { user: AuthUser }) {
  const query = useDashboard()
  const now = useNow()

  return (
    <div className="space-y-8">
      <PreviewBanner />
      <DashboardHeader user={user} query={query} now={now} />
      {query.error ? (
        <div className="rounded-2xl bg-surface p-6 shadow-card">
          <ErrorState message={query.error.message} onRetry={query.refetch} />
        </div>
      ) : (
        // Two columns on large screens. The DOM order is the phone order: sprint, tasks,
        // meetings, reviews, my PRs.
        <div className="grid items-start gap-6 lg:grid-cols-2">
          <div className="grid gap-6">
            <SprintCard query={query} now={now} />
            <MyTasksWidget query={query} now={now} />
          </div>
          <div className="grid gap-6">
            <MeetingsWidget query={query} now={now} />
            <ReviewQueueWidget query={query} now={now} />
            <MyPrsWidget query={query} />
          </div>
        </div>
      )}
    </div>
  )
}
