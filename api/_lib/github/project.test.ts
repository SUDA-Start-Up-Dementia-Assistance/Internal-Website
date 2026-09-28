import { describe, expect, it } from 'vitest'
import { ProjectSetupError } from './errors.js'
import {
  issueRepository,
  labelsOf,
  normalizeItem,
  parsePoints,
  resolveFields,
  statusKeyOf,
  toClientMeta,
  type RawContent,
  type RawField,
  type RawFieldValue,
  type RawItem,
} from './project.js'

const PROJECT = { id: 'PVT_1', url: 'https://github.com/orgs/dawn/projects/1' }

const FIELDS: RawField[] = [
  { id: 'F_title', name: 'Title', dataType: 'TITLE' },
  {
    id: 'F_status',
    name: 'Status',
    dataType: 'SINGLE_SELECT',
    options: [
      { id: 'S_pb', name: 'Product Backlog' },
      { id: 'S_sb', name: 'Sprint Backlog' },
      { id: 'S_ip', name: 'In progress' },
      { id: 'S_done', name: 'Done', color: 'ORANGE' },
      { id: 'S_blk', name: 'Blocked', color: 'RED' },
    ],
  },
  {
    id: 'F_iter',
    name: 'Iteration',
    dataType: 'ITERATION',
    configuration: {
      completedIterations: [
        { id: 'I_1', title: 'Sprint 1', startDate: '2026-09-01', duration: 14 },
      ],
      iterations: [
        { id: 'I_3', title: 'Sprint 3', startDate: '2026-09-29', duration: 14 },
        { id: 'I_2', title: 'Sprint 2', startDate: '2026-09-15', duration: 14 },
      ],
    },
  },
  {
    id: 'F_pts',
    name: 'Story Points',
    dataType: 'SINGLE_SELECT',
    options: ['1', '2', '3', '5', '8', '13', '?'].map((n) => ({ id: `P_${n}`, name: n })),
  },
  { id: 'F_est', name: 'Estimate', dataType: 'NUMBER' },
  {
    id: 'F_pri',
    name: 'Priority',
    dataType: 'SINGLE_SELECT',
    options: [
      { id: 'PR_0', name: 'P0' },
      { id: 'PR_1', name: 'P1' },
    ],
  },
  { id: 'F_size', name: 'Size', dataType: 'SINGLE_SELECT', options: [{ id: 'SZ_m', name: 'M' }] },
  { id: 'F_done', name: 'Estimated done date', dataType: 'DATE' },
  {
    id: 'F_type',
    name: 'Type',
    dataType: 'SINGLE_SELECT',
    options: [{ id: 'T_dev', name: 'Dev' }],
  },
  { id: 'F_sub', name: 'Sub-issues progress', dataType: 'SUB_ISSUES_PROGRESS' },
]

const META = resolveFields(PROJECT, FIELDS)

const select = (fieldId: string, name: string): RawFieldValue => ({
  __typename: 'ProjectV2ItemFieldSingleSelectValue',
  optionId: `${fieldId}-${name}`,
  name,
  field: { id: fieldId },
})

const ALL_VALUES: RawFieldValue[] = [
  { __typename: 'ProjectV2ItemFieldTextValue', field: { id: 'F_title' } },
  select('F_status', 'In progress'),
  select('F_pts', '5'),
  { __typename: 'ProjectV2ItemFieldNumberValue', number: 4.5, field: { id: 'F_est' } },
  select('F_pri', 'P0'),
  select('F_size', 'M'),
  { __typename: 'ProjectV2ItemFieldDateValue', date: '2026-09-29', field: { id: 'F_done' } },
  select('F_type', 'Dev'),
  {
    __typename: 'ProjectV2ItemFieldIterationValue',
    iterationId: 'I_2',
    title: 'Sprint 2',
    startDate: '2026-09-15',
    duration: 14,
    field: { id: 'F_iter' },
  },
]

const people = [{ login: 'ada', avatarUrl: 'https://a/ada.png' }, null]

function item(
  content: RawContent | null,
  values: RawFieldValue[] = [],
  extra: Partial<RawItem> = {},
): RawItem {
  return {
    id: 'PVTI_1',
    isArchived: false,
    updatedAt: '2026-09-20T10:00:00Z',
    content,
    fieldValues: { nodes: values },
    ...extra,
  }
}

const draft: RawContent = {
  __typename: 'DraftIssue',
  id: 'DI_1',
  title: 'Write the test plan',
  updatedAt: '2026-09-21T10:00:00Z',
  assignees: { nodes: people },
}

const issue: RawContent = {
  __typename: 'Issue',
  id: 'I_kw',
  title: 'Crash on launch',
  url: 'https://github.com/dawn/app/issues/12',
  number: 12,
  updatedAt: '2026-09-19T10:00:00Z',
  repository: { nameWithOwner: 'dawn/app' },
  assignees: { nodes: [] },
}

