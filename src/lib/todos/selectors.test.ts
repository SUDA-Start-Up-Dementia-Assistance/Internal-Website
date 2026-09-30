import { describe, expect, it } from 'vitest'
import { compareTodos, filterTodos, groupTodos, type TodoLike } from './selectors'

const todo = (id: string, fields: Partial<TodoLike & { doneAt: string }> = {}) => ({
  id,
  title: id,
  done: false,
  createdAt: `2026-09-01T00:00:0${id.length}Z`,
  ...fields,
})

const TODAY = '2026-09-30'

describe('groupTodos', () => {
  it('splits open to-dos into overdue, this week (today + 6), later, and no date', () => {
    const groups = groupTodos(
      [
        todo('later', { dueDate: '2026-10-07' }),
        todo('week-end', { dueDate: '2026-10-06' }),
        todo('today', { dueDate: TODAY }),
        todo('late', { dueDate: '2026-09-29' }),
        todo('none'),
        todo('old', { done: true, doneAt: '2026-09-20T00:00:00Z' }),
        todo('new', { done: true, doneAt: '2026-09-29T00:00:00Z' }),
      ],
      TODAY,
    )
    expect(groups.overdue.map((t) => t.id)).toEqual(['late'])
    expect(groups.thisWeek.map((t) => t.id)).toEqual(['today', 'week-end'])
    expect(groups.later.map((t) => t.id)).toEqual(['later'])
    expect(groups.noDate.map((t) => t.id)).toEqual(['none'])
    expect(groups.done.map((t) => t.id)).toEqual(['new', 'old'])
  })
})

describe('filterTodos', () => {
  const todos = [todo('a', { assignee: 'Ada' }), todo('b', { assignee: 'grace' }), todo('c')]
  it('filters to mine (any case) or unassigned', () => {
    expect(filterTodos(todos, 'all', 'ada')).toHaveLength(3)
    expect(filterTodos(todos, 'mine', 'ada').map((t) => t.id)).toEqual(['a'])
    expect(filterTodos(todos, 'unassigned', 'ada').map((t) => t.id)).toEqual(['c'])
  })
})

describe('compareTodos', () => {
  it('puts no due date last', () => {
    const sorted = [todo('x'), todo('y', { dueDate: '2026-12-01' })].sort(compareTodos)
    expect(sorted.map((t) => t.id)).toEqual(['y', 'x'])
  })
})
