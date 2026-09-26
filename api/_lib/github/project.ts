import {
  BURNDOWN_UNIT,
  FIELD_NAMES,
  PROJECT_META_TTL_MS,
  REQUIRED_FIELDS,
  STATUS_NAMES,
  type FieldKey,
  type StatusKey,
} from '../config.js'
import { findCurrentIteration, parseDateKey, todayKey } from '../dates.js'
import { getProjectConfig } from '../env.js'
import { GitHubApiError, ProjectSetupError } from './errors.js'
import { graphql } from './graphql.js'
import type {
  Assignee,
  IterationOption,
  Option,
  StatusOption,
  Task,
  TaskMeta,
  TeamMember,
} from './types.js'

// ─── Project metadata ────────────────────────────────────────────────────────

/** A single-select option as GitHub returns it, with its board color. */
interface RawOption extends Option {
  color?: string | null
}

interface SelectField {
  id: string
  options: RawOption[]
}

interface IterationField {
  id: string
  iterations: IterationOption[]
}

interface PlainField {
  id: string
}

/** The project's fields, resolved by the names in config.ts. Optional fields may be absent. */
export interface ProjectMeta {
  projectId: string
  projectUrl: string
  status: SelectField
  iteration: IterationField
  doneBy: PlainField
  type?: SelectField
  storyPoints?: SelectField
  estimate?: PlainField
  priority?: SelectField
  size?: SelectField
}

const FIELD_DATA_TYPES: Record<FieldKey, string> = {
  status: 'SINGLE_SELECT',
  iteration: 'ITERATION',
  storyPoints: 'SINGLE_SELECT',
  estimate: 'NUMBER',
  priority: 'SINGLE_SELECT',
  size: 'SINGLE_SELECT',
  doneBy: 'DATE',
  type: 'SINGLE_SELECT',
}

const FIELD_KIND_LABELS: Record<string, string> = {
  SINGLE_SELECT: 'single select',
  ITERATION: 'iteration',
  NUMBER: 'number',
  DATE: 'date',
}

interface RawIteration {
  id: string
  title: string
  startDate: string
  duration: number
}

export interface RawField {
  id?: string
  name?: string
  dataType?: string
  options?: RawOption[]
  configuration?: { iterations?: RawIteration[]; completedIterations?: RawIteration[] }
}

const PROJECT_META_QUERY = /* GraphQL */ `
  query ProjectMeta($org: String!, $number: Int!) {
    organization(login: $org) {
      projectV2(number: $number) {
        id
        url
        fields(first: 100) {
          nodes {
            ... on ProjectV2FieldCommon {
              id
              name
              dataType
            }
            ... on ProjectV2SingleSelectField {
              options {
                id
                name
                color
              }
            }
            ... on ProjectV2IterationField {
              configuration {
                iterations {
                  id
                  title
                  startDate
                  duration
                }
                completedIterations {
                  id
                  title
                  startDate
                  duration
                }
              }
            }
          }
        }
      }
    }
  }
`

interface ProjectMetaData {
  organization: {
    projectV2: { id: string; url: string; fields: { nodes: (RawField | null)[] } } | null
  } | null
}

/**
 * Resolves every field from config.ts by name (case-insensitive). A missing or wrongly typed
 * REQUIRED field throws, naming it; a missing optional field is simply left out.
 */
export function resolveFields(
  project: { id: string; url: string },
  rawFields: readonly (RawField | null)[],
): ProjectMeta {
  const byName = new Map<string, RawField>()
  for (const field of rawFields) {
    if (field?.id && field.name) byName.set(field.name.trim().toLowerCase(), field)
  }

  const problems: string[] = []
  const found: Partial<Record<FieldKey, RawField>> = {}
  for (const key of Object.keys(FIELD_NAMES) as FieldKey[]) {
    const name = FIELD_NAMES[key]
    const expected = FIELD_DATA_TYPES[key]
    const field = byName.get(name.toLowerCase())
    const required = REQUIRED_FIELDS.includes(key)
    if (field && field.dataType === expected) {
      found[key] = field
    } else if (required) {
      problems.push(
        field
          ? `"${name}" must be a ${FIELD_KIND_LABELS[expected]} field`
          : `"${name}" (${FIELD_KIND_LABELS[expected]}) is missing`,
      )
    }
  }
  if (problems.length > 0) {
    // Listing what GitHub did return makes a renamed field obvious.
    const available = rawFields
      .filter((f): f is RawField => Boolean(f?.name))
      .map(
        (f) => `"${f.name}" (${FIELD_KIND_LABELS[f.dataType ?? ''] ?? f.dataType?.toLowerCase()})`,
      )
      .join(', ')
    throw new ProjectSetupError(
      `The GitHub Project isn't set up as expected: ${problems.join('; ')}. Check the field names in api/_lib/config.ts. The project's fields are: ${available || 'none'}.`,
    )
  }

  const select = (f: RawField): SelectField => ({ id: f.id!, options: f.options ?? [] })
  const plain = (f: RawField): PlainField => ({ id: f.id! })
  const optional = <T>(f: RawField | undefined, make: (f: RawField) => T) =>
    f ? make(f) : undefined

  return {
    projectId: project.id,
    projectUrl: project.url,
    status: select(found.status!),
    iteration: { id: found.iteration!.id!, iterations: iterationsOf(found.iteration!) },
    doneBy: plain(found.doneBy!),
    type: optional(found.type, select),
    storyPoints: optional(found.storyPoints, select),
    estimate: optional(found.estimate, plain),
    priority: optional(found.priority, select),
    size: optional(found.size, select),
  }
}