const pr: RawContent = {
  ...issue,
  __typename: 'PullRequest',
  id: 'PR_kw',
  number: 13,
  url: 'https://github.com/dawn/app/pull/13',
}

describe('normalizeItem', () => {
  it('normalizes a draft issue with every field type', () => {
    expect(normalizeItem(item(draft, ALL_VALUES), META)).toEqual({
      itemId: 'PVTI_1',
      contentId: 'DI_1',
      kind: 'draft',
      title: 'Write the test plan',
      assignees: [{ login: 'ada', avatarUrl: 'https://a/ada.png' }],
      status: 'In progress',
      statusKey: 'inProgress',
      storyPoints: 5,
      estimateHours: 4.5,
      priority: 'P0',
      size: 'M',
      doneBy: '2026-09-29',
      type: 'Dev',
      iteration: { id: 'I_2', title: 'Sprint 2', startDate: '2026-09-15', duration: 14 },
      // The later of the item's and the content's timestamps.
      updatedAt: '2026-09-21T10:00:00Z',
    })
  })

  it('adds url, repo, and number for issues', () => {
    const task = normalizeItem(item(issue), META)!
    expect(task).toMatchObject({
      kind: 'issue',
      contentId: 'I_kw',
      url: 'https://github.com/dawn/app/issues/12',
      repo: 'dawn/app',
      number: 12,
      updatedAt: '2026-09-20T10:00:00Z',
    })
  })

  it('adds issue labels, and leaves them out when there are none', () => {
    const labelled: RawContent = {
      ...issue,
      labels: { nodes: [{ name: 'bug', color: 'D73A4A' }, null] },
    }
    expect(normalizeItem(item(labelled), META)?.labels).toEqual([{ name: 'bug', color: 'd73a4a' }])
    expect(normalizeItem(item(issue), META)).not.toHaveProperty('labels')
    expect(normalizeItem(item({ ...issue, labels: { nodes: [] } }), META)).not.toHaveProperty(
      'labels',
    )
  })

  it('normalizes pull requests', () => {
    expect(normalizeItem(item(pr), META)).toMatchObject({
      kind: 'pr',
      number: 13,
      repo: 'dawn/app',
    })
  })

  it('leaves unset fields out entirely', () => {
    const task = normalizeItem(item(issue), META)!
    expect(task.status).toBeNull()
    expect(task.statusKey).toBeNull()
    for (const key of [
      'storyPoints',
      'estimateHours',
      'priority',
      'size',
      'doneBy',
      'type',
      'iteration',
    ]) {
      expect(task).not.toHaveProperty(key)
    }
  })

  it('treats non-numeric Story Points as unestimated', () => {
    const task = normalizeItem(item(draft, [select('F_pts', '?')]), META)!
    expect(task).not.toHaveProperty('storyPoints')
  })

  it('reads values by field id, not by option name', () => {
    // A "5" in some other single-select field must not become story points.
    const task = normalizeItem(item(draft, [select('F_other', '5')]), META)!
    expect(task).not.toHaveProperty('storyPoints')
  })

  it('drops archived and redacted items', () => {
    expect(normalizeItem(item(draft, [], { isArchived: true }), META)).toBeNull()
    expect(normalizeItem(item(null), META)).toBeNull()
  })

  it('ignores a malformed date', () => {
    const values: RawFieldValue[] = [
      { __typename: 'ProjectV2ItemFieldDateValue', date: '2026-02-30', field: { id: 'F_done' } },
    ]
    expect(normalizeItem(item(draft, values), META)).not.toHaveProperty('doneBy')
  })
})

describe('labelsOf', () => {
  it('keeps only 6-digit hex colors, so nothing else can reach a style attribute', () => {
    expect(
      labelsOf([
        { name: 'ok', color: 'a2eeef' },
        { name: 'css', color: 'red;background:url(x)' },
        { name: 'short', color: 'fff' },
        { name: '', color: 'a2eeef' },
      ]),
    ).toEqual([
      { name: 'ok', color: 'a2eeef' },
      { name: 'css', color: '' },
      { name: 'short', color: '' },
    ])
  })
})

describe('parsePoints', () => {
  it.each([
    ['1', 1],
    [' 13 ', 13],
    ['0.5', 0.5],
    ['?', undefined],
    ['XL', undefined],
    ['', undefined],
    [undefined, undefined],
  ])('%j → %j', (input, expected) => {
    expect(parsePoints(input)).toBe(expected)
  })
})

