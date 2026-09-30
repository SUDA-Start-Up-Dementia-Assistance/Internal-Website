import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { zonedInstant } from '../../src/lib/teamTime.js'
import {
  clearDashboardCache,
  getDashboard,
  groupMyTasks,
  isWidgetError,
  type DashboardContext,
  type DashboardSources,
} from './dashboard.js'
import type { Meeting } from './google/calendar.js'
import { GitHubApiError } from './github/errors.js'
import type { ProjectMeta } from './github/project.js'
import type { MyPr, ReviewQueuePr } from './github/pulls.js'
import type { Task } from './github/types.js'
import type { Todo } from './todos.js'

// Wednesday 2026-09-30, 10am Eastern.
const NOW = zonedInstant('2026-09-30', 10)
const TODAY = '2026-09-30'

function task(overrides: Partial<Task>): Task {
  return {
    itemId: overrides.title ?? 't',
    contentId: 'c',
    kind: 'issue',
    title: 't',
    assignees: [{ login: 'ada', avatarUrl: '' }],
    status: 'In progress',
    statusKey: 'inProgress',
    updatedAt: '2026-09-01T00:00:00Z',
    ...overrides,
  }
}

const SPRINT = { id: 'I_4', title: 'Sprint 4', startDate: '2026-09-28', duration: 14 }

const META = {
  iteration: { iterations: [SPRINT] },
} as unknown as ProjectMeta

function meeting(id: string, start: string, end: string): Meeting {
  return {
    id,
    title: id,
    start,
    end,
    allDay: false,
    kind: 'adhoc',
    recurring: false,
    htmlLink: 'https://calendar.google.com/',
  }
}

function sources(overrides: Partial<DashboardSources> = {}): DashboardSources {
  return {
    projectMeta: vi.fn(async () => META),
    items: vi.fn(async () => ({
      tasks: [
        task({ title: 'late', doneBy: '2026-09-29', estimateHours: 3, iteration: SPRINT }),
        task({ title: 'soon', doneBy: '2026-10-02', estimateHours: 5, iteration: SPRINT }),
        task({
          title: 'done',
          statusKey: 'done',
          status: 'Done',
          estimateHours: 2,
          iteration: SPRINT,
        }),
        task({ title: 'not mine', assignees: [{ login: 'grace', avatarUrl: '' }] }),
      ],
      hiddenCount: 1,
    })),
    reviewQueue: vi.fn(async () => [] as ReviewQueuePr[]),
    myPrs: vi.fn(async () => [] as MyPr[]),
    meetings: vi.fn(async () => [] as Meeting[]),
    todos: vi.fn(async () => [] as Todo[]),
    team: vi.fn(async () => [
      { login: 'ada', name: 'Ada Lovelace', avatarUrl: '' },
      { login: 'grace', name: 'Grace Hopper', avatarUrl: '' },
      { login: 'alan', name: 'Alan Turing', avatarUrl: '' },
    ]),
    ...overrides,
  }
}

const ctx = (login = 'ada', now = NOW): DashboardContext => ({
  token: `token-${login}`,
  user: { login, name: login, avatarUrl: '' },
  org: 'dawn',
  now,
})

