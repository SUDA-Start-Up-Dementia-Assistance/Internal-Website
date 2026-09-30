import { REQUIRED_REVIEWERS } from '../../config/process'
import { MOCK_USER } from '../auth/mock'
import { businessDaysInclusive, isPastSla } from '../businessTime'
import { isUpcoming } from '../meetings'
import { mockMeetings } from '../meetingsMock'
import { addDaysToDateKey, zonedDateKey } from '../teamTime'
import { TasksError } from '../tasks/api'
import { addDaysKey, isBlocked, isOverdue, selectMine } from '../tasks/selectors'
import type { Task } from '../tasks/types'
import { loadTasks, peekTasks } from '../tasks/useTasks'
import { selectDashboardTodos } from '../todos/selectors'
import { mockTodosApi } from '../todos/mock'
import type { DashboardPr, DashboardResponse, MyPr, MyTasks, ReviewQueuePr } from './types'

/*
 * Fake /api/dashboard for sample mode (VITE_TASKS_MOCK=true, or a preview deployment). Tasks
 * come from the shared sample tasks cache, so "Mark done" here shows up on /tasks too. PRs
 * cover: an overdue review, a PR without a demo video, failing CI, a draft that targets main
 * directly, and changes requested.
 */

const HOUR_MS = 3_600_000
const LIMIT = 5

function pr(fields: Partial<DashboardPr> & Pick<DashboardPr, 'id' | 'title' | 'number'>) {
  const repo = fields.repo ?? 'dawn-team/dawn-app'
  return {
    repo,
    url: `https://github.com/${repo}/pull/${fields.number}`,
    author: 'river-b',
    authorAvatarUrl: null,
    isDraft: false,
    createdAt: new Date(Date.now() - 30 * HOUR_MS).toISOString(),
    baseRefName: 'canary',
    headRefName: 'feature/sample',
    requestedReviewers: [],
    reviews: [],
    reviewerCount: 2,
    requiredReviewers: REQUIRED_REVIEWERS,
    hasDemoVideo: true,
    ciState: 'SUCCESS',
    targetsCorrectBase: true,
    ...fields,
  } satisfies DashboardPr
}

function reviewQueue(now: Date): ReviewQueuePr[] {
  const queued = (fields: Parameters<typeof pr>[0], waitingHours: number): ReviewQueuePr => {
    const waitingSince = new Date(now.getTime() - waitingHours * HOUR_MS).toISOString()
    return { ...pr(fields), waitingSince, isPastSla: isPastSla(new Date(waitingSince), now) }
  }
  return [
    // Four calendar days: past the one-business-day SLA whatever today is.
    queued(
      {
        id: 'PR_mock_review1',
        title: 'Morning routine: large-type clock face',
        number: 58,
        author: 'priya-n',
        headRefName: 'feature/large-clock',
        reviewerCount: 1,
        requestedReviewers: [MOCK_USER.login],
      },
      96,
    ),
    queued(
      {
        id: 'PR_mock_review2',
        title: 'Read the day’s schedule aloud',
        number: 61,
        author: 'sam-k',
        headRefName: 'feature/tts-schedule',
        hasDemoVideo: false,
        ciState: 'PENDING',
      },
      3,
    ),
  ]
}

function myPrs(): MyPr[] {
  return [
    {
      ...pr({
        id: 'PR_mock_mine1',
        title: 'Weather card: high-contrast icons',
        number: 63,
        author: MOCK_USER.login,
        headRefName: 'feature/weather-contrast',
        hasDemoVideo: false,
        ciState: 'FAILURE',
      }),
      reviewsApproved: 1,
      changesRequested: 0,
    },
    {
      ...pr({
        id: 'PR_mock_mine2',
        title: 'Spike: caregiver photo carousel',
        number: 64,
        author: MOCK_USER.login,
        isDraft: true,
        headRefName: 'spike/photo-carousel',
        baseRefName: 'main',
        targetsCorrectBase: false,
        reviewerCount: 1,
        ciState: null,
      }),
      reviewsApproved: 0,
      changesRequested: 1,
    },
    {
      ...pr({
        id: 'PR_mock_mine3',
        title: 'Release: canary → main',
        number: 65,
        author: MOCK_USER.login,
        headRefName: 'canary',
        baseRefName: 'main',
      }),
      reviewsApproved: 2,
      changesRequested: 0,
    },
  ]
}