function iterationsOf(field: RawField): IterationOption[] {
  const config = field.configuration ?? {}
  const toOption = (it: RawIteration, completed: boolean): IterationOption | null => {
    const startDate = parseDateKey(it.startDate)
    return startDate
      ? { id: it.id, title: it.title, startDate, duration: it.duration, completed }
      : null
  }
  return [
    ...(config.completedIterations ?? []).map((it) => toOption(it, true)),
    ...(config.iterations ?? []).map((it) => toOption(it, false)),
  ]
    .filter((it): it is IterationOption => it !== null)
    .sort((a, b) => a.startDate.localeCompare(b.startDate))
}

interface CacheEntry {
  expires: number
  promise: Promise<ProjectMeta>
}

/** Per function instance. Holds the in-flight promise too, so parallel callers share it. */
const metaCache = new Map<string, CacheEntry>()

export function clearProjectMetaCache(): void {
  metaCache.clear()
}

/** Project id and fields, cached per function instance for PROJECT_META_TTL_MS. */
export function getProjectMeta(token: string): Promise<ProjectMeta> {
  const { org, projectNumber } = getProjectConfig()
  const cacheKey = `${org}#${projectNumber}`
  const cached = metaCache.get(cacheKey)
  if (cached && cached.expires > Date.now()) return cached.promise

  const promise = fetchProjectMeta(token, org, projectNumber)
  metaCache.set(cacheKey, { expires: Date.now() + PROJECT_META_TTL_MS, promise })
  // Never cache a failure.
  promise.catch(() => {
    if (metaCache.get(cacheKey)?.promise === promise) metaCache.delete(cacheKey)
  })
  return promise
}

async function fetchProjectMeta(token: string, org: string, number: number): Promise<ProjectMeta> {
  const data = await graphql<ProjectMetaData>(token, PROJECT_META_QUERY, { org, number })
  const project = data.organization?.projectV2
  // GitHub answers null (not an error) for projects the user can't see.
  if (!project) throw new GitHubApiError('no-access', 200, `project ${org}#${number} not visible`)
  return resolveFields(project, project.fields.nodes)
}

/** The browser's view of the metadata: option lists, iterations, and the current sprint. */
export function toClientMeta(meta: ProjectMeta, today = todayKey()): TaskMeta {
  // Statuses carry GitHub's color so badges match the board; other options don't need it.
  const statuses: StatusOption[] = meta.status.options.map((o) =>
    dropUndefined({
      id: o.id,
      name: o.name,
      key: statusKeyOf(o.name),
      color: o.color ?? undefined,
    }),
  )
  const plain = (options: RawOption[] | undefined): Option[] | undefined =>
    options?.map(({ id, name }) => ({ id, name }))
  const current = findCurrentIteration(meta.iteration.iterations, today)
  return dropUndefined({
    projectUrl: meta.projectUrl,
    burndownUnit: BURNDOWN_UNIT,
    statuses,
    storyPointOptions: plain(meta.storyPoints?.options),
    priorities: plain(meta.priority?.options),
    sizes: plain(meta.size?.options),
    types: plain(meta.type?.options),
    hasEstimate: Boolean(meta.estimate),
    iterations: meta.iteration.iterations,
    currentIterationId: current?.id ?? null,
  })
}

const STATUS_KEYS_BY_NAME = new Map(
  (Object.entries(STATUS_NAMES) as [StatusKey, string][]).map(([key, name]) => [
    name.toLowerCase(),
    key,
  ]),
)

export function statusKeyOf(name: string | null | undefined): StatusKey | null {
  return (name && STATUS_KEYS_BY_NAME.get(name.trim().toLowerCase())) || null
}

// ─── Items ───────────────────────────────────────────────────────────────────

interface RawFieldRef {
  id?: string
}