beforeEach(() => {
  clearDashboardCache()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('getDashboard', () => {
  it('returns every widget', async () => {
    const res = await getDashboard(ctx(), sources())
    expect(res.me.login).toBe('ada')
    expect(res.generatedAt).toBe(NOW.toISOString())
    expect(res.sprint).toEqual({
      id: 'I_4',
      title: 'Sprint 4',
      startDate: '2026-09-28',
      endDate: '2026-10-11',
      // Wed 9/30 – Fri 10/2 (3) + Mon 10/5 – Fri 10/9 (5).
      daysLeft: 8,
      burndown: { unit: 'estimateHours', scope: 10, done: 2, remaining: 8, unestimatedCount: 0 },
    })
    expect(res.tasks).toMatchObject({
      counts: { overdue: 1, dueThisWeek: 1, blocked: 0, inProgress: 2, open: 2 },
      hiddenCount: 1,
    })
    expect(res.reviewQueue).toEqual([])
    expect(res.myPrs).toEqual([])
    expect(res.meetings).toEqual({ connected: true, meetings: [] })
  })

  it('includes the status options (with colors), or [] when meta fails', async () => {
    const meta = {
      ...META,
      projectUrl: 'https://github.com/orgs/dawn/projects/1',
      repositories: [],
      status: {
        id: 'F_status',
        options: [
          { id: 'S_ip', name: 'In progress', color: 'YELLOW' },
          { id: 'S_done', name: 'Done', color: 'ORANGE' },
        ],
      },
    } as unknown as ProjectMeta
    const res = await getDashboard(ctx(), sources({ projectMeta: vi.fn(async () => meta) }))
    expect(res.tasks).toMatchObject({
      statuses: [
        { id: 'S_ip', name: 'In progress', key: 'inProgress', color: 'YELLOW' },
        { id: 'S_done', name: 'Done', key: 'done', color: 'ORANGE' },
      ],
    })

    clearDashboardCache()
    const failed = await getDashboard(
      ctx(),
      sources({
        projectMeta: vi.fn(async () => {
          throw new Error('meta down')
        }),
      }),
    )
    expect(failed.tasks).toMatchObject({ statuses: [], counts: { open: 2 } })
  })

  it('isolates widgets: a failing source only fails its own widget', async () => {
    const res = await getDashboard(
      ctx(),
      sources({
        reviewQueue: vi.fn(async () => {
          throw new GitHubApiError('rate-limited', 403, 'secret detail')
        }),
        meetings: vi.fn(async () => {
          throw new Error('boom: internal detail')
        }),
      }),
    )
    expect(res.reviewQueue).toEqual({
      error: { code: 'rate-limited', message: expect.stringMatching(/rate limit/) },
    })
    expect(res.meetings).toEqual({ error: { code: 'internal', message: expect.any(String) } })
    expect(JSON.stringify(res)).not.toMatch(/secret detail|internal detail/)
    // Everything else still returned.
    expect(isWidgetError(res.sprint)).toBe(false)
    expect(isWidgetError(res.tasks)).toBe(false)
    expect(res.myPrs).toEqual([])
  })

  it('keeps the sprint header when only the task list fails (burndown becomes null)', async () => {
    const res = await getDashboard(
      ctx(),
      sources({
        items: vi.fn(async () => {
          throw new GitHubApiError('upstream', 502)
        }),
      }),
    )
    expect(res.sprint).toMatchObject({ title: 'Sprint 4', burndown: null })
    expect(res.tasks).toMatchObject({ error: { code: 'github-unavailable' } })
  })

  it('rethrows a dead GitHub session instead of hiding it in a widget', async () => {
    const expired = new GitHubApiError('session-expired', 401)
    await expect(
      getDashboard(ctx(), sources({ myPrs: vi.fn(async () => Promise.reject(expired)) })),
    ).rejects.toBe(expired)
  })

  it('says the calendar is not connected', async () => {
    const res = await getDashboard(ctx(), sources({ meetings: vi.fn(async () => null) }))
    expect(res.meetings).toEqual({ connected: false, meetings: [] })
  })

  it('shows the next 5 meetings that have not ended, within 14 days', async () => {
    const list = [
      meeting('ended', '2026-09-30T08:00:00-04:00', '2026-09-30T09:00:00-04:00'),
      meeting('in-progress', '2026-09-30T09:30:00-04:00', '2026-09-30T10:30:00-04:00'),
      ...[1, 2, 3, 4, 5].map((d) =>
        meeting(`m${d}`, `2026-10-0${d}T17:00:00-04:00`, `2026-10-0${d}T18:00:00-04:00`),
      ),
    ]
    const meetingsSource = vi.fn(async () => list)
    const res = await getDashboard(ctx(), sources({ meetings: meetingsSource }))
    expect(meetingsSource).toHaveBeenCalledWith('2026-09-30', '2026-10-14')
    expect(res.meetings).toMatchObject({
      meetings: ['in-progress', 'm1', 'm2', 'm3', 'm4'].map((id) => ({ id })),
    })
  })
})

describe('per-user cache', () => {
  it('keeps each user’s dashboard separate and reuses it for 60 seconds', async () => {
    const reviewQueue = vi.fn(async (_token: string, _org: string, login: string) => [
      { id: `pr-for-${login}` } as ReviewQueuePr,
    ])
    const src = sources({ reviewQueue })

    const ada = await getDashboard(ctx('ada'), src)
    const grace = await getDashboard(ctx('grace'), src)
    expect(ada.me.login).toBe('ada')
    expect(grace.me.login).toBe('grace')
    expect(ada.reviewQueue).toEqual([{ id: 'pr-for-ada' }])
    expect(grace.reviewQueue).toEqual([{ id: 'pr-for-grace' }])
    expect(reviewQueue).toHaveBeenCalledTimes(2)
    // Each user's token was used for their own data only.
    expect(reviewQueue.mock.calls.map(([token]) => token)).toEqual(['token-ada', 'token-grace'])

    // Within 60s: cached per user (login is case-insensitive).
    const again = await getDashboard(ctx('ADA', new Date(NOW.getTime() + 59_000)), src)
    expect(again.reviewQueue).toEqual([{ id: 'pr-for-ada' }])
    expect(reviewQueue).toHaveBeenCalledTimes(2)

    // After 60s: refetched.
    await getDashboard(ctx('ada', new Date(NOW.getTime() + 61_000)), src)
    expect(reviewQueue).toHaveBeenCalledTimes(3)
  })

  it('does not cache a response with a failed widget', async () => {
    const myPrs = vi
      .fn<DashboardSources['myPrs']>()
      .mockRejectedValueOnce(new GitHubApiError('upstream', 502))
      .mockResolvedValue([])
    const src = sources({ myPrs })
    expect(isWidgetError((await getDashboard(ctx(), src)).myPrs)).toBe(true)
    expect((await getDashboard(ctx(), src)).myPrs).toEqual([])
  })
})

describe('groupMyTasks', () => {
  it('groups my open tasks, up to 5 each, soonest first', () => {
    const tasks = [
      ...Array.from({ length: 7 }, (_, i) =>
        task({
          title: `late ${i}`,
          doneBy: `2026-09-2${i}`,
          statusKey: 'blocked',
          status: 'Blocked',
        }),
      ),
      task({ title: 'due today', doneBy: TODAY }),
      task({ title: 'due in 6 days', doneBy: '2026-10-06' }),
      task({ title: 'due in 7 days', doneBy: '2026-10-07' }),
      task({ title: 'no date P0', priority: 'P0' }),
      task({ title: 'done late', doneBy: '2026-09-01', statusKey: 'done', status: 'Done' }),
      task({
        title: 'Ada caps',
        doneBy: '2026-09-29',
        assignees: [{ login: 'ADA', avatarUrl: '' }],
      }),
    ]
    const groups = groupMyTasks({ tasks, hiddenCount: 0 }, 'ada', TODAY)
    expect(groups.counts).toEqual({
      overdue: 8,
      dueThisWeek: 2,
      blocked: 7,
      inProgress: 5,
      open: 12,
    })
    expect(groups.overdue.map((t) => t.title)).toEqual([
      'late 0',
      'late 1',
      'late 2',
      'late 3',
      'late 4',
    ])
    expect(groups.dueThisWeek.map((t) => t.title)).toEqual(['due today', 'due in 6 days'])
    expect(groups.blocked).toHaveLength(5)
    expect(groups.inProgress.map((t) => t.title)).toEqual([
      'Ada caps',
      'due today',
      'due in 6 days',
      'due in 7 days',
      'no date P0',
    ])
  })
})

describe('todos widget', () => {
  let n = 0
  function todo(overrides: Partial<Todo>): Todo {
    n += 1
    return {
      id: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
      title: `todo ${n}`,
      done: false,
      assignees: [],
      createdBy: 'grace',
      createdAt: `2026-09-${String(n).padStart(2, '0')}T12:00:00Z`,
      updatedBy: 'grace',
      updatedAt: '2026-09-20T12:00:00Z',
      version: 1,
      ...overrides,
    }
  }

  it('shows every open team to-do, whoever it’s assigned to, soonest due first, max 5', async () => {
    const todos = [
      todo({ title: 'grace, overdue', assignees: ['grace'], dueDate: '2026-09-01' }),
      todo({ title: 'grace, due today', assignees: ['grace'], dueDate: TODAY }),
      todo({ title: 'mine, overdue', assignees: ['ADA'], dueDate: '2026-09-28' }),
      todo({ title: 'unassigned, no date' }),
      todo({ title: 'done', assignees: ['ada'], dueDate: '2026-09-02', done: true }),
      todo({ title: 'mine, due today', assignees: ['ada'], dueDate: TODAY }),
      todo({ title: 'unassigned, overdue', dueDate: '2026-09-29' }),
    ]
    const res = await getDashboard(ctx(), sources({ todos: vi.fn(async () => todos) }))
    if (isWidgetError(res.todos)) throw new Error('todos failed')
    expect(res.todos.items.map((t) => t.title)).toEqual([
      'grace, overdue',
      'mine, overdue',
      'unassigned, overdue',
      // Same due date: the older one first.
      'grace, due today',
      'mine, due today',
    ])
    expect(res.todos.counts).toEqual({
      open: 6,
      overdue: 3,
      // Grace's overdue to-do isn't waiting on Ada.
      overdueForMe: 2,
      mine: 2,
      everyone: 2,
      others: 2,
    })
    // Names for the people listed, and only them.
    expect(res.todos.people).toEqual([
      { login: 'ada', name: 'Ada Lovelace', avatarUrl: '' },
      { login: 'grace', name: 'Grace Hopper', avatarUrl: '' },
    ])
  })

  it('still lists to-dos (without names) when the team list fails', async () => {
    const res = await getDashboard(
      ctx(),
      sources({
        todos: vi.fn(async () => [todo({ title: 'grace', assignees: ['grace'] })]),
        team: vi.fn(async () => {
          throw new Error('github down')
        }),
      }),
    )
    if (isWidgetError(res.todos)) throw new Error('todos failed')
    expect(res.todos.items).toHaveLength(1)
    expect(res.todos.people).toEqual([])
  })

  it('sorts by due date regardless of assignee (no date last)', async () => {
    const todos = [
      todo({ title: 'mine, no date', assignees: ['ada'] }),
      todo({ title: 'unassigned, due 10/05', dueDate: '2026-10-05' }),
      todo({ title: 'someone else', assignees: ['grace'], dueDate: '2026-09-01' }),
      todo({ title: 'mine, overdue', assignees: ['ADA'], dueDate: '2026-09-28' }),
      todo({ title: 'done', assignees: ['ada'], dueDate: '2026-09-02', done: true }),
      todo({ title: 'unassigned, no date' }),
      todo({ title: 'mine, due today', assignees: ['ada'], dueDate: TODAY }),
      todo({ title: 'unassigned, due 10/20', dueDate: '2026-10-20' }),
    ]
    const res = await getDashboard(ctx(), sources({ todos: vi.fn(async () => todos) }))
    expect(isWidgetError(res.todos)).toBe(false)
    if (isWidgetError(res.todos)) return
    expect(res.todos.items.map((t) => t.title)).toEqual([
      'someone else',
      'mine, overdue',
      'mine, due today',
      'unassigned, due 10/05',
      'unassigned, due 10/20',
    ])
  })

  it('is isolated: a Blob failure only fails the todos widget', async () => {
    const res = await getDashboard(
      ctx(),
      sources({
        todos: vi.fn(async () => {
          throw new Error('blob down')
        }),
      }),
    )
    expect(isWidgetError(res.todos)).toBe(true)
    expect(isWidgetError(res.tasks)).toBe(false)
    expect(isWidgetError(res.meetings)).toBe(false)
  })
})
