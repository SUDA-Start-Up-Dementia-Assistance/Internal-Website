import type { VercelRequest, VercelResponse } from '@vercel/node'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import handler from '../burndown.js'
import {
  aggregate,
  blobPath,
  mergeDay,
  parseFile,
  upsertDay,
  type BurndownDay,
  type BurndownFile,
} from './burndown.js'
import { clearProjectMetaCache } from './github/project.js'
import type { Task } from './github/types.js'
import { encryptSession } from './session.js'

// ─── An in-memory private Blob store with real ETag / overwrite rules ─────────

const blob = vi.hoisted(() => ({
  files: new Map<string, { body: string; etag: string }>(),
  puts: [] as { path: string; options: Record<string, unknown> }[],
  fail: { get: null as Error | null, put: null as Error | null, list: null as Error | null },
  /** Runs once just before the next put lands (e.g. another viewer writing first). */
  beforePut: null as null | (() => void),
  version: 0,
}))

vi.mock('@vercel/blob', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@vercel/blob')>()
  const write = (path: string, body: string) =>
    blob.files.set(path, { body, etag: `"v${++blob.version}"` })
  return {
    ...actual,
    async get(path: string, options: { access: string }) {
      expect(options.access).toBe('private')
      if (blob.fail.get) throw blob.fail.get
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
      if (blob.fail.put) throw blob.fail.put
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
      write(path, body)
      return { pathname: path }
    },
    async list({ prefix }: { prefix: string }) {
      if (blob.fail.list) throw blob.fail.list
      const blobs = [...blob.files.keys()]
        .filter((p) => p.startsWith(prefix))
        .map((pathname) => ({ pathname }))
      return { blobs, hasMore: false }
    },
  }
})

const ITERATION = { id: 'I_2', title: 'Sprint 2', startDate: '2026-09-22', duration: 14 }

function day(date: string, totals: Partial<BurndownDay> = {}): BurndownDay {
  return {
    date,
    scope: 10,
    done: 2,
    remaining: 8,
    unestimatedCount: 0,
    unit: 'storyPoints',
    ...totals,
  }
}

function seed(path: string, file: BurndownFile) {
  blob.files.set(path, { body: JSON.stringify(file), etag: `"v${++blob.version}"` })
}

const stored = (path: string) => JSON.parse(blob.files.get(path)!.body) as BurndownFile

beforeEach(() => {
  blob.files.clear()
  blob.puts = []
  blob.fail = { get: null, put: null, list: null }
  blob.beforePut = null
  vi.stubEnv('BLOB_READ_WRITE_TOKEN', 'vercel_blob_rw_test')
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  vi.useRealTimers()
})

// ─── Aggregation ─────────────────────────────────────────────────────────────

let n = 0
function task(fields: Partial<Task> = {}): Task {
  n += 1
  return {
    itemId: `item${n}`,
    contentId: `c${n}`,
    kind: 'draft',
    title: `Task ${n}`,
    assignees: [],
    status: 'In progress',
    statusKey: 'inProgress',
    updatedAt: '2026-09-20T00:00:00Z',
    iteration: ITERATION,
    ...fields,
  }
}

const done = { status: 'Done', statusKey: 'done' } as const

