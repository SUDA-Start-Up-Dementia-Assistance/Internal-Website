import { describe, expect, it } from 'vitest'
import { createMockTasks } from './mock'
import {
  applyFilters,
  compareByDoneBy,
  DEFAULT_FILTERS,
  doneByDate,
  githubLink,
  groupByAssignee,
  groupByDue,
  isDueSoon,
  isOverdue,
  selectBlocked,
  selectCurrentIteration,
  selectDueSoon,
  selectMine,
  selectNextUp,
  selectOverdue,
  selectSprintBacklogWithoutIteration,
  sumTotals,
} from './selectors'
import type { StatusKey, Task } from './types'

// Tests run in America/New_York (see vite.config.ts).
const TODAY = new Date(2026, 8, 29, 12, 0) // Tue, Sep 29 2026, noon
const LATE_TODAY = new Date(2026, 8, 29, 23, 30) // already Sep 30 in UTC

let n = 0
function task(fields: Partial<Task> & { key?: StatusKey } = {}): Task {
  n += 1
  const { key = 'inProgress', ...rest } = fields
  return {
    itemId: `item${n}`,
    contentId: `c${n}`,
    kind: 'draft',
    title: `Task ${n}`,
    assignees: [],
    status: key,
    statusKey: key,
    updatedAt: '2026-09-20T00:00:00Z',
    ...rest,
  }
}

const ids = (tasks: Task[]) => tasks.map((t) => t.itemId)

describe('doneByDate (GitHub date fields as local dates)', () => {
  it('parses "YYYY-MM-DD" as local midnight, not UTC midnight', () => {
    const date = doneByDate(task({ doneBy: '2026-09-29' }))!
    // As UTC midnight this would be Sep 28, 8pm in New York.
    expect(date.getFullYear()).toBe(2026)
    expect(date.getMonth()).toBe(8)
    expect(date.getDate()).toBe(29)
    expect(date.getHours()).toBe(0)
  })

  it('is null when unset or malformed', () => {
    expect(doneByDate(task())).toBeNull()
    expect(doneByDate(task({ doneBy: '2026-02-30' }))).toBeNull()
  })
})

describe('isOverdue', () => {
  it('is true only for open tasks whose date is before today', () => {
    expect(isOverdue(task({ doneBy: '2026-09-28' }), TODAY)).toBe(true)
    expect(isOverdue(task({ doneBy: '2026-09-29' }), TODAY)).toBe(false)
    expect(isOverdue(task({ doneBy: '2026-09-28', key: 'done' }), TODAY)).toBe(false)
    expect(isOverdue(task(), TODAY)).toBe(false)
  })

  it('counts blocked tasks as open', () => {
    expect(isOverdue(task({ doneBy: '2026-09-01', key: 'blocked' }), TODAY)).toBe(true)
  })

  it('uses the local day late in the evening', () => {
    // At 11:30pm on Sep 29 local, a task due Sep 29 is due today, not overdue.
    expect(isOverdue(task({ doneBy: '2026-09-29' }), LATE_TODAY)).toBe(false)
  })
})

describe('isDueSoon', () => {
  it('covers today through 3 days out', () => {
    expect(isDueSoon(task({ doneBy: '2026-09-29' }), TODAY)).toBe(true)
    expect(isDueSoon(task({ doneBy: '2026-10-02' }), TODAY)).toBe(true)
    expect(isDueSoon(task({ doneBy: '2026-10-03' }), TODAY)).toBe(false)
  })

  it('excludes overdue, done, and undated tasks', () => {
    expect(isDueSoon(task({ doneBy: '2026-09-28' }), TODAY)).toBe(false)
    expect(isDueSoon(task({ doneBy: '2026-09-30', key: 'done' }), TODAY)).toBe(false)
    expect(isDueSoon(task(), TODAY)).toBe(false)
  })

  it('crosses month and year boundaries', () => {
    const dec30 = new Date(2026, 11, 30)
    expect(isDueSoon(task({ doneBy: '2027-01-02' }), dec30)).toBe(true)
    expect(isDueSoon(task({ doneBy: '2027-01-03' }), dec30)).toBe(false)
  })
})

