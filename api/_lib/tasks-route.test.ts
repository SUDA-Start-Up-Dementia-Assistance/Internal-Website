import type { VercelRequest, VercelResponse } from '@vercel/node'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import handler from '../tasks.js'
import { clearProjectMetaCache } from './github/project.js'
import { encryptSession } from './session.js'

const SECRET = 'test-secret-that-is-definitely-32-chars-long!'

interface FakeRes {
  statusCode: number
  headers: Record<string, string | string[]>
  body: unknown
}

async function call(init: { method?: string; signedIn?: boolean } = {}): Promise<FakeRes> {
  const cookies: Record<string, string> = {}
  if (init.signedIn ?? true) {
    cookies.dawn_session = await encryptSession(
      { token: 'gho_test', user: { login: 'ada', name: 'Ada', avatarUrl: '' } },
      SECRET,
    )
  }
  const req = {
    method: init.method ?? 'GET',
    query: {},
    cookies,
    headers: { host: 'localhost:3000' },
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
  await handler(req, res)
  return out
}

const PROJECT_FIELDS = [
  {
    id: 'F_status',
    name: 'Status',
    dataType: 'SINGLE_SELECT',
    options: [{ id: 'S_done', name: 'Done' }],
  },
  {
    id: 'F_iter',
    name: 'Iteration',
    dataType: 'ITERATION',
    configuration: { iterations: [], completedIterations: [] },
  },
  { id: 'F_est', name: 'Estimate', dataType: 'NUMBER' },
  { id: 'F_done', name: 'Estimated done date', dataType: 'DATE' },
  { id: 'F_type', name: 'Type', dataType: 'SINGLE_SELECT', options: [{ id: 'T', name: 'Dev' }] },
]

/** Answers each GraphQL query by its operation name; `pages` splits items across pages. */
function stubGraphQL(
  override?: (query: string) => Response | undefined,
  pages: unknown[][] = [
    [
      {
        id: 'PVTI_1',
        isArchived: false,
        updatedAt: '2026-09-20T00:00:00Z',
        content: {
          __typename: 'DraftIssue',
          id: 'DI_1',
          title: 'Plan',
          updatedAt: '2026-09-20T00:00:00Z',
          assignees: { nodes: [] },
        },
        fieldValues: { nodes: [] },
      },
    ],
  ],
) {
  const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
    const { query, variables } = JSON.parse(String(init?.body)) as {
      query: string
      variables: { after?: string | null }
    }
    const custom = override?.(query)
    if (custom) return custom
    if (query.includes('query ProjectMeta')) {
      return Response.json({
        data: {
          organization: {
            projectV2: {
              id: 'PVT',
              url: 'https://github.com/orgs/dawn/projects/1',
              fields: { nodes: PROJECT_FIELDS },
            },
          },
        },
      })
    }
    if (query.includes('query ProjectItems')) {
      const index = variables.after ? Number(variables.after) : 0
      const hasNextPage = index < pages.length - 1
      return Response.json({
        data: {
          organization: {
            projectV2: {
              items: {
                pageInfo: { hasNextPage, endCursor: hasNextPage ? String(index + 1) : null },
                nodes: pages[index],
              },
            },
          },
        },
      })
    }
    if (query.includes('query OrgMembers')) {
      return Response.json({
        data: {
          organization: {
            membersWithRole: {
              pageInfo: { hasNextPage: false, endCursor: null },
              nodes: [{ id: 'U1', login: 'ada', name: null, avatarUrl: 'https://a/ada.png' }],
            },
          },
        },
      })
    }
    return new Response('unexpected', { status: 500 })
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

const cookies = (res: FakeRes) => ([] as string[]).concat(res.headers['set-cookie'] ?? [])

beforeEach(() => {
  vi.stubEnv('GITHUB_CLIENT_ID', 'client-id')
  vi.stubEnv('GITHUB_CLIENT_SECRET', 'client-secret')
  vi.stubEnv('SESSION_SECRET', SECRET)
  vi.stubEnv('GITHUB_ORG', 'dawn')
  vi.stubEnv('GITHUB_PROJECT_NUMBER', '1')
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  clearProjectMetaCache()
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('GET /api/tasks', () => {
  it('requires a session', async () => {
    const res = await call({ signedIn: false })
    expect(res.statusCode).toBe(401)
    expect(res.body).toMatchObject({ error: { code: 'unauthenticated' } })
  })

  it('returns tasks, meta, and team using the user token, across item pages', async () => {
    const draft = (id: string) => ({
      id,
      isArchived: false,
      updatedAt: '2026-09-20T00:00:00Z',
      content: {
        __typename: 'DraftIssue',
        id: `D_${id}`,
        title: id,
        updatedAt: '2026-09-20T00:00:00Z',
        assignees: { nodes: [] },
      },
      fieldValues: { nodes: [] },
    })
    const fetchMock = stubGraphQL(undefined, [
      [draft('a'), draft('b')],
      [
        draft('c'),
        { ...draft('d'), isArchived: true },
        // Redacted: an issue in a private repo the token can't read.
        { ...draft('e'), content: null },
        { ...draft('f'), content: null, isArchived: true },
      ],
    ])
    const res = await call()
    expect(res.statusCode).toBe(200)
    const body = res.body as {
      tasks: { itemId: string }[]
      hiddenCount: number
      meta: Record<string, unknown>
      team: unknown[]
    }
    expect(body.tasks.map((t) => t.itemId)).toEqual(['a', 'b', 'c'])
    // Archived items don't count as hidden, even when redacted.
    expect(body.hiddenCount).toBe(1)
    expect(body.meta).toMatchObject({
      projectUrl: 'https://github.com/orgs/dawn/projects/1',
      statuses: [{ id: 'S_done', name: 'Done', key: 'done' }],
      types: [{ id: 'T', name: 'Dev' }],
      currentIterationId: null,
    })
    expect(body.team).toEqual([
      { id: 'U1', login: 'ada', name: 'ada', avatarUrl: 'https://a/ada.png' },
    ])
    for (const [, init] of fetchMock.mock.calls) {
      expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer gho_test')
    }
    // Meta is fetched once even though listItems needs it too.
    expect(
      fetchMock.mock.calls.filter(([, i]) => String(i?.body).includes('query ProjectMeta')),
    ).toHaveLength(1)
    expect(JSON.stringify(body)).not.toContain('gho_test')
  })

  it('maps a GitHub 401 to session-expired and clears the cookie', async () => {
    stubGraphQL(() => Response.json({ message: 'Bad credentials' }, { status: 401 }))
    const res = await call()
    expect(res.statusCode).toBe(401)
    expect(res.body).toMatchObject({ error: { code: 'session-expired' } })
    expect(
      cookies(res).some((c) => c.startsWith('dawn_session=;') && c.includes('Max-Age=0')),
    ).toBe(true)
  })

  it('maps permission errors to a clear no-access message, without GitHub’s text', async () => {
    stubGraphQL(() =>
      Response.json({
        data: { organization: null },
        errors: [
          {
            type: 'FORBIDDEN',
            path: ['organization'],
            message:
              'Although you appear to have the correct authorization credentials, the `dawn` organization has enabled OAuth App access restrictions',
          },
        ],
      }),
    )
    const res = await call()
    expect(res.statusCode).toBe(403)
    const body = res.body as { error: { code: string; message: string } }
    expect(body.error.code).toBe('no-project-access')
    expect(body.error.message).toMatch(/hasn't approved this app/)
    expect(body.error.message).not.toMatch(/Although/)
  })

  it('treats a project the user cannot see as no-access', async () => {
    stubGraphQL((q) =>
      q.includes('ProjectMeta')
        ? Response.json({ data: { organization: { projectV2: null } } })
        : undefined,
    )
    const res = await call()
    expect(res.statusCode).toBe(403)
  })

  it.each([
    [
      'a 403 with no remaining quota',
      () =>
        new Response('{"message":"API rate limit exceeded"}', {
          status: 403,
          headers: {
            'x-ratelimit-remaining': '0',
            'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + 120),
          },
        }),
    ],
    ['a 429', () => new Response('{}', { status: 429, headers: { 'retry-after': '60' } })],
    [
      'a RATE_LIMITED GraphQL error',
      () => Response.json({ data: null, errors: [{ type: 'RATE_LIMITED', message: 'slow down' }] }),
    ],
  ])('maps %s to rate-limited', async (_label, make) => {
    stubGraphQL(make)
    const res = await call()
    expect(res.statusCode).toBe(429)
    expect(res.body).toMatchObject({ error: { code: 'rate-limited' } })
  })

  it('tolerates an error on a single item', async () => {
    stubGraphQL((q) =>
      q.includes('ProjectItems')
        ? Response.json({
            data: {
              organization: {
                projectV2: {
                  items: { pageInfo: { hasNextPage: false, endCursor: null }, nodes: [] },
                },
              },
            },
            errors: [
              {
                type: 'FORBIDDEN',
                path: ['organization', 'projectV2', 'items', 'nodes', 0, 'content'],
              },
            ],
          })
        : undefined,
    )
    const res = await call()
    expect(res.statusCode).toBe(200)
  })

  it('names a missing required project field', async () => {
    stubGraphQL((q) =>
      q.includes('ProjectMeta')
        ? Response.json({
            data: {
              organization: {
                projectV2: {
                  id: 'PVT',
                  url: 'u',
                  fields: { nodes: PROJECT_FIELDS.filter((f) => f.name !== 'Iteration') },
                },
              },
            },
          })
        : undefined,
    )
    const res = await call()
    expect(res.statusCode).toBe(500)
    expect(res.body).toMatchObject({
      error: { code: 'project-misconfigured', message: expect.stringContaining('"Iteration"') },
    })
  })

  it('names a missing GITHUB_PROJECT_NUMBER', async () => {
    vi.stubEnv('GITHUB_PROJECT_NUMBER', '')
    stubGraphQL()
    const res = await call()
    expect(res.statusCode).toBe(500)
    expect(res.body).toEqual({
      error: {
        code: 'server-misconfigured',
        message: 'Missing required environment variable(s): GITHUB_PROJECT_NUMBER.',
      },
    })
  })

  it('rejects other methods', async () => {
    const res = await call({ method: 'DELETE' })
    expect(res.statusCode).toBe(405)
    expect(res.headers.allow).toBe('GET, POST')
  })
})
