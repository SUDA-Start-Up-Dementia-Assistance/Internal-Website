import { describe, expect, it } from 'vitest'
import type { Task } from '../tasks/types'
import type { Todo } from '../todos/types'
import { isAllCaughtUp, todoCounts, waitingCounts } from './summary'
import type { DashboardResponse, MyPr, MyTasks, ReviewQueuePr, TodosWidget } from './types'
import { applyOverrides } from './useDashboard'

const task = (itemId: string, fields: Partial<Task> = {}): Task => ({
  itemId,
  contentId: itemId,
  kind: 'issue',
  title: itemId,
  assignees: [],
  status: 'In progress',
  statusKey: 'inProgress',
  updatedAt: '2026-09-01T00:00:00Z',
  ...fields,
})

function tasks(fields: Partial<MyTasks> = {}): MyTasks {
  return {
    overdue: [],
    dueThisWeek: [],
    blocked: [],
    inProgress: [],
    counts: { overdue: 0, dueThisWeek: 0, blocked: 0, inProgress: 0, open: 0 },
    hiddenCount: 0,
    statuses: [],
    ...fields,
  }
}

function response(fields: Partial<DashboardResponse> = {}): DashboardResponse {
  return {
    me: { login: 'ada', name: 'Ada', avatarUrl: '' },
    sprint: null,
    tasks: tasks(),
    reviewQueue: [],
    myPrs: [],
    meetings: { connected: true, meetings: [] },
    todos: {
      items: [],
      counts: { open: 0, overdue: 0, overdueForMe: 0, mine: 0, everyone: 0, others: 0 },
      people: [],
    },
    generatedAt: '2026-09-30T14:00:00.000Z',
    ...fields,
  }
}

describe('waitingCounts', () => {
  it('is all caught up only when every count is known and zero', () => {
    expect(isAllCaughtUp(waitingCounts(response()))).toBe(true)
    const failed = response({ reviewQueue: { error: { code: 'internal', message: 'x' } } })
    expect(waitingCounts(failed).reviews).toBeNull()
    expect(isAllCaughtUp(waitingCounts(failed))).toBe(false)
  })

  it('counts reviews, overdue and blocked tasks, and PRs with failing CI', () => {
    const counts = waitingCounts(
      response({
        reviewQueue: [{}, {}] as ReviewQueuePr[],
        myPrs: [{ ciState: 'FAILURE' }, { ciState: 'SUCCESS' }, { ciState: null }] as MyPr[],
        tasks: tasks({
          overdue: [task('a'), task('b', { statusKey: 'done', status: 'Done' })],
          blocked: [task('c', { statusKey: 'blocked' })],
          counts: { overdue: 7, dueThisWeek: 0, blocked: 1, inProgress: 0, open: 8 },
        }),
      }),
    )
    // 7 overdue on the server, one of the listed ones since checked off here.
    expect(counts).toEqual({ reviews: 2, overdue: 6, blocked: 1, failingCi: 1, overdueTodos: 0 })
  })
})

describe('to-do counts', () => {
  const todo = (id: string, fields: Partial<Todo> = {}): Todo => ({
    id,
    title: id,
    done: false,
    assignees: [],
    createdBy: 'ada',
    createdAt: '2026-09-01T00:00:00Z',
    updatedBy: 'ada',
    updatedAt: '2026-09-01T00:00:00Z',
    version: 1,
    ...fields,
  })
  const NOW = new Date('2026-09-30T14:00:00Z')

  it('counts only my and unassigned overdue to-dos toward "Waiting on you"', () => {
    const data = response({
      todos: {
        items: [
          todo('a', { dueDate: '2026-09-28' }),
          // Checked off here since the dashboard loaded.
          todo('b', { dueDate: '2026-09-29', done: true, assignees: ['ada'] }),
          todo('c', { dueDate: '2026-09-29', done: true, assignees: ['grace'] }),
        ],
        counts: { open: 6, overdue: 5, overdueForMe: 3, mine: 2, everyone: 2, others: 2 },
        people: [],
      },
    })
    // 3 of mine/unassigned overdue on the server, minus b; c is Grace's, so doesn't count.
    expect(waitingCounts(data, NOW).overdueTodos).toBe(2)
    expect(isAllCaughtUp(waitingCounts(data, NOW))).toBe(false)
    expect(todoCounts(data.todos as TodosWidget, 'ada', NOW)).toEqual({
      open: 4,
      overdueForMe: 2,
    })
  })

  it('is unknown when the to-dos widget failed', () => {
    const data = response({ todos: { error: { code: 'internal', message: 'x' } } })
    expect(waitingCounts(data, NOW).overdueTodos).toBeNull()
  })
})

describe('applyOverrides', () => {
  const data = response({ tasks: tasks({ overdue: [task('a')], inProgress: [task('a')] }) })
  const generated = Date.parse(data.generatedAt)

  it('shows a status set here until the server has caught up', () => {
    const overrides = new Map([
      ['a', { status: 'Done', statusKey: 'done' as const, at: generated + 1000 }],
    ])
    const next = applyOverrides(data, overrides).tasks as MyTasks
    expect(next.overdue[0].statusKey).toBe('done')
    expect(next.inProgress[0].status).toBe('Done')
  })

  it('lets newer server data win', () => {
    const overrides = new Map([
      ['a', { status: 'Done', statusKey: 'done' as const, at: generated - 1000 }],
    ])
    expect((applyOverrides(data, overrides).tasks as MyTasks).overdue[0].statusKey).toBe(
      'inProgress',
    )
  })
})
