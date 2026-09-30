import { BlobPreconditionFailedError, del, list, put } from '@vercel/blob'
import { blobToken, readJsonBlob } from './blob.js'
import { parseDateKey } from './dates.js'
import { listTeam } from './github/project.js'
import type { TeamMember } from './github/types.js'
import type { SessionUser } from './session.js'
import { InputError } from './taskInput.js'

/*
 * Team to-dos: small chores ("Email Gerry…") that never touch GitHub. Each lives in the
 * PRIVATE Blob store as todos/<id>.json, so edits to different items never collide. Every
 * PATCH/DELETE carries the item's `version`; a mismatch is a 409 and nothing changes.
 * createdBy/updatedBy/doneBy always come from the session, never from the request body.
 */

export interface Todo {
  id: string
  title: string
  description?: string
  /** "YYYY-MM-DD", a calendar date in America/New_York. */
  dueDate?: string
  /** GitHub logins. [] = not assigned to anyone in particular: it's for the whole team. */
  assignees: string[]
  done: boolean
  doneBy?: string
  /** ISO instant. */
  doneAt?: string
  createdBy: string
  createdAt: string
  updatedBy: string
  updatedAt: string
  version: number
}

export const TODO_TITLE_MAX = 200
export const TODO_DESCRIPTION_MAX = 2000
/** More than a team's worth is a mistake. */
export const TODO_ASSIGNEES_MAX = 20
/** Done items older than this stay stored but aren't listed. */
export const DONE_VISIBLE_DAYS = 14
export const LIST_CACHE_MS = 15_000
/** The smallest cache lifetime @vercel/blob accepts (reads bypass the cache anyway). */
const BLOB_CACHE_SECONDS = 60
const TEAM_CACHE_MS = 5 * 60_000

/** The item was changed (or deleted) since the client read it. */
export class TodoConflictError extends Error {
  constructor() {
    super('This to-do was changed by someone else. Reload to see the latest version.')
    this.name = 'TodoConflictError'
  }
}

export class TodoNotFoundError extends Error {
  constructor() {
    super('That to-do no longer exists.')
    this.name = 'TodoNotFoundError'
  }
}

// ─── Validation ──────────────────────────────────────────────────────────────

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

export function isTodoId(value: unknown): value is string {
  return typeof value === 'string' && UUID.test(value)
}

export function parseTodoId(value: unknown): string {
  if (!isTodoId(value)) throw new InputError('That isn’t a valid to-do id.')
  return value
}

function parseTitle(value: unknown): string {
  if (typeof value !== 'string') throw new InputError('A to-do needs a title.')
  const title = value.trim()
  if (!title) throw new InputError('A to-do needs a title.')
  if (title.length > TODO_TITLE_MAX) {
    throw new InputError(`Keep the title under ${TODO_TITLE_MAX} characters.`)
  }
  return title
}

/** A description, or undefined to clear it (null or blank). */
function parseDescription(value: unknown): string | undefined {
  if (value === null) return undefined
  if (typeof value !== 'string') throw new InputError('The description must be text.')
  const text = value.trim()
  if (text.length > TODO_DESCRIPTION_MAX) {
    throw new InputError(`Keep the description under ${TODO_DESCRIPTION_MAX} characters.`)
  }
  return text || undefined
}

function parseDueDate(value: unknown): string | undefined {
  if (value === null || value === '') return undefined
  if (typeof value !== 'string' || parseDateKey(value) !== value) {
    throw new InputError('The due date must be a real date (YYYY-MM-DD).')
  }
  return value
}

/** A list of logins (null means none). Membership is checked later, against the team list. */
function parseAssignees(value: unknown): string[] {
  if (value === null) return []
  if (!Array.isArray(value) || !value.every((v) => typeof v === 'string')) {
    throw new InputError('Assignees must be a list of GitHub logins.')
  }
  const logins = value.map((v: string) => v.trim()).filter(Boolean)
  if (logins.length > TODO_ASSIGNEES_MAX) {
    throw new InputError(`A to-do can have at most ${TODO_ASSIGNEES_MAX} assignees.`)
  }
  return logins
}

function parseVersion(value: unknown): number {
  const version = typeof value === 'string' && value !== '' ? Number(value) : value
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    throw new InputError('Send the to-do’s current version with this change.')
  }
  return version
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export interface CreateTodoInput {
  title: string
  description?: string
  dueDate?: string
  assignees: string[]
}

/** POST body → input. Anything else in the body (createdBy, done, …) is ignored. */
export function parseCreateTodo(body: unknown): CreateTodoInput {
  if (!isObject(body)) throw new InputError('Send the to-do as JSON.')
  const input: CreateTodoInput = {
    title: parseTitle(body.title),
    assignees: parseAssignees(body.assignees ?? null),
  }
  const description = parseDescription(body.description ?? null)
  const dueDate = parseDueDate(body.dueDate ?? null)
  if (description) input.description = description
  if (dueDate) input.dueDate = dueDate
  return input
}

/**
 * Only the keys present change. `null` (or "") clears an optional field; an absent key is
 * never a clear.
 */