describe('list selectors', () => {
  const overdue = task({ doneBy: '2026-09-20' })
  const soon = task({ doneBy: '2026-09-30' })
  const blocked = task({ key: 'blocked', doneBy: '2026-10-20' })
  const done = task({ key: 'done', doneBy: '2026-09-20' })
  const all = [overdue, soon, blocked, done]

  it('selectOverdue / selectDueSoon / selectBlocked', () => {
    expect(ids(selectOverdue(all, TODAY))).toEqual([overdue.itemId])
    expect(ids(selectDueSoon(all, TODAY))).toEqual([soon.itemId])
    expect(ids(selectBlocked(all))).toEqual([blocked.itemId])
  })

  it('selectMine matches assignees case-insensitively', () => {
    const mine = task({ assignees: [{ login: 'Ada', avatarUrl: '' }] })
    expect(ids(selectMine([mine, overdue], 'ada'))).toEqual([mine.itemId])
  })

  it('selectCurrentIteration uses the current iteration id, and is empty with no sprint', () => {
    const current = { id: 'IT_2', title: 'Sprint 2', startDate: '2026-09-22', duration: 14 }
    const previous = { id: 'IT_1', title: 'Sprint 1', startDate: '2026-09-08', duration: 14 }
    const a = task({ iteration: current })
    const b = task({ iteration: previous })
    expect(ids(selectCurrentIteration([a, b, task()], { currentIterationId: 'IT_2' }))).toEqual([
      a.itemId,
    ])
    expect(selectCurrentIteration([a, b], { currentIterationId: null })).toEqual([])
  })

  it('selectSprintBacklogWithoutIteration', () => {
    const iteration = { id: 'IT', title: 'S', startDate: '2026-09-22', duration: 14 }
    const loose = task({ key: 'sprintBacklog' })
    const planned = task({ key: 'sprintBacklog', iteration })
    const backlog = task({ key: 'productBacklog' })
    expect(ids(selectSprintBacklogWithoutIteration([loose, planned, backlog]))).toEqual([
      loose.itemId,
    ])
  })
})

describe('compareByDoneBy', () => {
  it('sorts by date, then P0 first, then title; undated last', () => {
    const tasks = [
      task({ title: 'undated' }),
      task({ title: 'b', doneBy: '2026-10-01', priority: 'P2' }),
      task({ title: 'a', doneBy: '2026-10-01' }),
      task({ title: 'c', doneBy: '2026-10-01', priority: 'P0' }),
      task({ title: 'early', doneBy: '2026-09-30', priority: 'P2' }),
    ]
    expect(tasks.sort(compareByDoneBy).map((t) => t.title)).toEqual([
      'early',
      'c',
      'b',
      'a',
      'undated',
    ])
  })
})

describe('groupByDue', () => {
  it('buckets into overdue / this week (7 days) / later / no date / done', () => {
    const g = groupByDue(
      [
        task({ title: 'late', doneBy: '2026-09-28' }),
        task({ title: 'today', doneBy: '2026-09-29' }),
        task({ title: 'week end', doneBy: '2026-10-05' }),
        task({ title: 'later', doneBy: '2026-10-06' }),
        task({ title: 'undated' }),
        task({ title: 'finished', key: 'done', doneBy: '2026-09-01' }),
      ],
      TODAY,
    )
    const titles = (list: Task[]) => list.map((t) => t.title)
    expect(titles(g.overdue)).toEqual(['late'])
    expect(titles(g.thisWeek)).toEqual(['today', 'week end'])
    expect(titles(g.later)).toEqual(['later'])
    expect(titles(g.noDate)).toEqual(['undated'])
    expect(titles(g.done)).toEqual(['finished'])
  })
})

describe('groupByAssignee', () => {
  const team = [
    { id: '1', login: 'ada', name: 'Ada', avatarUrl: '' },
    { id: '2', login: 'bo', name: 'Bo', avatarUrl: '' },
  ]

  it('gives every member a section, blocked first; then outsiders; then unassigned', () => {
    const ada = { login: 'ada', avatarUrl: '' }
    const a1 = task({ assignees: [ada], doneBy: '2026-09-30' })
    const a2 = task({ assignees: [ada], key: 'blocked', doneBy: '2026-10-30' })
    const outside = task({ assignees: [{ login: 'guest', avatarUrl: '' }] })
    const nobody = task()
    const groups = groupByAssignee([a1, a2, outside, nobody], team)
    expect(groups.map((g) => g.member?.login ?? null)).toEqual(['ada', 'bo', 'guest', null])
    expect(ids(groups[0].tasks)).toEqual([a2.itemId, a1.itemId])
    expect(groups[1].tasks).toEqual([])
  })

  it('lists a task under each of its assignees', () => {
    const shared = task({
      assignees: [
        { login: 'ada', avatarUrl: '' },
        { login: 'bo', avatarUrl: '' },
      ],
    })
    const groups = groupByAssignee([shared], team)
    expect(groups.map((g) => g.tasks.length)).toEqual([1, 1])
  })
})

