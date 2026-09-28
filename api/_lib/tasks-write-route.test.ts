import type { VercelRequest, VercelResponse } from '@vercel/node'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import patchHandler from '../tasks/[itemId].js'
import tasksHandler from '../tasks.js'
import { clearProjectMetaCache } from './github/project.js'
import { encryptSession } from './session.js'

const SECRET = 'test-secret-that-is-definitely-32-chars-long!'
const ORIGIN = 'http://localhost:3000'

interface FakeRes {
  statusCode: number
  headers: Record<string, string | string[]>
  body: unknown
}

interface CallInit {
  method: string
  body?: unknown
  itemId?: string
  origin?: string | null
  signedIn?: boolean
}

async function call(init: CallInit): Promise<FakeRes> {
  const cookies: Record<string, string> = {}
  if (init.signedIn ?? true) {
    cookies.dawn_session = await encryptSession(
      { token: 'gho_test', user: { login: 'ada', name: 'Ada', avatarUrl: '' } },
      SECRET,
    )
  }
  const headers: Record<string, string> = { host: 'localhost:3000' }
  const origin = init.origin === undefined ? ORIGIN : init.origin
  if (origin) headers.origin = origin
  const req = {
    method: init.method,
    query: init.itemId ? { itemId: init.itemId } : {},
    cookies,
    headers,
    body: init.body,
  } as unknown as VercelRequest
  const out: FakeRes = { statusCode: 200, headers: {}, body: undefined }
  const res = {
    headersSent: false,
    setHeader(name: string, value: string | string[]) {
      out.headers[name.toLowerCase()] = value
      return res
    },
    getHeader: (name: string) => out.headers[name.toLowerCase()],
    status(code: number) {
      out.statusCode = code
      return res
    },
    json(body: unknown) {
      out.body = body
      return res
    },
    end() {
      return res
    },
  } as unknown as VercelResponse
  await (init.itemId !== undefined ? patchHandler : tasksHandler)(req, res)
  return out
}

const FIELDS = [
  {
    id: 'F_status',
    name: 'Status',
    dataType: 'SINGLE_SELECT',
    options: [
      { id: 'S_pb', name: 'Product Backlog' },
      { id: 'S_done', name: 'Done' },
    ],
  },
  {
    id: 'F_iter',
    name: 'Iteration',
    dataType: 'ITERATION',
    configuration: { iterations: [], completedIterations: [] },
  },
  { id: 'F_est', name: 'Estimate', dataType: 'NUMBER' },
  { id: 'F_done', name: 'Estimated done date', dataType: 'DATE' },
]

const ITEM = {
  id: 'PVTI_new',
  isArchived: false,
  updatedAt: '2026-09-20T00:00:00Z',
  project: { id: 'PVT' },
  content: {
    __typename: 'DraftIssue',
    id: 'DI_new',
    title: 'Plan the demo',
    updatedAt: '2026-09-20T00:00:00Z',
    assignees: { nodes: [] },
  },
  fieldValues: {
    nodes: [
      {
        __typename: 'ProjectV2ItemFieldSingleSelectValue',
        optionId: 'S_pb',
        name: 'Product Backlog',
        field: { id: 'F_status' },
      },
    ],
  },
}

/** Answers each GraphQL operation by name; records the operations in order. */
function stubGitHub(
  overrides: Record<string, () => Response> = {},
  repositories: unknown[] = [{ id: 'R_app', nameWithOwner: 'dawn/app' }],
) {
  const operations: string[] = []
  const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
    const { query } = JSON.parse(String(init?.body)) as { query: string }
    const op = /(?:mutation|query) (\w+)/.exec(query)![1]
    operations.push(op)
    if (overrides[op]) return overrides[op]()
    switch (op) {
      case 'ProjectMeta':
        return Response.json({
          data: {
            organization: {
              projectV2: {
                id: 'PVT',
                url: 'https://github.com/orgs/dawn/projects/1',
                repositories: { nodes: repositories },
                fields: { nodes: FIELDS },
              },
            },
          },
        })
      case 'CreateIssue':
        return Response.json({
          data: {
            createIssue: {
              issue: { id: 'I_new', number: 7, url: 'https://github.com/dawn/app/issues/7' },
            },
          },
        })
      case 'AddProjectItem':
        return Response.json({ data: { addProjectV2ItemById: { item: { id: 'PVTI_new' } } } })
      case 'UpdateFieldValue':
      case 'ClearFieldValue':
        return Response.json({ data: { x: { projectV2Item: { id: 'PVTI_new' } } } })
      case 'ProjectItem':
        return Response.json({ data: { node: ITEM } })
      default:
        return new Response('unexpected', { status: 500 })
    }
  })
  vi.stubGlobal('fetch', fetchMock)
  return { fetchMock, operations }
}