/** One entry of an item's fieldValues; only the kinds the site reads are queried. */
export type RawFieldValue =
  | {
      __typename: 'ProjectV2ItemFieldSingleSelectValue'
      optionId: string | null
      name: string | null
      field: RawFieldRef
    }
  | { __typename: 'ProjectV2ItemFieldNumberValue'; number: number | null; field: RawFieldRef }
  | { __typename: 'ProjectV2ItemFieldDateValue'; date: string | null; field: RawFieldRef }
  | {
      __typename: 'ProjectV2ItemFieldIterationValue'
      iterationId: string
      title: string
      startDate: string
      duration: number
      field: RawFieldRef
    }
  | { __typename: string; field?: RawFieldRef }

export type RawContent =
  | {
      __typename: 'DraftIssue'
      id: string
      title: string
      updatedAt: string
      assignees: { nodes: (Assignee | null)[] }
    }
  | {
      __typename: 'Issue' | 'PullRequest'
      id: string
      title: string
      url: string
      number: number
      updatedAt: string
      repository: { nameWithOwner: string }
      assignees: { nodes: (Assignee | null)[] }
    }

export interface RawItem {
  id: string
  isArchived: boolean
  updatedAt: string
  /** Null when the item is redacted (content in a repo the user can't see). */
  content: RawContent | null
  fieldValues: { nodes: (RawFieldValue | null)[] }
}

const FIELD_REF = 'field { ... on ProjectV2FieldCommon { id } }'
const ASSIGNEES = 'assignees(first: 20) { nodes { login avatarUrl } }'

const ITEMS_QUERY = /* GraphQL */ `
  query ProjectItems($org: String!, $number: Int!, $after: String) {
    organization(login: $org) {
      projectV2(number: $number) {
        items(first: 100, after: $after) {
          pageInfo {
            hasNextPage
            endCursor
          }
          nodes {
            id
            isArchived
            updatedAt
            content {
              __typename
              ... on DraftIssue {
                id
                title
                updatedAt
                ${ASSIGNEES}
              }
              ... on Issue {
                id
                title
                url
                number
                updatedAt
                repository { nameWithOwner }
                ${ASSIGNEES}
              }
              ... on PullRequest {
                id
                title
                url
                number
                updatedAt
                repository { nameWithOwner }
                ${ASSIGNEES}
              }
            }
            fieldValues(first: 50) {
              nodes {
                __typename
                ... on ProjectV2ItemFieldSingleSelectValue { optionId name ${FIELD_REF} }
                ... on ProjectV2ItemFieldNumberValue { number ${FIELD_REF} }
                ... on ProjectV2ItemFieldDateValue { date ${FIELD_REF} }
                ... on ProjectV2ItemFieldIterationValue {
                  iterationId
                  title
                  startDate
                  duration
                  ${FIELD_REF}
                }
              }
            }
          }
        }
      }
    }
  }
`

interface ItemsPage {
  organization: {
    projectV2: {
      items: {
        pageInfo: { hasNextPage: boolean; endCursor: string | null }
        nodes: (RawItem | null)[]
      }
    } | null
  } | null
}

/** Guard against a runaway cursor: 50 pages is 5,000 items, far past any sprint board. */
const MAX_PAGES = 50

export interface ItemList {
  tasks: Task[]
  /**
   * Non-archived items GitHub wouldn't show this user (content redacted: e.g. an issue in a
   * private repo the token can't read). Counted so the UI can say so instead of dropping
   * them silently.
   */
  hiddenCount: number
}

/** Every non-archived item, normalized, 100 per page. */
export async function listItems(token: string): Promise<ItemList> {
  const { org, projectNumber } = getProjectConfig()
  const [meta, raw] = await Promise.all([
    getProjectMeta(token),
    fetchAllItems(token, org, projectNumber),
  ])
  const tasks: Task[] = []
  let hiddenCount = 0
  for (const item of raw) {
    if (item.isArchived) continue
    const task = normalizeItem(item, meta)
    if (task) tasks.push(task)
    else if (!item.content) hiddenCount += 1
  }
  return { tasks, hiddenCount }
}

async function fetchAllItems(token: string, org: string, number: number): Promise<RawItem[]> {
  const items: RawItem[] = []
  let after: string | null = null
  for (let page = 0; page < MAX_PAGES; page++) {
    const data: ItemsPage = await graphql<ItemsPage>(token, ITEMS_QUERY, { org, number, after })
    const connection = data.organization?.projectV2?.items
    if (!connection)
      throw new GitHubApiError('no-access', 200, `project ${org}#${number} not visible`)
    for (const node of connection.nodes) if (node) items.push(node)
    if (!connection.pageInfo.hasNextPage || !connection.pageInfo.endCursor) return items
    after = connection.pageInfo.endCursor
  }
  console.warn(`[github] stopped after ${MAX_PAGES} pages of project items`)
  return items
}