describe('aggregate', () => {
  it('sums scope and done in story points; remaining is the difference', () => {
    const tasks = [
      task({ storyPoints: 5, ...done }),
      task({ storyPoints: 3 }),
      task({ storyPoints: 8, status: 'Blocked', statusKey: 'blocked' }),
    ]
    expect(aggregate(tasks, 'I_2', 'storyPoints')).toEqual({
      scope: 16,
      done: 5,
      remaining: 11,
      unestimatedCount: 0,
    })
  })

  it('counts items with no value for the unit as unestimated (done or not), adding 0', () => {
    const tasks = [
      task({ storyPoints: 5, estimateHours: 4 }),
      task({ estimateHours: 2 }),
      task({ ...done, estimateHours: 1 }),
    ]
    expect(aggregate(tasks, 'I_2', 'storyPoints')).toEqual({
      scope: 5,
      done: 0,
      remaining: 5,
      unestimatedCount: 2,
    })
    // The same items in hours: every one has an estimate.
    expect(aggregate(tasks, 'I_2', 'estimateHours')).toEqual({
      scope: 7,
      done: 1,
      remaining: 6,
      unestimatedCount: 0,
    })
  })

  it('decides membership by the Iteration field only, never by Status', () => {
    const other = { ...ITERATION, id: 'I_1' }
    const tasks = [
      task({ storyPoints: 3 }),
      // "Sprint Backlog" but no iteration: not in the sprint.
      task({
        storyPoints: 5,
        status: 'Sprint Backlog',
        statusKey: 'sprintBacklog',
        iteration: undefined,
      }),
      task({ storyPoints: 8, iteration: other }),
      // "Product Backlog" status but in the iteration: counts.
      task({ storyPoints: 2, status: 'Product Backlog', statusKey: 'productBacklog' }),
    ]
    expect(aggregate(tasks, 'I_2', 'storyPoints').scope).toBe(5)
  })

  it('grows scope and remaining, not done, when work is added mid-sprint', () => {
    const before = [task({ storyPoints: 5, ...done }), task({ storyPoints: 5 })]
    const after = [...before, task({ storyPoints: 3 }), task({})]
    expect(aggregate(before, 'I_2', 'storyPoints')).toEqual({
      scope: 10,
      done: 5,
      remaining: 5,
      unestimatedCount: 0,
    })
    expect(aggregate(after, 'I_2', 'storyPoints')).toEqual({
      scope: 13,
      done: 5,
      remaining: 8,
      unestimatedCount: 1,
    })
  })

  it('rounds hour sums instead of storing float noise', () => {
    const tasks = [task({ estimateHours: 0.1 }), task({ estimateHours: 0.2, ...done })]
    expect(aggregate(tasks, 'I_2', 'estimateHours')).toMatchObject({
      scope: 0.3,
      done: 0.2,
      remaining: 0.1,
    })
  })

  it('is all zeros for an empty sprint', () => {
    expect(aggregate([], 'I_2', 'storyPoints')).toEqual({
      scope: 0,
      done: 0,
      remaining: 0,
      unestimatedCount: 0,
    })
  })
})

// ─── Storage ─────────────────────────────────────────────────────────────────

describe('mergeDay', () => {
  it('replaces a day by date and keeps days sorted', () => {
    const file = { iteration: ITERATION, days: [day('2026-09-24'), day('2026-09-22')] }
    const merged = mergeDay(file, ITERATION, day('2026-09-24', { done: 6, remaining: 4 }))
    expect(merged.days.map((d) => [d.date, d.done])).toEqual([
      ['2026-09-22', 2],
      ['2026-09-24', 6],
    ])
  })

  it('is idempotent: merging the same day twice gives the same file', () => {
    const file = { iteration: ITERATION, days: [day('2026-09-22')] }
    const once = mergeDay(file, ITERATION, day('2026-09-23'))
    expect(mergeDay(once, ITERATION, day('2026-09-23'))).toEqual(once)
  })
})

describe('parseFile', () => {
  it('drops malformed days and days in another unit', () => {
    const file = parseFile({
      iteration: ITERATION,
      days: [
        day('2026-09-23'),
        { ...day('2026-09-24'), unit: 'estimateHours' },
        { ...day('2026-02-30') },
        { ...day('2026-09-25'), scope: 'ten' },
        null,
        day('2026-09-22'),
      ],
    })
    expect(file?.days.map((d) => d.date)).toEqual(['2026-09-22', '2026-09-23'])
    expect(parseFile({ nope: true })).toBeNull()
  })
})

describe('upsertDay', () => {
  const path = 'burndown/I_2.json'

  it('creates the file, then upserts by date; the same day twice writes once', async () => {
    await upsertDay(ITERATION, day('2026-09-22'))
    expect(blob.puts).toEqual([
      {
        path,
        options: expect.objectContaining({
          access: 'private',
          addRandomSuffix: false,
          allowOverwrite: false,
        }),
      },
    ])

    await upsertDay(ITERATION, day('2026-09-23'))
    const afterSecondDay = blob.files.get(path)!
    await upsertDay(ITERATION, day('2026-09-23'))
    // Unchanged: no third write, same content.
    expect(blob.puts).toHaveLength(2)
    expect(blob.files.get(path)).toEqual(afterSecondDay)
    expect(stored(path)).toEqual({
      iteration: ITERATION,
      days: [day('2026-09-22'), day('2026-09-23')],
    })
  })

  it('lets the latest view of the day win', async () => {
    await upsertDay(ITERATION, day('2026-09-23', { done: 2 }))
    await upsertDay(ITERATION, day('2026-09-23', { done: 7, remaining: 3 }))
    expect(stored(path).days).toEqual([day('2026-09-23', { done: 7, remaining: 3 })])
    // The overwrite was conditional on the version just read.
    expect(blob.puts[1].options).toMatchObject({ ifMatch: expect.any(String) })
  })

  it('re-reads and merges when another viewer writes first', async () => {
    seed(path, { iteration: ITERATION, days: [day('2026-09-22')] })
    blob.beforePut = () =>
      seed(path, { iteration: ITERATION, days: [day('2026-09-22'), day('2026-09-23')] })
    await upsertDay(ITERATION, day('2026-09-24'))
    expect(stored(path).days.map((d) => d.date)).toEqual(['2026-09-22', '2026-09-23', '2026-09-24'])
  })

  it.each([
    ['before the iteration', '2026-09-21'],
    ['after its last day', '2026-10-06'],
  ])('never writes a date %s', async (_label, date) => {
    await expect(upsertDay(ITERATION, day(date))).rejects.toThrow(/outside iteration/)
    expect(blob.puts).toEqual([])
  })

  it('keeps a second unit in its own file', () => {
    expect(blobPath('I_2', 'storyPoints')).toBe('burndown/I_2.json')
    expect(blobPath('I_2', 'estimateHours')).toBe('burndown/I_2.estimateHours.json')
    expect(() => blobPath('../x')).toThrow()
  })
})

