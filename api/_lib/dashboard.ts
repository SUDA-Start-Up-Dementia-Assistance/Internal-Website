import { businessDaysInclusive } from '../../src/lib/businessTime.js'
import { isUpcoming, meetingStart } from '../../src/lib/meetingTime.js'
import { selectDashboardTodos, type DashboardTodos } from '../../src/lib/todos/selectors.js'
import { aggregate } from './burndown.js'
import { BURNDOWN_UNIT } from './config.js'
import { addDays, findCurrentIteration, todayKey } from './dates.js'
import { ConfigError } from './env.js'
import { CalendarError, listMeetings, type Meeting } from './google/calendar.js'
import { GitHubApiError, ProjectSetupError, toClientError } from './github/errors.js'
import {
  getProjectMeta,
  listItems,
  toClientMeta,
  type ItemList,
  type ProjectMeta,
} from './github/project.js'
import { listMyPrs, listReviewQueue, type MyPr, type ReviewQueuePr } from './github/pulls.js'
import type { StatusOption, Task } from './github/types.js'
import type { SessionUser } from './session.js'
import { listTodos, teamMembers, type Todo } from './todos.js'

/*
 * GET /api/dashboard: every widget's data in one response. Each widget is computed on its
 * own: if one source fails, that widget becomes { error } and the others still return.
 * Responses are cached per user (by login) for 60 seconds, never shared across users.
 */

export interface WidgetError {
  error: { code: string; message: string }
}

/** A widget is its data, or { error } when its source failed. */
export type Widget<T> = T | WidgetError

export interface SprintSummary {
  id: string
  title: string
  /** "YYYY-MM-DD". */
  startDate: string
  /** The sprint's last day, "YYYY-MM-DD" (inclusive). */
  endDate: string
  /** Business days left, today included. */
  daysLeft: number
  /** Live totals for the sprint; null if tasks couldn't be read. */
  burndown: {
    unit: typeof BURNDOWN_UNIT
    scope: number
    done: number
    remaining: number
    unestimatedCount: number
  } | null
}

export interface MyTasks {
  /** Estimated done date before today, not Done. Up to 5 each, soonest first. */
  overdue: Task[]
  /** Due today through the next 6 days. */
  dueThisWeek: Task[]
  blocked: Task[]
  inProgress: Task[]
  counts: {
    overdue: number
    dueThisWeek: number
    blocked: number
    inProgress: number
    open: number
  }
  /** Project items GitHub hid from this user. */
  hiddenCount: number
  /** The project's status options (with colors) for badges and "Mark done"; [] if unknown. */
  statuses: StatusOption[]
}

export interface MeetingsWidget {
  /** False when the calendar isn't set up on this deployment. */
  connected: boolean
  /** The next 5 meetings (now through +14 days), not yet ended. Agendas are joined on the client. */
  meetings: Meeting[]
}

/** A person named in the to-dos widget. */
export interface TodoPerson {
  login: string
  name: string
  avatarUrl: string
}

/**
 * Up to 5 open team to-dos (mine and everyone's first), plus counts, and the names of the
 * people they're assigned to. `people` is [] if the team list couldn't be read: the widget
 * then shows logins instead of failing.
 */
export type TodosWidget = DashboardTodos<Todo> & { people: TodoPerson[] }

/** Mirrored for the browser with the dashboard UI. */
export interface DashboardResponse {
  me: SessionUser
  /** Null when no sprint is running today. */
  sprint: Widget<SprintSummary | null>
  tasks: Widget<MyTasks>
  reviewQueue: Widget<ReviewQueuePr[]>
  myPrs: Widget<MyPr[]>
  meetings: Widget<MeetingsWidget>
  todos: Widget<TodosWidget>
  generatedAt: string
}

/** Where each widget's data comes from. Swappable in tests. */
export interface DashboardSources {
  projectMeta(token: string): Promise<ProjectMeta>
  items(token: string): Promise<ItemList>
  reviewQueue(token: string, org: string, login: string, now: Date): Promise<ReviewQueuePr[]>
  myPrs(token: string, org: string): Promise<MyPr[]>
  meetings(fromKey: string, throughKey: string): Promise<Meeting[] | null>
  todos(now: Date): Promise<Todo[]>
  team(token: string): Promise<TodoPerson[]>
}

export const defaultSources: DashboardSources = {
  projectMeta: getProjectMeta,
  items: listItems,
  reviewQueue: listReviewQueue,
  myPrs: listMyPrs,
  meetings: listMeetings,
  todos: listTodos,
  team: teamMembers,
}