describe('statusKeyOf', () => {
  it('maps configured names case-insensitively, and unknown names to null', () => {
    expect(statusKeyOf('Done')).toBe('done')
    expect(statusKeyOf(' in PROGRESS ')).toBe('inProgress')
    expect(statusKeyOf('Icebox')).toBeNull()
    expect(statusKeyOf(null)).toBeNull()
  })
})

describe('resolveFields', () => {
  it('sorts completed and upcoming iterations together, oldest first', () => {
    expect(META.iteration.iterations.map((i) => [i.id, i.completed])).toEqual([
      ['I_1', true],
      ['I_2', false],
      ['I_3', false],
    ])
  })

  it('names every missing required field, and lists the fields the project has', () => {
    const fields = FIELDS.filter((f) => f.name !== 'Iteration' && f.name !== 'Status')
    expect(() => resolveFields(PROJECT, fields)).toThrow(ProjectSetupError)
    expect(() => resolveFields(PROJECT, fields)).toThrow(
      /"Status" \(single select\) is missing; "Iteration" \(iteration\) is missing/,
    )
    expect(() => resolveFields(PROJECT, fields)).toThrow(
      /The project's fields are: "Title" \(title\), "Story Points" \(single select\)/,
    )
  })

  it('treats Type as optional', () => {
    const meta = resolveFields(
      PROJECT,
      FIELDS.filter((f) => f.name !== 'Type'),
    )
    expect(meta.type).toBeUndefined()
    expect(toClientMeta(meta, '2026-09-20')).not.toHaveProperty('types')
    const task = normalizeItem(item(draft, ALL_VALUES), meta)!
    expect(task).not.toHaveProperty('type')
    expect(task.status).toBe('In progress')
  })

  it('rejects a required field of the wrong type', () => {
    const fields = FIELDS.map((f) =>
      f.name === 'Estimated done date' ? { ...f, dataType: 'TEXT' } : f,
    )
    expect(() => resolveFields(PROJECT, fields)).toThrow(
      /"Estimated done date" must be a date field/,
    )
  })

  it('omits missing optional fields', () => {
    const fields = FIELDS.filter((f) => !['Priority', 'Size', 'Estimate'].includes(f.name!))
    const meta = resolveFields(PROJECT, fields)
    expect(meta.priority).toBeUndefined()
    const client = toClientMeta(meta, '2026-09-20')
    expect(client).not.toHaveProperty('priorities')
    expect(client.hasEstimate).toBe(false)
    expect(client.storyPointOptions).toHaveLength(7)
  })

  it('finds fields regardless of name casing', () => {
    const fields = FIELDS.map((f) =>
      f.name === 'Story Points' ? { ...f, name: 'story points' } : f,
    )
    expect(resolveFields(PROJECT, fields).storyPoints?.id).toBe('F_pts')
  })
})

describe('issueRepository', () => {
  const withRepos = (names: string[]) =>
    resolveFields(
      {
        ...PROJECT,
        repositories: { nodes: names.map((n, i) => ({ id: `R_${i}`, nameWithOwner: n })) },
      },
      FIELDS,
    )

  it('uses the only linked repository, and tells the browser which it is', () => {
    const meta = withRepos(['dawn/app'])
    expect(issueRepository(meta)).toEqual({ id: 'R_0', nameWithOwner: 'dawn/app' })
    const client = toClientMeta(meta, '2026-09-20')
    expect(client.issueRepository).toBe('dawn/app')
    expect(client).not.toHaveProperty('issueSetupError')
  })

  it('explains, rather than guessing, with none or several', () => {
    expect(() => issueRepository(withRepos([]))).toThrow(/isn't linked to a repository/)
    expect(() => issueRepository(withRepos(['dawn/app', 'dawn/docs']))).toThrow(
      /links several repositories \(dawn\/app, dawn\/docs\).*ISSUE_REPOSITORY/,
    )
    const client = toClientMeta(withRepos([]), '2026-09-20')
    expect(client).not.toHaveProperty('issueRepository')
    expect(client.issueSetupError).toMatch(/isn't linked/)
  })
})

describe('toClientMeta', () => {
  it('tags statuses with their keys and picks the current iteration', () => {
    const client = toClientMeta(META, '2026-09-28')
    expect(client.statuses.find((s) => s.name === 'Blocked')).toEqual({
      id: 'S_blk',
      name: 'Blocked',
      key: 'blocked',
      color: 'RED',
    })
    // No color from GitHub: left out (the browser shows GRAY).
    expect(client.statuses.find((s) => s.name === 'In progress')).not.toHaveProperty('color')
    expect(client.currentIterationId).toBe('I_2')
    expect(toClientMeta(META, '2026-09-29').currentIterationId).toBe('I_3')
    expect(toClientMeta(META, '2026-12-01').currentIterationId).toBeNull()
  })
})