export interface PatchTodoInput {
  version: number
  changes: {
    title?: string
    description?: string | null
    dueDate?: string | null
    /** The full new list; [] unassigns everyone. */
    assignees?: string[]
    done?: boolean
  }
}

export function parsePatchTodo(body: unknown): PatchTodoInput {
  if (!isObject(body)) throw new InputError('Send the change as JSON.')
  const version = parseVersion(body.version)
  const changes: PatchTodoInput['changes'] = {}
  const has = (key: string) => Object.hasOwn(body, key) && body[key] !== undefined
  if (has('title')) changes.title = parseTitle(body.title)
  if (has('description')) changes.description = parseDescription(body.description) ?? null
  if (has('dueDate')) changes.dueDate = parseDueDate(body.dueDate) ?? null
  if (has('assignees')) changes.assignees = parseAssignees(body.assignees)
  if (has('done')) {
    if (typeof body.done !== 'boolean') throw new InputError('"done" must be true or false.')
    changes.done = body.done
  }
  if (Object.keys(changes).length === 0) throw new InputError('There’s nothing to change.')
  return { version, changes }
}

/** The login as the team list spells it, or a 400 if it isn't a current org member. */
export function checkAssignee(login: string, members: readonly string[]): string {
  const match = members.find((m) => m.toLowerCase() === login.toLowerCase())
  if (!match) throw new InputError(`${login} isn’t a member of the team’s GitHub organization.`)
  return match
}

/** Every login checked against the team list, spelled as it spells them, without repeats. */
export function checkAssignees(logins: readonly string[], members: readonly string[]): string[] {
  const checked = logins.map((login) => checkAssignee(login, members))
  return checked.filter((login, i) => checked.indexOf(login) === i)
}

/** A stored file as a Todo, or null if it isn't one. */
export function parseStoredTodo(raw: unknown): Todo | null {
  if (!isObject(raw)) return null
  // Files written before multiple assignees stored one login as `assignee`.
  const t = raw as Partial<Todo> & { assignee?: unknown }
  const ok =
    isTodoId(t.id) &&
    typeof t.title === 'string' &&
    typeof t.done === 'boolean' &&
    typeof t.createdBy === 'string' &&
    typeof t.createdAt === 'string' &&
    typeof t.updatedBy === 'string' &&
    typeof t.updatedAt === 'string' &&
    typeof t.version === 'number'
  if (!ok) return null
  const todo: Todo = {
    id: t.id!,
    title: t.title!,
    done: t.done!,
    createdBy: t.createdBy!,
    createdAt: t.createdAt!,
    updatedBy: t.updatedBy!,
    updatedAt: t.updatedAt!,
    version: t.version!,
    assignees: Array.isArray(t.assignees)
      ? t.assignees.filter((a): a is string => typeof a === 'string')
      : typeof t.assignee === 'string'
        ? [t.assignee]
        : [],
  }
  if (typeof t.description === 'string') todo.description = t.description
  if (typeof t.dueDate === 'string' && parseDateKey(t.dueDate) === t.dueDate)
    todo.dueDate = t.dueDate
  if (typeof t.doneBy === 'string') todo.doneBy = t.doneBy
  if (typeof t.doneAt === 'string') todo.doneAt = t.doneAt
  return todo
}

/** Open items, plus items done within the last 14 days. */
export function isListed(todo: Todo, now: Date): boolean {
  if (!todo.done) return true
  const doneAt = todo.doneAt ? Date.parse(todo.doneAt) : NaN
  // A done item with no usable timestamp is treated as old.
  return Number.isFinite(doneAt) && now.getTime() - doneAt <= DONE_VISIBLE_DAYS * 86_400_000
}

// ─── Team (assignee check) ───────────────────────────────────────────────────

let teamCache: { expires: number; members: TeamMember[] } | null = null

/** Current org members (cached briefly per instance; the team is team-wide data). */
export async function teamMembers(token: string, now = Date.now()): Promise<TeamMember[]> {
  if (teamCache && teamCache.expires > now) return teamCache.members
  const members = await listTeam(token)
  teamCache = { expires: now + TEAM_CACHE_MS, members }
  return members
}

/** Current org member logins, for the assignee check. */
export async function teamLogins(token: string, now = Date.now()): Promise<string[]> {
  return (await teamMembers(token, now)).map((m) => m.login)
}

// ─── Storage ─────────────────────────────────────────────────────────────────

const PREFIX = 'todos/'

export function todoPath(id: string): string {
  if (!isTodoId(id)) throw new Error('Bad to-do id for a blob path')
  return `${PREFIX}${id}.json`
}

async function readTodo(id: string): Promise<{ todo: Todo; etag: string } | null> {
  const result = await readJsonBlob(todoPath(id))
  if (!result) return null
  const todo = parseStoredTodo(result.data)
  if (!todo || todo.id !== id) {
    console.error(`[todos] ignoring malformed ${todoPath(id)}`)
    return null
  }
  return { todo, etag: result.etag }
}

