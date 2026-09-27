import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { parseCreateTask, parsePatchTask } from '../taskInput.js'
import { GitHubApiError } from './errors.js'
import { graphql } from './graphql.js'
import { createTask, patchTask } from './mutations.js'
import { resolveFields, type RawContent, type RawField, type RawItem } from './project.js'

vi.mock('./graphql.js', () => ({ graphql: vi.fn() }))

const graphqlMock = vi.mocked(graphql)

const FIELDS: RawField[] = [
  {
    id: 'F_status',
    name: 'Status',
    dataType: 'SINGLE_SELECT',
    options: [
      { id: 'S_pb', name: 'Product Backlog' },
      { id: 'S_sb', name: 'Sprint Backlog' },
    ],
  },
  {
    id: 'F_iter',
    name: 'Iteration',
    dataType: 'ITERATION',
    configuration: {
      iterations: [{ id: 'I_2', title: 'Sprint 2', startDate: '2026-09-15', duration: 14 }],
    },
  },
  {
    id: 'F_pts',
    name: 'Story Points',
    dataType: 'SINGLE_SELECT',
    options: [{ id: 'P_3', name: '3' }],
  },
  {
    id: 'F_pri',
    name: 'Priority',
    dataType: 'SINGLE_SELECT',
    options: [{ id: 'PR_0', name: 'P0' }],
  },
  { id: 'F_est', name: 'Estimate', dataType: 'NUMBER' },
  { id: 'F_done', name: 'Estimated done date', dataType: 'DATE' },
]

const META = resolveFields({ id: 'PVT', url: 'u' }, FIELDS)

const DRAFT: RawContent = {
  __typename: 'DraftIssue',
  id: 'DI_1',
  title: 'Plan',
  updatedAt: '2026-09-20T00:00:00Z',
  assignees: { nodes: [] },
}

const ISSUE: RawContent = {
  __typename: 'Issue',
  id: 'I_1',
  title: 'Bug',
  url: 'https://github.com/dawn/app/issues/1',
  number: 1,
  updatedAt: '2026-09-20T00:00:00Z',
  repository: { nameWithOwner: 'dawn/app' },
  assignees: {
    nodes: [
      { id: 'U_ada', login: 'ada', avatarUrl: '' },
      { id: 'U_bo', login: 'bo', avatarUrl: '' },
    ],
  },
}

function item(content: RawContent, projectId = 'PVT'): RawItem & { project: { id: string } } {
  return {
    id: 'PVTI_1',
    isArchived: false,
    updatedAt: '2026-09-20T00:00:00Z',
    content,
    fieldValues: { nodes: [] },
    project: { id: projectId },
  }
}

/** The operation name of each GraphQL call, in order. */
const operations = () =>
  graphqlMock.mock.calls.map(([, query]) => /(?:mutation|query) (\w+)/.exec(query)![1])

/** Variables of every call to `operation`. */
const inputsOf = (operation: string) =>
  graphqlMock.mock.calls
    .filter(([, query]) => query.includes(`mutation ${operation}`))
    .map(([, , variables]) => (variables as { input: Record<string, unknown> }).input)

/**
 * Answers by operation. `fail` lists UpdateFieldValue field ids that should fail, or other
 * operation names.
 */
function stub(options: { content?: RawContent; projectId?: string; fail?: string[] } = {}) {
  const fail = new Set(options.fail)
  graphqlMock.mockImplementation(async (_token, query, variables) => {
    const input = (variables as { input?: { fieldId?: string } }).input
    const op = /(?:mutation|query) (\w+)/.exec(query)![1]
    if (fail.has(op) || (input?.fieldId && fail.has(input.fieldId))) {
      throw new GitHubApiError('upstream', 200, 'nope')
    }
    if (op === 'AddDraftIssue') return { addProjectV2DraftIssue: { projectItem: { id: 'PVTI_1' } } }
    if (op === 'ProjectItem') return { node: item(options.content ?? DRAFT, options.projectId) }
    return {}
  })
}