describe('sumTotals', () => {
  it('adds points and hours, counting tasks without points', () => {
    expect(
      sumTotals([
        task({ storyPoints: 3, estimateHours: 4 }),
        task({ estimateHours: 1.5 }),
        task({ storyPoints: 5 }),
      ]),
    ).toEqual({ storyPoints: 8, estimateHours: 5.5, unestimated: 1 })
  })
})

describe('applyFilters', () => {
  const current = { id: 'NOW', title: 'Now', startDate: '2026-09-22', duration: 14 }
  const meta = { currentIterationId: 'NOW' }
  const inSprint = task({ type: 'Dev', priority: 'P0', iteration: current })
  const docs = task({ type: 'Docs', iteration: current })
  const backlog = task({ type: 'Dev' })
  const done = task({ key: 'done', type: 'Dev', iteration: current })
  const all = [inSprint, docs, backlog, done]

  it('defaults to open tasks in the current sprint', () => {
    expect(ids(applyFilters(all, DEFAULT_FILTERS, meta))).toEqual([inSprint.itemId, docs.itemId])
  })

  it('ignores "current sprint only" when no sprint is running', () => {
    expect(applyFilters(all, DEFAULT_FILTERS, { currentIterationId: null })).toHaveLength(3)
  })

  it('filters by type and priority, and shows Done on request', () => {
    const f = { ...DEFAULT_FILTERS, type: 'Dev', showDone: true, currentSprintOnly: false }
    expect(ids(applyFilters(all, f, meta))).toEqual([inSprint.itemId, backlog.itemId, done.itemId])
    expect(ids(applyFilters(all, { ...f, priority: 'P0' }, meta))).toEqual([inSprint.itemId])
  })

  it('shows Done tasks when the Status filter asks for them', () => {
    expect(ids(applyFilters(all, { ...DEFAULT_FILTERS, status: 'done' }, meta))).toEqual([
      done.itemId,
    ])
  })
})

describe('selectNextUp', () => {
  it("returns the user's next 3 open tasks by date, undated last", () => {
    const me = [{ login: 'me', avatarUrl: '' }]
    const tasks = [
      task({ title: 'undated', assignees: me }),
      task({ title: 'third', assignees: me, doneBy: '2026-10-09' }),
      task({ title: 'first', assignees: me, doneBy: '2026-09-01' }),
      task({ title: 'finished', assignees: me, key: 'done', doneBy: '2026-08-01' }),
      task({ title: 'not mine', doneBy: '2026-08-01' }),
      task({ title: 'second', assignees: me, doneBy: '2026-10-02' }),
    ]
    expect(selectNextUp(tasks, 'me').map((t) => t.title)).toEqual(['first', 'second', 'third'])
  })
})

describe('githubLink', () => {
  it('links issues and PRs directly, drafts to the project board', () => {
    const board = 'https://github.com/orgs/x/projects/1'
    expect(githubLink(task({ kind: 'issue', url: 'https://i', number: 4 }), board)).toEqual({
      href: 'https://i',
      label: 'Open issue #4 in GitHub',
    })
    expect(githubLink(task(), board).href).toBe(board)
  })
})

describe('mock data', () => {
  const { tasks, meta } = createMockTasks(TODAY)

  it('covers the cases the UI must handle', () => {
    expect(new Set(tasks.map((t) => t.kind))).toEqual(new Set(['draft', 'issue', 'pr']))
    expect(selectOverdue(tasks, TODAY).length).toBeGreaterThan(0)
    expect(selectBlocked(tasks).length).toBeGreaterThan(0)
    expect(tasks.some((t) => t.storyPoints === undefined)).toBe(true)
    expect(selectSprintBacklogWithoutIteration(tasks).length).toBeGreaterThan(0)
    expect(
      new Set(tasks.flatMap((t) => (t.iteration ? [t.iteration.id] : []))).size,
    ).toBeGreaterThanOrEqual(2)
  })

  it('uses the real Status options and has a running sprint', () => {
    expect(meta.statuses.map((s) => s.name)).toEqual([
      'Product Backlog',
      'Sprint Backlog',
      'In progress',
      'In review',
      'Done',
      'Blocked',
    ])
    expect(selectCurrentIteration(tasks, meta).length).toBeGreaterThan(0)
  })
})