// ─── GET /api/burndown ───────────────────────────────────────────────────────

const SECRET = 'test-secret-that-is-definitely-32-chars-long!'

interface FakeRes {
  statusCode: number
  body: unknown
}

async function call(query: Record<string, string> = {}, signedIn = true): Promise<FakeRes> {
  const cookies: Record<string, string> = {}
  if (signedIn) {
    cookies.dawn_session = await encryptSession(
      { token: 'gho_test', user: { login: 'ada', name: 'Ada', avatarUrl: '' } },
      SECRET,
    )
  }
  const req = {
    method: 'GET',
    query,
    cookies,
    headers: { host: 'localhost:3000' },
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
  await handler(req, res)
  return out
}

const FIELDS = [
  {
    id: 'F_status',
    name: 'Status',
    dataType: 'SINGLE_SELECT',
    options: [
      { id: 'S_ip', name: 'In progress' },
      { id: 'S_done', name: 'Done' },
    ],
  },
  {
    id: 'F_iter',
    name: 'Iteration',
    dataType: 'ITERATION',
    configuration: {
      completedIterations: [
        { id: 'I_1', title: 'Sprint 1', startDate: '2026-09-08', duration: 14 },
      ],
      iterations: [{ id: 'I_2', title: 'Sprint 2', startDate: '2026-09-22', duration: 14 }],
    },
  },
  {
    id: 'F_pts',
    name: 'Story Points',
    dataType: 'SINGLE_SELECT',
    options: ['3', '5', '8'].map((p) => ({ id: `P${p}`, name: p })),
  },
  { id: 'F_done', name: 'Estimated done date', dataType: 'DATE' },
]

function item(id: string, points: string | null, status: string, iterationId: string | null) {
  const value = (fieldId: string, name: string) => ({
    __typename: 'ProjectV2ItemFieldSingleSelectValue',
    optionId: `${fieldId}-${name}`,
    name,
    field: { id: fieldId },
  })
  const iteration = FIELDS[1].configuration!
  const it = [...iteration.completedIterations, ...iteration.iterations].find(
    (i) => i.id === iterationId,
  )
  return {
    id,
    isArchived: false,
    updatedAt: '2026-09-20T00:00:00Z',
    content: {
      __typename: 'DraftIssue',
      id: `D_${id}`,
      title: `Secret title ${id}`,
      updatedAt: '2026-09-20T00:00:00Z',
      assignees: { nodes: [{ id: 'U1', login: 'ada', avatarUrl: '' }] },
    },
    fieldValues: {
      nodes: [
        value('F_status', status),
        ...(points ? [value('F_pts', points)] : []),
        ...(it
          ? [
              {
                __typename: 'ProjectV2ItemFieldIterationValue',
                iterationId: it.id,
                title: it.title,
                startDate: it.startDate,
                duration: it.duration,
                field: { id: 'F_iter' },
              },
            ]
          : []),
      ],
    },
  }
}

const ITEMS = [
  item('a', '5', 'Done', 'I_2'),
  item('b', '3', 'In progress', 'I_2'),
  item('c', null, 'In progress', 'I_2'),
  item('d', '8', 'Done', 'I_1'),
  item('e', '5', 'In progress', null),
]

function stubGitHub() {
  const operations: string[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init?: RequestInit) => {
      const { query } = JSON.parse(String(init?.body)) as { query: string }
      const op = /query (\w+)/.exec(query)![1]
      operations.push(op)
      if (op === 'ProjectMeta') {
        return Response.json({
          data: { organization: { projectV2: { id: 'PVT', url: 'u', fields: { nodes: FIELDS } } } },
        })
      }
      if (op === 'ProjectItems') {
        return Response.json({
          data: {
            organization: {
              projectV2: {
                items: { pageInfo: { hasNextPage: false, endCursor: null }, nodes: ITEMS },
              },
            },
          },
        })
      }
      return new Response('unexpected', { status: 500 })
    }),
  )
  return operations
}