beforeEach(() => {
  graphqlMock.mockReset()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('createTask', () => {
  const input = parseCreateTask(
    {
      title: 'Plan',
      body: 'Notes',
      assigneeIds: ['U_ada'],
      iterationId: 'I_2',
      storyPointsOptionId: 'P_3',
      estimateHours: 3,
      doneBy: '2026-10-01',
    },
    META,
  )

  it('creates the draft first, then sets each field in turn, then re-reads the item', async () => {
    stub()
    const result = await createTask('gho_test', META, input)

    expect(operations()).toEqual([
      'AddDraftIssue',
      'UpdateFieldValue',
      'UpdateFieldValue',
      'UpdateFieldValue',
      'UpdateFieldValue',
      'UpdateFieldValue',
      'ProjectItem',
    ])
    expect(inputsOf('AddDraftIssue')).toEqual([
      { projectId: 'PVT', title: 'Plan', body: 'Notes', assigneeIds: ['U_ada'] },
    ])
    expect(inputsOf('UpdateFieldValue')).toEqual([
      { projectId: 'PVT', itemId: 'PVTI_1', fieldId: 'F_iter', value: { iterationId: 'I_2' } },
      {
        projectId: 'PVT',
        itemId: 'PVTI_1',
        fieldId: 'F_pts',
        value: { singleSelectOptionId: 'P_3' },
      },
      { projectId: 'PVT', itemId: 'PVTI_1', fieldId: 'F_est', value: { number: 3 } },
      { projectId: 'PVT', itemId: 'PVTI_1', fieldId: 'F_done', value: { date: '2026-10-01' } },
      // The default status comes last: Sprint Backlog, since an iteration was set.
      {
        projectId: 'PVT',
        itemId: 'PVTI_1',
        fieldId: 'F_status',
        value: { singleSelectOptionId: 'S_sb' },
      },
    ])
    for (const [token] of graphqlMock.mock.calls) expect(token).toBe('gho_test')
    expect(result.failedFields).toEqual([])
    expect(result.task).toMatchObject({ itemId: 'PVTI_1', kind: 'draft', title: 'Plan' })
  })

  it('keeps going after a failed field and reports it by name', async () => {
    stub({ fail: ['F_pts', 'F_done'] })
    const result = await createTask('t', META, input)
    // Every field was still attempted.
    expect(inputsOf('UpdateFieldValue')).toHaveLength(5)
    expect(result.failedFields).toEqual(['Story Points', 'Estimated done date'])
    expect(result.task).not.toBeNull()
  })

  it('stops calling GitHub once the session has expired, and marks the rest failed', async () => {
    let calls = 0
    graphqlMock.mockImplementation(async (_t, query) => {
      if (query.includes('AddDraftIssue')) {
        return { addProjectV2DraftIssue: { projectItem: { id: 'PVTI_1' } } }
      }
      calls += 1
      throw new GitHubApiError('session-expired', 401)
    })
    const result = await createTask('t', META, input)
    // One field attempt, then the read-back (which fails quietly).
    expect(calls).toBe(2)
    expect(result.failedFields).toEqual([
      'Iteration',
      'Story Points',
      'Estimate',
      'Estimated done date',
      'Status',
    ])
    expect(result.task).toBeNull()
  })

  it('sets no fields when the draft itself cannot be created', async () => {
    stub({ fail: ['AddDraftIssue'] })
    await expect(createTask('t', META, input)).rejects.toBeInstanceOf(GitHubApiError)
    expect(operations()).toEqual(['AddDraftIssue'])
  })
})

describe('patchTask', () => {
  it('updates a draft through its DraftIssue content id, then its fields', async () => {
    stub()
    const input = parsePatchTask(
      { title: 'Renamed', assigneeIds: ['U_bo'], priorityOptionId: null },
      META,
    )
    const result = await patchTask('t', META, 'PVTI_1', input)
    expect(operations()).toEqual([
      'ProjectItem',
      'UpdateDraftIssue',
      'ClearFieldValue',
      'ProjectItem',
    ])
    expect(inputsOf('UpdateDraftIssue')).toEqual([
      { draftIssueId: 'DI_1', title: 'Renamed', assigneeIds: ['U_bo'] },
    ])
    expect(inputsOf('ClearFieldValue')).toEqual([
      { projectId: 'PVT', itemId: 'PVTI_1', fieldId: 'F_pri' },
    ])
    expect(result?.failedFields).toEqual([])
  })

  it('diffs issue assignees into add and remove calls', async () => {
    stub({ content: ISSUE })
    await patchTask('t', META, 'PVTI_1', parsePatchTask({ assigneeIds: ['U_ada', 'U_cy'] }, META))
    expect(operations()).toEqual(['ProjectItem', 'AddAssignees', 'RemoveAssignees', 'ProjectItem'])
    expect(inputsOf('AddAssignees')).toEqual([{ assignableId: 'I_1', assigneeIds: ['U_cy'] }])
    expect(inputsOf('RemoveAssignees')).toEqual([{ assignableId: 'I_1', assigneeIds: ['U_bo'] }])
  })

  it("refuses to edit an issue's title, and a PR's assignees", async () => {
    stub({ content: ISSUE })
    await expect(
      patchTask('t', META, 'PVTI_1', parsePatchTask({ title: 'x' }, META)),
    ).rejects.toThrow(/only be edited in GitHub/)
    stub({ content: { ...ISSUE, __typename: 'PullRequest' } })
    await expect(
      patchTask('t', META, 'PVTI_1', parsePatchTask({ assigneeIds: [] }, META)),
    ).rejects.toThrow(/Only project fields/)
    // Nothing was written.
    expect(operations().every((op) => op === 'ProjectItem')).toBe(true)
  })

  it('returns null for an item from another project', async () => {
    stub({ projectId: 'PVT_other' })
    const input = parsePatchTask({ priorityOptionId: 'PR_0' }, META)
    expect(await patchTask('t', META, 'PVTI_1', input)).toBeNull()
    expect(operations()).toEqual(['ProjectItem'])
  })

  it('reports a partial failure, but throws when every change failed', async () => {
    stub({ fail: ['F_pri'] })
    const partial = parsePatchTask({ priorityOptionId: 'PR_0', doneBy: '2026-10-01' }, META)
    expect((await patchTask('t', META, 'PVTI_1', partial))?.failedFields).toEqual(['Priority'])

    stub({ fail: ['F_pri'] })
    const only = parsePatchTask({ priorityOptionId: 'PR_0' }, META)
    await expect(patchTask('t', META, 'PVTI_1', only)).rejects.toBeInstanceOf(GitHubApiError)
  })
})
