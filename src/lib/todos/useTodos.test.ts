import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TasksError } from '../tasks/api'
import * as toast from '../toast'
import type { Todo } from './types'

const api = vi.hoisted(() => ({
  fetchTodos: vi.fn(),
  createTodo: vi.fn(),
  updateTodo: vi.fn(),
  deleteTodo: vi.fn(),
}))
vi.mock('./api', () => api)

const { addTodo, CONFLICT_MESSAGE, editTodo, loadTodos, peekTodos, removeTodo, resetTodosCache } =
  await import('./useTodos')

const TODO: Todo = {
  id: '00000000-0000-4000-8000-000000000001',
  title: 'Email Gerry',
  done: false,
  assignees: [],
  createdBy: 'ada',
  createdAt: '2026-09-01T12:00:00Z',
  updatedBy: 'ada',
  updatedAt: '2026-09-01T12:00:00Z',
  version: 3,
}

let showToast: ReturnType<typeof vi.spyOn>

beforeEach(async () => {
  resetTodosCache()
  for (const fn of Object.values(api)) fn.mockReset()
  showToast = vi.spyOn(toast, 'showToast').mockImplementation(() => {})
  api.fetchTodos.mockResolvedValue([TODO])
  await loadTodos()
})

afterEach(() => {
  vi.restoreAllMocks()
})

/** What the store shows right now. */
const shown = async () => peekTodos() ?? []

describe('useTodos optimistic writes', () => {
  it('shows an edit at once and keeps the server copy on success', async () => {
    let resolve!: (t: Todo) => void
    api.updateTodo.mockReturnValue(new Promise<Todo>((r) => (resolve = r)))
    const saving = editTodo(TODO.id, { done: true }, 'grace')
    expect((await shown())[0]).toMatchObject({ done: true, doneBy: 'grace' })
    expect(api.updateTodo).toHaveBeenCalledWith(TODO.id, 3, { done: true })

    resolve({ ...TODO, done: true, doneBy: 'grace', version: 4 })
    expect(await saving).toBe(true)
    expect((await shown())[0].version).toBe(4)
  })

  it('rolls back and toasts when the server refuses', async () => {
    api.updateTodo.mockRejectedValue(new TasksError('internal', 'Blob is down.'))
    const ok = await editTodo(TODO.id, { title: 'Email Gerry today' }, 'ada')
    expect(ok).toBe(false)
    expect((await shown())[0]).toEqual(TODO)
    expect(showToast).toHaveBeenCalledWith('error', "Couldn't save that change: Blob is down.")
  })

  it('on a 409, says someone else changed it and reloads', async () => {
    api.updateTodo.mockRejectedValue(new TasksError('conflict', 'changed'))
    const theirs = { ...TODO, title: 'Email Gerry (theirs)', version: 4 }
    api.fetchTodos.mockResolvedValue([theirs])
    await editTodo(TODO.id, { title: 'Mine' }, 'ada')
    expect(showToast).toHaveBeenCalledWith('error', CONFLICT_MESSAGE)
    await vi.waitFor(async () => expect((await shown())[0]).toEqual(theirs))
  })

  it('sends the confirmed version for back-to-back edits', async () => {
    api.updateTodo
      .mockResolvedValueOnce({ ...TODO, done: true, version: 4 })
      .mockResolvedValueOnce({ ...TODO, done: false, version: 5 })
    const first = editTodo(TODO.id, { done: true }, 'ada')
    const second = editTodo(TODO.id, { done: false }, 'ada')
    await Promise.all([first, second])
    expect(api.updateTodo.mock.calls.map((c) => c[1])).toEqual([3, 4])
    expect((await shown())[0]).toMatchObject({ done: false, version: 5 })
  })

  it('puts a deleted item back when the delete fails', async () => {
    api.deleteTodo.mockRejectedValue(new TasksError('network', 'Offline.'))
    const deleting = removeTodo(TODO.id)
    expect(await shown()).toEqual([])
    expect(await deleting).toBe(false)
    expect(await shown()).toEqual([TODO])
    expect(showToast).toHaveBeenCalledWith('error', "Couldn't delete “Email Gerry”: Offline.")
  })

  it('removes a quick-added item when creating fails', async () => {
    api.createTodo.mockRejectedValue(new TasksError('invalid-input', 'Too long.'))
    const adding = addTodo({ title: 'New' }, 'ada')
    expect((await shown()).map((t) => t.title)).toEqual(['Email Gerry', 'New'])
    expect(await adding).toBe(false)
    expect((await shown()).map((t) => t.title)).toEqual(['Email Gerry'])
  })
})