export interface DashboardContext {
  token: string
  user: SessionUser
  org: string
  now: Date
}

export const WIDGET_LIMIT = 5
export const MEETINGS_LIMIT = 5
export const MEETINGS_WINDOW_DAYS = 14
const CACHE_MS = 60_000
const MAX_CACHED_USERS = 100

// ─── Widgets ─────────────────────────────────────────────────────────────────

async function sprintWidget(
  ctx: DashboardContext,
  meta: Promise<ProjectMeta>,
  items: Promise<ItemList>,
): Promise<SprintSummary | null> {
  const today = todayKey(ctx.now)
  const current = findCurrentIteration((await meta).iteration.iterations, today)
  if (!current) return null
  const endDate = addDays(current.startDate, current.duration - 1)
  // Burndown is extra: a task-list failure leaves the sprint header intact.
  const burndown = await items.then(
    ({ tasks }) => ({ unit: BURNDOWN_UNIT, ...aggregate(tasks, current.id) }),
    () => null,
  )
  return {
    id: current.id,
    title: current.title,
    startDate: current.startDate,
    endDate,
    daysLeft: businessDaysInclusive(today, endDate),
    burndown,
  }
}

const PRIORITY_LAST = '￿'

/** Soonest Done-by first (none last), then priority (P0 first), then title. */
function byUrgency(a: Task, b: Task): number {
  return (
    (a.doneBy ?? PRIORITY_LAST).localeCompare(b.doneBy ?? PRIORITY_LAST) ||
    (a.priority ?? PRIORITY_LAST).localeCompare(b.priority ?? PRIORITY_LAST) ||
    a.title.localeCompare(b.title)
  )
}

export function groupMyTasks(
  list: ItemList,
  login: string,
  today: string,
  statuses: StatusOption[] = [],
): MyTasks {
  const mine = list.tasks.filter(
    (t) =>
      t.statusKey !== 'done' &&
      t.assignees.some((a) => a.login.toLowerCase() === login.toLowerCase()),
  )
  const weekEnd = addDays(today, 6)
  const groups = {
    overdue: mine.filter((t) => t.doneBy !== undefined && t.doneBy < today),
    dueThisWeek: mine.filter(
      (t) => t.doneBy !== undefined && t.doneBy >= today && t.doneBy <= weekEnd,
    ),
    blocked: mine.filter((t) => t.statusKey === 'blocked'),
    inProgress: mine.filter((t) => t.statusKey === 'inProgress'),
  }
  const top = (tasks: Task[]) => [...tasks].sort(byUrgency).slice(0, WIDGET_LIMIT)
  return {
    overdue: top(groups.overdue),
    dueThisWeek: top(groups.dueThisWeek),
    blocked: top(groups.blocked),
    inProgress: top(groups.inProgress),
    counts: {
      overdue: groups.overdue.length,
      dueThisWeek: groups.dueThisWeek.length,
      blocked: groups.blocked.length,
      inProgress: groups.inProgress.length,
      open: mine.length,
    },
    hiddenCount: list.hiddenCount,
    statuses,
  }
}

async function tasksWidget(
  ctx: DashboardContext,
  meta: Promise<ProjectMeta>,
  items: Promise<ItemList>,
): Promise<MyTasks> {
  const today = todayKey(ctx.now)
  // Statuses only color the badges and power "Mark done": a meta failure doesn't sink the list.
  const statuses = await meta.then((m) => toClientMeta(m, today).statuses).catch(() => [])
  return groupMyTasks(await items, ctx.user.login, today, statuses)
}

async function meetingsWidget(
  ctx: DashboardContext,
  sources: DashboardSources,
): Promise<MeetingsWidget> {
  const today = todayKey(ctx.now)
  // Whole days, so every user's dashboard shares the calendar's per-range cache.
  const all = await sources.meetings(today, addDays(today, MEETINGS_WINDOW_DAYS))
  if (all === null) return { connected: false, meetings: [] }
  const until = ctx.now.getTime() + MEETINGS_WINDOW_DAYS * 86_400_000
  const meetings = all
    .filter((m) => isUpcoming(m, ctx.now) && meetingStart(m).getTime() <= until)
    .slice(0, MEETINGS_LIMIT)
  return { connected: true, meetings }
}