const KINDS = { DraftIssue: 'draft', Issue: 'issue', PullRequest: 'pr' } as const

/**
 * A raw project item → Task, reading field values by the field ids in `meta`. Returns null
 * for archived and redacted items (and any content type the site doesn't handle).
 */
export function normalizeItem(item: RawItem, meta: ProjectMeta): Task | null {
  const content = item.content
  if (item.isArchived || !content || !(content.__typename in KINDS)) return null

  const values = new Map<string, RawFieldValue>()
  for (const value of item.fieldValues.nodes) {
    if (value?.field?.id) values.set(value.field.id, value)
  }
  const selectName = (field: SelectField | undefined): string | undefined => {
    const value = field && values.get(field.id)
    return value && 'name' in value && value.name ? value.name : undefined
  }
  const numberOf = (field: PlainField | undefined): number | undefined => {
    const value = field && values.get(field.id)
    return value && 'number' in value && typeof value.number === 'number' ? value.number : undefined
  }
  const dateOf = (field: PlainField): string | undefined => {
    const value = values.get(field.id)
    return value && 'date' in value ? parseDateKey(value.date) : undefined
  }
  const iterationValue = values.get(meta.iteration.id)
  const iteration = iterationValue && 'iterationId' in iterationValue ? iterationValue : undefined
  const iterationStart = iteration && parseDateKey(iteration.startDate)

  const status = selectName(meta.status) ?? null
  const task: Task = {
    itemId: item.id,
    contentId: content.id,
    kind: KINDS[content.__typename],
    title: content.title,
    assignees: content.assignees.nodes
      .filter((a): a is Assignee => a !== null)
      .map((a) => ({ login: a.login, avatarUrl: a.avatarUrl })),
    status,
    statusKey: statusKeyOf(status),
    storyPoints: parsePoints(selectName(meta.storyPoints)),
    estimateHours: numberOf(meta.estimate),
    priority: selectName(meta.priority),
    size: selectName(meta.size),
    doneBy: dateOf(meta.doneBy),
    type: selectName(meta.type),
    iteration:
      iteration && iterationStart
        ? {
            id: iteration.iterationId,
            title: iteration.title,
            startDate: iterationStart,
            duration: iteration.duration,
          }
        : undefined,
    updatedAt: later(item.updatedAt, content.updatedAt),
  }
  if (content.__typename !== 'DraftIssue') {
    task.url = content.url
    task.repo = content.repository.nameWithOwner
    task.number = content.number
  }
  return dropUndefined(task)
}

/** Story Points option name → number; unset or non-numeric ("?", "XL") → undefined. */
export function parsePoints(name: string | undefined): number | undefined {
  const trimmed = name?.trim()
  if (!trimmed || !/^\d+(\.\d+)?$/.test(trimmed)) return undefined
  return Number(trimmed)
}

function later(a: string, b: string): string {
  return Date.parse(b) > Date.parse(a) ? b : a
}

/** Keeps the JSON lean and makes "absent" mean absent (not `"x": undefined`). */
function dropUndefined<T extends object>(value: T): T {
  for (const key of Object.keys(value) as (keyof T)[]) {
    if (value[key] === undefined) delete value[key]
  }
  return value
}

// ─── Team ────────────────────────────────────────────────────────────────────

const TEAM_QUERY = /* GraphQL */ `
  query OrgMembers($org: String!, $after: String) {
    organization(login: $org) {
      membersWithRole(first: 100, after: $after) {
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          id
          login
          name
          avatarUrl
        }
      }
    }
  }
`

interface TeamPage {
  organization: {
    membersWithRole: {
      pageInfo: { hasNextPage: boolean; endCursor: string | null }
      nodes: ({ id: string; login: string; name: string | null; avatarUrl: string } | null)[]
    }
  } | null
}

/** Org members for assignee pickers and the Team view, sorted by display name. */
export async function listTeam(token: string): Promise<TeamMember[]> {
  const { org } = getProjectConfig()
  const members: TeamMember[] = []
  let after: string | null = null
  for (let page = 0; page < MAX_PAGES; page++) {
    const data: TeamPage = await graphql<TeamPage>(token, TEAM_QUERY, { org, after })
    const connection = data.organization?.membersWithRole
    if (!connection) throw new GitHubApiError('no-access', 200, `org ${org} not visible`)
    for (const m of connection.nodes) {
      if (m)
        members.push({ id: m.id, login: m.login, name: m.name || m.login, avatarUrl: m.avatarUrl })
    }
    if (!connection.pageInfo.hasNextPage || !connection.pageInfo.endCursor) break
    after = connection.pageInfo.endCursor
  }
  return members.sort((a, b) => a.name.localeCompare(b.name))
}
