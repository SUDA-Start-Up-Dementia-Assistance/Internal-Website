import type { VercelRequest, VercelResponse } from '@vercel/node'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import todosHandler from '../todos.js'
import { encryptSession } from './session.js'
import {
  createTodo,
  DONE_VISIBLE_DAYS,
  isListed,
  listTodos,
  parseCreateTodo,
  parsePatchTodo,
  resetTodosState,
  todoPath,
  updateTodo,
  type Todo,
} from './todos.js'

// ─── In-memory Blob store ────────────────────────────────────────────────────

const blob = vi.hoisted(() => ({
  files: new Map<string, { body: string; etag: string }>(),
  puts: [] as { path: string; options: Record<string, unknown> }[],
  dels: [] as string[],
  lists: 0,
  version: 0,
  /** Runs once just before the next put lands. */
  beforePut: null as null | (() => void),
}))

vi.mock('@vercel/blob', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@vercel/blob')>()
  return {
    ...actual,
    async get(path: string, options: { access: string; useCache?: boolean }) {
      expect(options.access).toBe('private')
      expect(options.useCache).toBe(false)
      const file = blob.files.get(path)
      if (!file) return null
      return {
        statusCode: 200,
        stream: new Response(file.body).body,
        headers: new Headers(),
        blob: { pathname: path, etag: file.etag },
      }
    },
    async put(path: string, body: string, options: Record<string, unknown>) {
      expect(options.access).toBe('private')
      const hook = blob.beforePut
      blob.beforePut = null
      hook?.()
      blob.puts.push({ path, options })
      const existing = blob.files.get(path)
      if (options.ifMatch !== undefined && existing?.etag !== options.ifMatch) {
        throw new actual.BlobPreconditionFailedError()
      }
      if (options.allowOverwrite === false && existing) {
        throw new actual.BlobError('This blob already exists')
      }
      blob.files.set(path, { body, etag: `"v${++blob.version}"` })
      return { pathname: path }
    },
    async del(path: string, options: { ifMatch?: string }) {
      const existing = blob.files.get(path)
      if (options.ifMatch !== undefined && existing?.etag !== options.ifMatch) {
        throw new actual.BlobPreconditionFailedError()
      }
      blob.dels.push(path)
      blob.files.delete(path)
    },
    async list({ prefix }: { prefix: string }) {
      blob.lists += 1
      const blobs = [...blob.files.keys()]
        .filter((p) => p.startsWith(prefix))
        .map((pathname) => ({ pathname }))
      return { blobs, hasMore: false }
    },
  }
})

const team = vi.hoisted(() => ({ logins: ['ada', 'Grace-H'] }))

vi.mock('./github/project.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./github/project.js')>()
  return {
    ...actual,
    listTeam: vi.fn(async () =>
      team.logins.map((login) => ({ id: login, login, name: login, avatarUrl: '' })),
    ),
  }
})

// ─── Helpers ─────────────────────────────────────────────────────────────────

const NOW = new Date('2026-09-30T14:00:00Z')
const ADA = { login: 'ada', name: 'Ada', avatarUrl: '' }
const GRACE = { login: 'Grace-H', name: 'Grace', avatarUrl: '' }
const members = async () => team.logins

let nextId = 0
function stored(overrides: Partial<Todo> = {}): Todo {
  nextId += 1
  const todo: Todo = {
    id: `00000000-0000-4000-8000-${String(nextId).padStart(12, '0')}`,
    title: `Stored ${nextId}`,
    done: false,
    assignees: [],
    createdBy: 'ada',
    createdAt: '2026-09-01T12:00:00Z',
    updatedBy: 'ada',
    updatedAt: '2026-09-01T12:00:00Z',
    version: 1,
    ...overrides,
  }
  blob.files.set(todoPath(todo.id), { body: JSON.stringify(todo), etag: `"v${++blob.version}"` })
  return todo
}

const read = (id: string) => JSON.parse(blob.files.get(todoPath(id))!.body) as Todo