async function todosWidget(ctx: DashboardContext, sources: DashboardSources): Promise<TodosWidget> {
  const todos = await sources.todos(ctx.now)
  const selected = selectDashboardTodos(todos, ctx.user.login, todayKey(ctx.now))
  const logins = new Set(selected.items.flatMap((t) => t.assignees.map((a) => a.toLowerCase())))
  if (logins.size === 0) return { ...selected, people: [] }
  // Names are a nicety: a team-list failure shows logins, never fails the widget. A dead
  // session still surfaces through the other widgets.
  const team = await sources.team(ctx.token).catch(() => [])
  const people = team
    .filter((m) => logins.has(m.login.toLowerCase()))
    .map(({ login, name, avatarUrl }) => ({ login, name, avatarUrl }))
  return { ...selected, people }
}

// ─── Assembly ────────────────────────────────────────────────────────────────

/** A failure as a widget's { error }: safe, client-facing codes and messages only. */
export function toWidgetError(err: unknown): WidgetError {
  if (err instanceof GitHubApiError) {
    console.error(`[dashboard] github ${err.kind} (${err.status}) ${err.detail}`)
    const { code, message } = toClientError(err)
    return { error: { code, message } }
  }
  if (err instanceof CalendarError) {
    console.error(`[dashboard] calendar ${err.code} (${err.status}) ${err.detail}`)
    return { error: { code: err.code, message: err.message } }
  }
  if (err instanceof ProjectSetupError) {
    return { error: { code: 'project-misconfigured', message: err.message } }
  }
  if (err instanceof ConfigError) {
    console.error(err.message)
    return { error: { code: 'server-misconfigured', message: err.message } }
  }
  console.error('[dashboard]', err)
  return { error: { code: 'internal', message: "This couldn't be loaded right now." } }
}

export function isWidgetError(value: unknown): value is WidgetError {
  return typeof value === 'object' && value !== null && 'error' in value
}

/**
 * Builds every widget independently. A dead GitHub session is the one failure that isn't
 * contained: it's rethrown so the route answers 401 and clears the cookie.
 */
export async function buildDashboard(
  ctx: DashboardContext,
  sources: DashboardSources = defaultSources,
): Promise<DashboardResponse> {
  // Shared by the sprint and tasks widgets; each is fetched once.
  const meta = sources.projectMeta(ctx.token)
  const items = sources.items(ctx.token)
  meta.catch(() => {})
  items.catch(() => {})

  const settled = await Promise.allSettled([
    sprintWidget(ctx, meta, items),
    tasksWidget(ctx, meta, items),
    sources.reviewQueue(ctx.token, ctx.org, ctx.user.login, ctx.now),
    sources.myPrs(ctx.token, ctx.org),
    meetingsWidget(ctx, sources),
    todosWidget(ctx, sources),
  ] as const)

  for (const result of settled) {
    if (
      result.status === 'rejected' &&
      result.reason instanceof GitHubApiError &&
      result.reason.kind === 'session-expired'
    ) {
      throw result.reason
    }
  }
  const value = <T>(result: PromiseSettledResult<T>): Widget<T> =>
    result.status === 'fulfilled' ? result.value : toWidgetError(result.reason)
  const [sprint, tasks, reviewQueue, myPrs, meetings, todos] = settled

  return {
    me: ctx.user,
    sprint: value(sprint),
    tasks: value(tasks),
    reviewQueue: value(reviewQueue),
    myPrs: value(myPrs),
    meetings: value(meetings),
    todos: value(todos),
    generatedAt: ctx.now.toISOString(),
  }
}

const cache = new Map<string, { expires: number; response: DashboardResponse }>()

/** For tests. */
export function clearDashboardCache(): void {
  cache.clear()
}

/**
 * The dashboard for ctx.user, from the per-user cache when it's under 60 seconds old. Only
 * complete responses (no widget errors) are cached, so a retry after a failure refetches.
 */
export async function getDashboard(
  ctx: DashboardContext,
  sources: DashboardSources = defaultSources,
): Promise<DashboardResponse> {
  const key = ctx.user.login.toLowerCase()
  const hit = cache.get(key)
  if (hit && hit.expires > ctx.now.getTime()) return hit.response

  const response = await buildDashboard(ctx, sources)
  const widgets = [
    response.sprint,
    response.tasks,
    response.reviewQueue,
    response.myPrs,
    response.meetings,
    response.todos,
  ]
  if (!widgets.some(isWidgetError)) {
    cache.delete(key)
    cache.set(key, { expires: ctx.now.getTime() + CACHE_MS, response })
    if (cache.size > MAX_CACHED_USERS) {
      const oldest = cache.keys().next().value
      if (oldest !== undefined) cache.delete(oldest)
    }
  }
  return response
}