function myTasks(tasks: Task[], statuses: MyTasks['statuses'], today: Date): MyTasks {
  const mine = selectMine(tasks, MOCK_USER.login).filter((t) => t.statusKey !== 'done')
  const todayKey = addDaysKey(today, 0)
  const weekEnd = addDaysKey(today, 6)
  const groups = {
    overdue: mine.filter((t) => isOverdue(t, today)),
    dueThisWeek: mine.filter((t) => !!t.doneBy && t.doneBy >= todayKey && t.doneBy <= weekEnd),
    blocked: mine.filter(isBlocked),
    inProgress: mine.filter((t) => t.statusKey === 'inProgress'),
  }
  const byDate = (a: Task, b: Task) => (a.doneBy ?? '~').localeCompare(b.doneBy ?? '~')
  const top = (list: Task[]) => [...list].sort(byDate).slice(0, LIMIT)
  return {
    overdue: top(groups.overdue),
    dueThisWeek: top(groups.dueThisWeek),
    blocked: top(groups.blocked),
    inProgress: top(groups.inProgress),
    counts: {
      overdue: groups.overdue.length,
      dueThisWeek: groups.dueThisWeek.length,
      blocked: groups.blocked.length,
      inProgress: groups.inProgress.length,
      open: mine.length,
    },
    hiddenCount: 0,
    statuses,
  }
}

export async function mockDashboard(now = new Date()): Promise<DashboardResponse> {
  await loadTasks()
  await new Promise((resolve) => setTimeout(resolve, 300))
  const data = peekTasks()
  if (!data) throw new TasksError('unknown', "The sample tasks didn't load.")
  const { meta, tasks } = data

  const today = zonedDateKey(now)
  const iteration = meta.iterations.find((i) => i.id === meta.currentIterationId)
  let sprint: DashboardResponse['sprint'] = null
  if (iteration) {
    const endDate = addDaysToDateKey(iteration.startDate, iteration.duration - 1)
    let scope = 0
    let done = 0
    let unestimatedCount = 0
    for (const t of tasks) {
      if (t.iteration?.id !== iteration.id) continue
      if (t.estimateHours === undefined) unestimatedCount += 1
      else {
        scope += t.estimateHours
        if (t.statusKey === 'done') done += t.estimateHours
      }
    }
    sprint = {
      id: iteration.id,
      title: iteration.title,
      startDate: iteration.startDate,
      endDate,
      daysLeft: businessDaysInclusive(today, endDate),
      burndown: {
        unit: 'estimateHours',
        scope,
        done,
        remaining: scope - done,
        unestimatedCount,
      },
    }
  }

  const calendar = mockMeetings(today, addDaysToDateKey(today, 14), now)
  return {
    me: MOCK_USER,
    sprint,
    tasks: myTasks(tasks, meta.statuses, now),
    reviewQueue: reviewQueue(now),
    myPrs: myPrs(),
    meetings: {
      connected: true,
      meetings: calendar.meetings.filter((m) => isUpcoming(m, now)).slice(0, LIMIT),
    },
    // The same in-memory to-dos as /tasks, so a check-off here shows up there too.
    todos: {
      ...selectDashboardTodos(await mockTodosApi.list(now), MOCK_USER.login, today),
      people: data.team.map(({ login, name, avatarUrl }) => ({ login, name, avatarUrl })),
    },
    generatedAt: now.toISOString(),
  }
}