describe('GET /api/burndown', () => {
  const TODAY_PATH = 'burndown/I_2.json'
  const todays = {
    date: '2026-09-29',
    scope: 8,
    done: 5,
    remaining: 3,
    unestimatedCount: 1,
    unit: 'storyPoints',
  }

  beforeEach(() => {
    vi.stubEnv('GITHUB_CLIENT_ID', 'client-id')
    vi.stubEnv('GITHUB_CLIENT_SECRET', 'client-secret')
    vi.stubEnv('SESSION_SECRET', SECRET)
    vi.stubEnv('GITHUB_ORG', 'dawn')
    vi.stubEnv('GITHUB_PROJECT_NUMBER', '1')
    clearProjectMetaCache()
    // Noon on Sep 29 in New York: day 8 of Sprint 2.
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-09-29T16:00:00Z'))
  })

  it('requires a session', async () => {
    stubGitHub()
    expect((await call({}, false)).statusCode).toBe(401)
  })

  it('computes and stores today for the current iteration, and returns every stored day', async () => {
    const earlier = day('2026-09-23', { scope: 8, done: 0, remaining: 8 })
    seed(TODAY_PATH, { iteration: ITERATION, days: [earlier] })
    stubGitHub()

    const res = await call()
    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({
      iteration: ITERATION,
      isCurrent: true,
      unit: 'storyPoints',
      today: '2026-09-29',
      days: [earlier, todays],
      iterationsWithSnapshots: ['I_2'],
      storageOk: true,
    })
    expect(stored(TODAY_PATH).days).toEqual([earlier, todays])
    // Totals only: no titles or assignees reach the store.
    expect(blob.files.get(TODAY_PATH)!.body).not.toMatch(/Secret title|ada/)

    // Viewing again the same day doesn't rewrite anything.
    await call()
    expect(blob.puts).toHaveLength(1)
  })

  it('never writes a past iteration, and does not read tasks for it', async () => {
    const past = { id: 'I_1', title: 'Sprint 1', startDate: '2026-09-08', duration: 14 }
    seed('burndown/I_1.json', { iteration: past, days: [day('2026-09-10')] })
    const operations = stubGitHub()

    const res = await call({ iteration: 'I_1' })
    expect(res.statusCode).toBe(200)
    expect(res.body).toMatchObject({
      iteration: past,
      isCurrent: false,
      days: [day('2026-09-10')],
      storageOk: true,
    })
    expect(blob.puts).toEqual([])
    expect(operations).toEqual(['ProjectMeta'])
  })

  it('still returns today’s numbers when the Blob write fails', async () => {
    stubGitHub()
    blob.fail.put = new Error('Blob store is down')
    const res = await call()
    expect(res.statusCode).toBe(200)
    expect(res.body).toMatchObject({ days: [todays], storageOk: false })
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Blob store is down'))
  })

  it('merges today into readable history when only the write fails', async () => {
    const earlier = day('2026-09-23')
    seed(TODAY_PATH, { iteration: ITERATION, days: [earlier] })
    stubGitHub()
    blob.fail.put = new Error('read-only')
    const res = await call()
    expect(res.body).toMatchObject({ days: [earlier, todays], storageOk: false })
  })

  it('still works, without history, when BLOB_READ_WRITE_TOKEN is missing', async () => {
    vi.stubEnv('BLOB_READ_WRITE_TOKEN', '')
    stubGitHub()
    const res = await call()
    expect(res.statusCode).toBe(200)
    expect(res.body).toMatchObject({ days: [todays], storageOk: false })
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('BLOB_READ_WRITE_TOKEN'))
  })

  it('returns no iteration when none is running and none was asked for', async () => {
    vi.setSystemTime(new Date('2026-12-01T16:00:00Z'))
    seed('burndown/I_1.json', {
      iteration: { id: 'I_1', title: 'Sprint 1', startDate: '2026-09-08', duration: 14 },
      days: [day('2026-09-10')],
    })
    stubGitHub()
    const res = await call()
    expect(res.body).toMatchObject({
      iteration: null,
      days: [],
      iterationsWithSnapshots: ['I_1'],
    })
    expect(blob.puts).toEqual([])
  })

  it.each(['I_9', '../etc'])('rejects an unknown iteration %j with 400', async (id) => {
    stubGitHub()
    const res = await call({ iteration: id })
    expect(res.statusCode).toBe(400)
    expect(res.body).toMatchObject({ error: { code: 'invalid-input' } })
  })
})
