import { describe, expect, it } from 'vitest'
import { assigneesLabel } from './format'
import { compareTodos, filterTodos, groupTodos, sameLogins, type TodoLike } from './selectors'

const todo = (id: string, fields: Partial<TodoLike & { doneAt: string }> = {}) => ({
  id,
  title: id,
  done: false,
  assignees: [],
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
  const todos = [todo('a', { assignees: ['Ada'] }), todo('b', { assignees: ['grace'] }), todo('c')]
  it('filters to mine (any case, including shared) or for everyone (no assignees)', () => {
    const withShared = [...todos, todo('d', { assignees: ['grace', 'ADA'] })]
    expect(filterTodos(withShared, 'all', 'ada')).toHaveLength(4)
    expect(filterTodos(withShared, 'mine', 'ada').map((t) => t.id)).toEqual(['a', 'd'])
    expect(filterTodos(withShared, 'everyone', 'ada').map((t) => t.id)).toEqual(['c'])
  })
})

describe('compareTodos', () => {
  it('puts no due date last', () => {
    const sorted = [todo('x'), todo('y', { dueDate: '2026-12-01' })].sort(compareTodos)
    expect(sorted.map((t) => t.id)).toEqual(['y', 'x'])
  })
})

describe('assigneesLabel', () => {
  const names: Record<string, string> = { priya: 'Priya', river: 'River', sam: 'Sam', ada: 'Ada' }
  const label = (assignees: string[]) => assigneesLabel(assignees, 'ada', (l) => names[l] ?? l)

  it('is null for a to-do that is for everyone', () => {
    expect(label([])).toBeNull()
  })

  it('names people, me first as "You", and shortens long lists', () => {
    expect(label(['ADA'])).toBe('You')
    expect(label(['priya'])).toBe('Priya')
    expect(label(['priya', 'ada'])).toBe('You and Priya')
    expect(label(['river', 'sam', 'priya', 'ada'])).toBe('You, River +2')
  })
})

describe('sameLogins', () => {
  it('ignores order and case', () => {
    expect(sameLogins(['Ada', 'grace'], ['grace', 'ada'])).toBe(true)
    expect(sameLogins(['ada'], ['ada', 'grace'])).toBe(false)
  })
})