beforeEach(() => {
  vi.stubEnv('GITHUB_CLIENT_ID', 'client-id')
  vi.stubEnv('GITHUB_CLIENT_SECRET', 'client-secret')
  vi.stubEnv('SESSION_SECRET', SECRET)
  vi.stubEnv('GITHUB_ORG', 'dawn')
  vi.stubEnv('GITHUB_PROJECT_NUMBER', '1')
  vi.spyOn(console, 'error').mockImplementation(() => {})
  clearProjectMetaCache()
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('POST /api/tasks', () => {
  it('creates an issue, adds it, applies the default status, and returns 201 with the item', async () => {
    const { fetchMock, operations } = stubGitHub()
    const res = await call({ method: 'POST', body: { title: 'Plan the demo' } })
    expect(res.statusCode).toBe(201)
    expect(operations).toEqual([
      'ProjectMeta',
      'CreateIssue',
      'AddProjectItem',
      'UpdateFieldValue',
      'ProjectItem',
    ])
    expect(res.body).toEqual({
      task: expect.objectContaining({ itemId: 'PVTI_new', status: 'Product Backlog' }),
      failedFields: [],
    })
    for (const [, init] of fetchMock.mock.calls) {
      expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer gho_test')
    }
    expect(JSON.stringify(res.body)).not.toContain('gho_test')
  })

  it('returns 201 with failedFields when a field update is rejected', async () => {
    stubGitHub({
      UpdateFieldValue: () =>
        Response.json({
          data: null,
          errors: [{ message: 'bad', path: ['updateProjectV2ItemFieldValue'] }],
        }),
    })
    const res = await call({ method: 'POST', body: { title: 'Plan', estimateHours: 3 } })
    expect(res.statusCode).toBe(201)
    expect(res.body).toMatchObject({ failedFields: ['Estimate', 'Status'] })
  })

  it('returns 502 naming the issue when it was created but not added to the project', async () => {
    const { operations } = stubGitHub({
      AddProjectItem: () =>
        Response.json({
          data: null,
          errors: [{ message: 'nope', path: ['addProjectV2ItemById'] }],
        }),
    })
    const res = await call({ method: 'POST', body: { title: 'Plan' } })
    expect(res.statusCode).toBe(502)
    expect(res.body).toMatchObject({
      error: {
        code: 'issue-not-added',
        message: expect.stringContaining('Issue #7 was created in dawn/app'),
      },
    })
    expect(operations).not.toContain('UpdateFieldValue')
  })

  it('explains a project with no linked repository, and creates nothing', async () => {
    const { operations } = stubGitHub({}, [])
    const res = await call({ method: 'POST', body: { title: 'Plan' } })
    expect(res.statusCode).toBe(500)
    expect(res.body).toMatchObject({
      error: {
        code: 'project-misconfigured',
        message: expect.stringContaining("isn't linked to a repository"),
      },
    })
    expect(operations).toEqual(['ProjectMeta'])
  })

  it.each([
    ['a missing Origin', null],
    ['another origin', 'https://evil.example'],
  ])('rejects %s with 403 before touching GitHub', async (_label, origin) => {
    const { fetchMock } = stubGitHub()
    const res = await call({ method: 'POST', body: { title: 't' }, origin })
    expect(res.statusCode).toBe(403)
    expect(res.body).toMatchObject({ error: { code: 'bad-origin' } })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('requires a session', async () => {
    stubGitHub()
    const res = await call({ method: 'POST', body: { title: 't' }, signedIn: false })
    expect(res.statusCode).toBe(401)
  })

  it('returns 400 with a readable message, and writes nothing', async () => {
    const { operations } = stubGitHub()
    const res = await call({ method: 'POST', body: { title: 't', doneBy: '2026-13-01' } })
    expect(res.statusCode).toBe(400)
    expect(res.body).toEqual({
      error: { code: 'invalid-input', message: '"Done by" must be a date like 2026-10-05.' },
    })
    expect(operations).toEqual(['ProjectMeta'])
  })
})

describe('PATCH /api/tasks/:itemId', () => {
  it('clears a field with null and returns the item', async () => {
    const { operations } = stubGitHub()
    const res = await call({ method: 'PATCH', itemId: 'PVTI_new', body: { doneBy: null } })
    expect(res.statusCode).toBe(200)
    expect(operations).toEqual(['ProjectMeta', 'ProjectItem', 'ClearFieldValue', 'ProjectItem'])
    expect(res.body).toMatchObject({ task: { itemId: 'PVTI_new' }, failedFields: [] })
  })

  it('404s for an item that is not in the project', async () => {
    stubGitHub({ ProjectItem: () => Response.json({ data: { node: null } }) })
    const res = await call({ method: 'PATCH', itemId: 'PVTI_gone', body: { doneBy: null } })
    expect(res.statusCode).toBe(404)
    expect(res.body).toMatchObject({ error: { code: 'not-found' } })
  })

  it('requires the same origin', async () => {
    stubGitHub()
    const res = await call({ method: 'PATCH', itemId: 'PVTI_new', body: {}, origin: null })
    expect(res.statusCode).toBe(403)
  })

  it('rejects a malformed item id and an empty patch with 400', async () => {
    stubGitHub()
    expect(
      (await call({ method: 'PATCH', itemId: 'a/b', body: { doneBy: null } })).statusCode,
    ).toBe(400)
    const empty = await call({ method: 'PATCH', itemId: 'PVTI_new', body: {} })
    expect(empty.statusCode).toBe(400)
    expect(empty.body).toMatchObject({ error: { message: 'Nothing to change.' } })
  })

  it('maps an expired token to 401', async () => {
    stubGitHub({
      ClearFieldValue: () => Response.json({ message: 'Bad credentials' }, { status: 401 }),
    })
    const res = await call({ method: 'PATCH', itemId: 'PVTI_new', body: { doneBy: null } })
    expect(res.statusCode).toBe(401)
    expect(res.body).toMatchObject({ error: { code: 'session-expired' } })
  })

  it('only allows PATCH', async () => {
    const res = await call({ method: 'GET', itemId: 'PVTI_new' })
    expect(res.statusCode).toBe(405)
    expect(res.headers.allow).toBe('PATCH')
  })
})
