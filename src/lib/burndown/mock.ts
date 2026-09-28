import { toDateKey } from '../drive/parse'
import { peekTasks } from '../tasks/useTasks'
import type { Task } from '../tasks/types'
import { addDaysToKey, daysBetween } from './chart'
import type { BurndownDay, BurndownResponse } from './types'

/*
 * Fake /api/burndown for VITE_TASKS_MOCK=true, built on the mock tasks. The current sprint
 * has a gap and starts recording a day late (so the warnings show); today's point is
 * computed live from the in-memory tasks, so mock edits move it. The previous sprint has a
 * weekend gap and scope added mid-sprint.
 */

function totals(tasks: Task[], iterationId: string): Omit<BurndownDay, 'date' | 'unit'> {
  let scope = 0
  let done = 0
  let unestimatedCount = 0
  for (const t of tasks) {
    if (t.iteration?.id !== iterationId) continue
    if (t.storyPoints === undefined) unestimatedCount += 1
    else {
      scope += t.storyPoints
      if (t.statusKey === 'done') done += t.storyPoints
    }
  }
  return { scope, done, remaining: scope - done, unestimatedCount }
}

const day = (date: string, scope: number, done: number, unestimatedCount = 0): BurndownDay => ({
  date,
  scope,
  done,
  remaining: scope - done,
  unestimatedCount,
  unit: 'storyPoints',
})

export async function mockBurndown(iterationId?: string): Promise<BurndownResponse> {
  await new Promise((resolve) => setTimeout(resolve, 200))
  const data = peekTasks()
  if (!data) throw new Error('Mock tasks have not loaded yet.')
  const today = toDateKey(new Date())
  const { iterations, currentIterationId } = data.meta
  const id = iterationId || currentIterationId
  const it = iterations.find((i) => i.id === id)
  const iterationsWithSnapshots = iterations.filter((i) => i.startDate <= today).map((i) => i.id)
  const base = { unit: 'storyPoints' as const, today, iterationsWithSnapshots, storageOk: true }
  if (!it) return { ...base, iteration: null, isCurrent: false, days: [] }

  const iteration = { id: it.id, title: it.title, startDate: it.startDate, duration: it.duration }
  const at = (i: number) => addDaysToKey(it.startDate, i)
  let days: BurndownDay[]
  if (it.id === currentIterationId) {
    const live = totals(data.tasks, it.id)
    const elapsed = daysBetween(it.startDate, today)
    // Recorded from day 1 (day 0 missed), with a gap on day 2; today is live.
    days = [
      day(at(1), live.scope - 3, 0, live.unestimatedCount),
      day(at(3), live.scope, Math.max(0, live.done - 3), live.unestimatedCount),
    ].filter((d) => d.date < today)
    if (elapsed >= 0) days.push({ date: today, ...live, unit: 'storyPoints' })
  } else if (it.completed) {
    const done = [0, 2, 3, 3, 5, null, null, 8, 10, 13, 15, 18, 20, 21]
    days = done.flatMap((d, i) => (d === null ? [] : [day(at(i), i < 7 ? 21 : 24, d)]))
  } else {
    days = []
  }
  return { ...base, iteration, isCurrent: it.id === currentIterationId, days }
}