/** Writes `todo`: over exactly the version read (`etag`), or as a new file. */
async function writeTodo(todo: Todo, etag?: string): Promise<void> {
  try {
    await put(todoPath(todo.id), JSON.stringify(todo), {
      access: 'private',
      token: blobToken(),
      contentType: 'application/json',
      addRandomSuffix: false,
      cacheControlMaxAge: BLOB_CACHE_SECONDS,
      ...(etag ? { ifMatch: etag } : { allowOverwrite: false }),
    })
  } catch (err) {
    // Someone else wrote between our read and this write.
    if (err instanceof BlobPreconditionFailedError) throw new TodoConflictError()
    throw err
  } finally {
    invalidateTodosCache()
  }
}

/*
 * The list is cached for up to 15 seconds per instance. Any write in this instance clears it,
 * and a list that started before a write never repopulates the cache with older data.
 */
let listCache: { expires: number; todos: Todo[] } | null = null
let generation = 0

export function invalidateTodosCache(): void {
  listCache = null
  generation += 1
}

/** Every stored to-do, including old done ones. */
async function readAllTodos(): Promise<Todo[]> {
  const token = blobToken()
  const ids: string[] = []
  let cursor: string | undefined
  do {
    const page = await list({ prefix: PREFIX, token, cursor, limit: 1000 })
    for (const blob of page.blobs) {
      const name = blob.pathname.slice(PREFIX.length)
      const id = name.endsWith('.json') ? name.slice(0, -'.json'.length) : ''
      if (isTodoId(id)) ids.push(id)
    }
    cursor = page.hasMore ? page.cursor : undefined
  } while (cursor)
  const results = await Promise.all(ids.map(readTodo))
  return results.filter((r) => r !== null).map((r) => r.todo)
}

/** Open to-dos plus those done in the last 14 days, oldest first. */
export async function listTodos(now = new Date()): Promise<Todo[]> {
  let all: Todo[]
  if (listCache && listCache.expires > now.getTime()) {
    all = listCache.todos
  } else {
    const started = generation
    all = await readAllTodos()
    if (started === generation) listCache = { expires: now.getTime() + LIST_CACHE_MS, todos: all }
  }
  return all
    .filter((t) => isListed(t, now))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
}

/** Looks up org members only when assignees are being set. */
export type MembersLookup = () => Promise<readonly string[]>

export async function createTodo(
  body: unknown,
  user: SessionUser,
  members: MembersLookup,
  now = new Date(),
): Promise<Todo> {
  const input = parseCreateTodo(body)
  if (input.assignees.length > 0) input.assignees = checkAssignees(input.assignees, await members())
  const at = now.toISOString()
  const todo: Todo = {
    id: crypto.randomUUID(),
    ...input,
    done: false,
    createdBy: user.login,
    createdAt: at,
    updatedBy: user.login,
    updatedAt: at,
    version: 1,
  }
  await writeTodo(todo)
  return todo
}

/** Applies a validated patch. Pure: no I/O. */
export function applyTodoPatch(
  todo: Todo,
  changes: PatchTodoInput['changes'],
  user: SessionUser,
  now: Date,
): Todo {
  const next: Todo = { ...todo }
  const setOptional = <K extends 'description' | 'dueDate'>(
    key: K,
    value: string | null | undefined,
  ) => {
    if (value === undefined) return
    if (value === null) delete next[key]
    else next[key] = value
  }
  if (changes.title !== undefined) next.title = changes.title
  setOptional('description', changes.description)
  setOptional('dueDate', changes.dueDate)
  if (changes.assignees !== undefined) next.assignees = changes.assignees
  if (changes.done === true && !todo.done) {
    next.done = true
    next.doneBy = user.login
    next.doneAt = now.toISOString()
  } else if (changes.done === false) {
    next.done = false
    delete next.doneBy
    delete next.doneAt
  }
  next.updatedBy = user.login
  next.updatedAt = now.toISOString()
  next.version = todo.version + 1
  return next
}

export async function updateTodo(
  id: string,
  body: unknown,
  user: SessionUser,
  members: MembersLookup,
  now = new Date(),
): Promise<Todo> {
  const { version, changes } = parsePatchTodo(body)
  const current = await readTodo(id)
  if (!current) throw new TodoNotFoundError()
  if (current.todo.version !== version) throw new TodoConflictError()
  if (changes.assignees?.length) {
    changes.assignees = checkAssignees(changes.assignees, await members())
  }
  const next = applyTodoPatch(current.todo, changes, user, now)
  await writeTodo(next, current.etag)
  return next
}

export async function deleteTodo(id: string, rawVersion: unknown): Promise<void> {
  const version = parseVersion(rawVersion)
  const current = await readTodo(id)
  if (!current) throw new TodoNotFoundError()
  if (current.todo.version !== version) throw new TodoConflictError()
  try {
    await del(todoPath(id), { token: blobToken(), ifMatch: current.etag })
  } catch (err) {
    if (err instanceof BlobPreconditionFailedError) throw new TodoConflictError()
    throw err
  } finally {
    invalidateTodosCache()
  }
}

/** For tests. */
export function resetTodosState(): void {
  invalidateTodosCache()
  teamCache = null
}