beforeEach(() => {
  blob.files.clear()
  blob.puts = []
  blob.dels = []
  blob.lists = 0
  blob.beforePut = null
  team.logins = ['ada', 'Grace-H']
  resetTodosState()
  vi.stubEnv('BLOB_READ_WRITE_TOKEN', 'vercel_blob_rw_test')
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

// ─── Validation ──────────────────────────────────────────────────────────────

describe('validation', () => {
  it('trims the title and requires 1–200 characters', () => {
    expect(parseCreateTodo({ title: '  Email Gerry  ' }).title).toBe('Email Gerry')
    expect(parseCreateTodo({ title: 'x'.repeat(200) }).title).toHaveLength(200)
    expect(() => parseCreateTodo({ title: '   ' })).toThrow(/needs a title/)
    expect(() => parseCreateTodo({})).toThrow(/needs a title/)
    expect(() => parseCreateTodo({ title: 'x'.repeat(201) })).toThrow(/under 200/)
    expect(() => parsePatchTodo({ version: 1, title: '' })).toThrow(/needs a title/)
  })

  it('limits the description to 2000 characters', () => {
    expect(() => parseCreateTodo({ title: 'a', description: 'x'.repeat(2001) })).toThrow(/2000/)
    expect(parseCreateTodo({ title: 'a', description: 'x'.repeat(2000) }).description).toHaveLength(
      2000,
    )
  })

  it('rejects a due date that is not a real YYYY-MM-DD date', () => {
    for (const dueDate of ['2026-02-30', '10/02/2026', '2026-10-2', '2026-10-02T00:00:00Z', 5]) {
      expect(() => parseCreateTodo({ title: 'a', dueDate })).toThrow(/real date/)
    }
    expect(parseCreateTodo({ title: 'a', dueDate: '2026-10-02' }).dueDate).toBe('2026-10-02')
  })

  it('rejects an assignee who is not a current org member', async () => {
    await expect(createTodo({ title: 'a', assignees: ['mallory'] }, ADA, members)).rejects.toThrow(
      /isn’t a member/,
    )
    expect(blob.puts).toHaveLength(0)
    // Case-insensitive, stored as the team list spells it.
    const todo = await createTodo({ title: 'a', assignees: ['grace-h'] }, ADA, members)
    expect(todo.assignees).toEqual(['Grace-H'])
  })

  it('takes several assignees, all checked against the team, without repeats', async () => {
    const todo = await createTodo(
      { title: 'a', assignees: ['ADA', 'grace-h', 'ada'] },
      ADA,
      members,
    )
    expect(todo.assignees).toEqual(['ada', 'Grace-H'])
    // One non-member sinks the whole request, and nothing is written.
    const puts = blob.puts.length
    await expect(
      createTodo({ title: 'b', assignees: ['ada', 'mallory'] }, ADA, members),
    ).rejects.toThrow(/mallory isn’t a member/)
    expect(blob.puts).toHaveLength(puts)
    expect(() => parseCreateTodo({ title: 'a', assignees: 'ada' })).toThrow(/list/)
    expect(() => parseCreateTodo({ title: 'a', assignees: Array(21).fill('ada') })).toThrow(/20/)
  })

  it('defaults to no assignees: the to-do is for everyone', async () => {
    const lookup = vi.fn(members)
    const todo = await createTodo({ title: 'Team lunch' }, ADA, lookup)
    expect(todo.assignees).toEqual([])
    // No team lookup is needed when nobody is being assigned.
    expect(lookup).not.toHaveBeenCalled()
  })

  it('patches need a version and at least one change', () => {
    expect(() => parsePatchTodo({ title: 'a' })).toThrow(/version/)
    expect(() => parsePatchTodo({ version: 1 })).toThrow(/nothing to change/)
    expect(parsePatchTodo({ version: 2, dueDate: null, assignees: [] })).toEqual({
      version: 2,
      changes: { dueDate: null, assignees: [] },
    })
    // Blank logins are dropped.
    expect(parsePatchTodo({ version: 2, assignees: [' ', 'ada'] }).changes.assignees).toEqual([
      'ada',
    ])
  })
})

// ─── Writes ──────────────────────────────────────────────────────────────────

describe('writes', () => {
  it('takes createdBy/updatedBy from the session, never the body', async () => {
    const todo = await createTodo(
      { title: 'Email Gerry', createdBy: 'mallory', updatedBy: 'mallory', done: true },
      ADA,
      members,
      NOW,
    )
    expect(todo).toMatchObject({
      title: 'Email Gerry',
      createdBy: 'ada',
      updatedBy: 'ada',
      done: false,
      version: 1,
      createdAt: NOW.toISOString(),
    })
    expect(read(todo.id)).toEqual(todo)
    expect(blob.puts[0].options).toMatchObject({
      access: 'private',
      allowOverwrite: false,
      addRandomSuffix: false,
      cacheControlMaxAge: 60,
    })
  })

  it('takes doneBy from the session when completing, and clears it when reopening', async () => {
    const { id } = stored()
    const done = await updateTodo(
      id,
      { version: 1, done: true, doneBy: 'mallory' },
      GRACE,
      members,
      NOW,
    )
    expect(done).toMatchObject({
      done: true,
      doneBy: 'Grace-H',
      doneAt: NOW.toISOString(),
      updatedBy: 'Grace-H',
      createdBy: 'ada',
      version: 2,
    })
    const reopened = await updateTodo(id, { version: 2, done: false }, ADA, members, NOW)
    expect(reopened.done).toBe(false)
    expect(reopened).not.toHaveProperty('doneBy')
    expect(reopened).not.toHaveProperty('doneAt')
    expect(reopened.version).toBe(3)
  })

  it('changes only the fields sent; null clears', async () => {
    const { id } = stored({
      description: 'Ask about Oct 14',
      dueDate: '2026-10-02',
      assignees: ['ada'],
    })
    const next = await updateTodo(id, { version: 1, title: 'Email Gerry again' }, ADA, members)
    expect(next).toMatchObject({
      title: 'Email Gerry again',
      description: 'Ask about Oct 14',
      dueDate: '2026-10-02',
      assignees: ['ada'],
    })
    const cleared = await updateTodo(id, { version: 2, dueDate: null }, ADA, members)
    expect(cleared).not.toHaveProperty('dueDate')
    expect(cleared.description).toBe('Ask about Oct 14')
  })

  it('replaces the assignee list on PATCH; [] makes it for everyone', async () => {
    const { id } = stored({ assignees: ['ada'] })
    const both = await updateTodo(id, { version: 1, assignees: ['ada', 'grace-h'] }, ADA, members)
    expect(both.assignees).toEqual(['ada', 'Grace-H'])
    const none = await updateTodo(id, { version: 2, assignees: [] }, ADA, members)
    expect(none.assignees).toEqual([])
    expect(read(id).assignees).toEqual([])
  })

  it('reads files from before multiple assignees, and saves them in the new shape', async () => {
    const legacy = stored()
    const { assignees: _drop, ...rest } = legacy
    void _drop
    blob.files.set(todoPath(legacy.id), {
      body: JSON.stringify({ ...rest, assignee: 'ada' }),
      etag: '"legacy"',
    })
    expect((await listTodos(NOW)).find((t) => t.id === legacy.id)?.assignees).toEqual(['ada'])
    await updateTodo(legacy.id, { version: 1, title: 'Renamed' }, ADA, members)
    const saved = JSON.parse(blob.files.get(todoPath(legacy.id))!.body)
    expect(saved.assignees).toEqual(['ada'])
    expect(saved).not.toHaveProperty('assignee')
  })

  it('answers 409 on a version mismatch and writes nothing', async () => {
    const todo = stored({ version: 3 })
    const before = blob.files.get(todoPath(todo.id))
    const res = await call({ method: 'PATCH', id: todo.id, body: { version: 2, title: 'Mine!' } })
    expect(res.statusCode).toBe(409)
    expect(res.body).toEqual({ error: { code: 'conflict', message: expect.any(String) } })
    expect(blob.puts).toHaveLength(0)
    expect(blob.files.get(todoPath(todo.id))).toBe(before)

    const del = await call({ method: 'DELETE', id: todo.id, query: { version: '1' } })
    expect(del.statusCode).toBe(409)
    expect(blob.dels).toHaveLength(0)
  })

  it('answers 409 when someone writes between the read and the write', async () => {
    const todo = stored()
    // Another instance saves right after we read, before our write lands.
    blob.beforePut = () => stored({ ...todo, title: 'Theirs', version: 2 })
    await expect(updateTodo(todo.id, { version: 1, title: 'Mine' }, ADA, members)).rejects.toThrow(
      /changed by someone else/,
    )
    expect(read(todo.id).title).toBe('Theirs')
  })
})

// ─── Listing ─────────────────────────────────────────────────────────────────

describe('listing', () => {
  it('returns open items and items done in the last 14 days only', async () => {
    const day = 86_400_000
    const open = stored({ title: 'open' })
    const recent = stored({
      title: 'recent',
      done: true,
      doneAt: new Date(NOW.getTime() - (DONE_VISIBLE_DAYS - 1) * day).toISOString(),
    })
    stored({
      title: 'old',
      done: true,
      doneAt: new Date(NOW.getTime() - (DONE_VISIBLE_DAYS + 1) * day).toISOString(),
    })
    const todos = await listTodos(NOW)
    expect(todos.map((t) => t.id)).toEqual([open.id, recent.id])
    // Old done items stay stored.
    expect(blob.files.size).toBe(3)
    expect(isListed({ ...open, done: true }, NOW)).toBe(false)
  })

  it('caches the list for 15s, and any write invalidates it', async () => {
    stored()
    await listTodos(NOW)
    await listTodos(new Date(NOW.getTime() + 10_000))
    expect(blob.lists).toBe(1)

    const created = await createTodo({ title: 'New one' }, ADA, members, NOW)
    const after = await listTodos(NOW)
    expect(blob.lists).toBe(2)
    expect(after.map((t) => t.id)).toContain(created.id)

    await listTodos(new Date(NOW.getTime() + 16_000))
    expect(blob.lists).toBe(3)
  })

  it('skips malformed files', async () => {
    stored({ title: 'good' })
    blob.files.set('todos/00000000-0000-4000-8000-999999999999.json', {
      body: '{"nope":true}',
      etag: '"x"',
    })
    blob.files.set('todos/readme.txt', { body: 'hi', etag: '"y"' })
    expect((await listTodos(NOW)).map((t) => t.title)).toEqual(['good'])
  })
})

// ─── Route ───────────────────────────────────────────────────────────────────

const SECRET = 'test-secret-that-is-definitely-32-chars-long!'
const ORIGIN = 'http://localhost:3000'

interface FakeRes {
  statusCode: number
  body: unknown
}

async function call(init: {
  method: string
  id?: string
  body?: unknown
  query?: Record<string, string>
  origin?: string | null
  signedIn?: boolean
}): Promise<FakeRes> {
  vi.stubEnv('GITHUB_CLIENT_ID', 'client-id')
  vi.stubEnv('GITHUB_CLIENT_SECRET', 'client-secret')
  vi.stubEnv('SESSION_SECRET', SECRET)
  vi.stubEnv('GITHUB_ORG', 'dawn')
  vi.stubEnv('GITHUB_PROJECT_NUMBER', '1')
  const cookies: Record<string, string> = {}
  if (init.signedIn ?? true) {
    cookies.dawn_session = await encryptSession({ accessToken: 'gho_test', user: ADA }, SECRET)
  }
  const headers: Record<string, string> = { host: 'localhost:3000' }
  const origin = init.origin === undefined ? ORIGIN : init.origin
  if (origin) headers.origin = origin
  const req = {
    method: init.method,
    url: `/api/todos${init.id ? `/${init.id}` : ''}`,
    query: { ...(init.id ? { id: [init.id] } : {}), ...init.query },
    cookies,
    headers,
    body: init.body,
  } as unknown as VercelRequest
  const out: FakeRes = { statusCode: 200, body: undefined }
  const res = {
    headersSent: false,
    setHeader: () => res,
    getHeader: () => undefined,
    status(code: number) {
      out.statusCode = code
      return res
    },
    json(body: unknown) {
      out.body = body
      return res
    },
    end: () => res,
  } as unknown as VercelResponse
  await todosHandler(req, res)
  return out
}

describe('/api/todos', () => {
  it('requires sign-in', async () => {
    const res = await call({ method: 'GET', signedIn: false })
    expect(res.statusCode).toBe(401)
  })

  it('requires same-origin writes', async () => {
    const res = await call({ method: 'POST', body: { title: 'x' }, origin: 'https://evil.test' })
    expect(res.statusCode).toBe(403)
    expect(blob.puts).toHaveLength(0)
  })

  it('creates with createdBy from the session', async () => {
    const res = await call({ method: 'POST', body: { title: 'Email Gerry', createdBy: 'mallory' } })
    expect(res.statusCode).toBe(201)
    expect((res.body as { todo: Todo }).todo.createdBy).toBe('ada')
  })

  it('answers 400 for a non-member assignee and 404 for a missing to-do', async () => {
    const bad = await call({ method: 'POST', body: { title: 'x', assignees: ['mallory'] } })
    expect(bad.statusCode).toBe(400)
    const missing = await call({
      method: 'PATCH',
      id: '00000000-0000-4000-8000-000000000abc',
      body: { version: 1, done: true },
    })
    expect(missing.statusCode).toBe(404)
  })

  it('deletes with the current version', async () => {
    const todo = stored()
    const res = await call({ method: 'DELETE', id: todo.id, query: { version: '1' } })
    expect(res.statusCode).toBe(200)
    expect(blob.files.has(todoPath(todo.id))).toBe(false)
  })

  it('lists open and recently done to-dos', async () => {
    stored({ title: 'open' })
    const res = await call({ method: 'GET' })
    expect(res.statusCode).toBe(200)
    expect((res.body as { todos: Todo[] }).todos.map((t) => t.title)).toEqual(['open'])
  })
})
