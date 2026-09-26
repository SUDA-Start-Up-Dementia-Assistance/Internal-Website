import { MOCK_USER } from '../auth/mock'
import { toDateKey } from '../drive/parse'
import type {
  Assignee,
  IterationOption,
  StatusKey,
  StatusOption,
  Task,
  TaskMeta,
  TasksResponse,
  TeamMember,
} from './types'

/*
 * Fake /api/tasks data for VITE_TASKS_MOCK=true. Dates are relative to today, so there's
 * always a running sprint, an overdue task, and something due soon. Covers: drafts, issues
 * and a PR; a Blocked item; an item with no Story Points; a "Sprint Backlog" item with no
 * iteration; and items across two iterations.
 */

const PROJECT_URL = 'https://github.com/orgs/dawn-team/projects/1'
const REPO = 'dawn-team/dawn-app'

function dayKey(today: Date, offset: number): string {
  return toDateKey(new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset))
}

/** Name, key, and the color each option has on the real board. */
const STATUSES: [string, StatusKey, string][] = [
  ['Product Backlog', 'productBacklog', 'GREEN'],
  ['Sprint Backlog', 'sprintBacklog', 'BLUE'],
  ['In progress', 'inProgress', 'YELLOW'],
  ['In review', 'inReview', 'PURPLE'],
  ['Done', 'done', 'ORANGE'],
  ['Blocked', 'blocked', 'RED'],
]

const options = (names: string[], prefix: string) =>
  names.map((name) => ({ id: `${prefix}_${name.replace(/\W/g, '')}`, name }))

const TEAM: TeamMember[] = [
  { id: 'U_me', login: MOCK_USER.login, name: MOCK_USER.name, avatarUrl: '' },
  { id: 'U_rb', login: 'river-b', name: 'River Bennett', avatarUrl: '' },
  { id: 'U_sk', login: 'sam-k', name: 'Sam Kowalski', avatarUrl: '' },
  { id: 'U_pn', login: 'priya-n', name: 'Priya Natarajan', avatarUrl: '' },
]

const person = (login: string): Assignee => ({
  login,
  avatarUrl: TEAM.find((m) => m.login === login)?.avatarUrl ?? '',
})

const ME = MOCK_USER.login

export function createMockTasks(today = new Date()): TasksResponse {
  // Two-week sprints; the current one started 4 days ago.
  const iterations: IterationOption[] = [
    { id: 'IT_3', title: 'Sprint 3', startDate: dayKey(today, -18), duration: 14, completed: true },
    { id: 'IT_4', title: 'Sprint 4', startDate: dayKey(today, -4), duration: 14, completed: false },
    { id: 'IT_5', title: 'Sprint 5', startDate: dayKey(today, 10), duration: 14, completed: false },
  ]
  const [previous, current, next] = iterations.map(({ id, title, startDate, duration }) => ({
    id,
    title,
    startDate,
    duration,
  }))

  let n = 0
  const task = (fields: Partial<Task> & Pick<Task, 'title'> & { key?: StatusKey }): Task => {
    n += 1
    const { key = 'sprintBacklog', ...rest } = fields
    const kind = rest.kind ?? 'draft'
    const number = 40 + n
    return {
      itemId: `PVTI_mock${n}`,
      contentId: `${kind === 'draft' ? 'DI' : kind === 'pr' ? 'PR' : 'I'}_mock${n}`,
      kind,
      assignees: [],
      status: STATUSES.find(([, k]) => k === key)![0],
      statusKey: key,
      updatedAt: new Date(today.getTime() - n * 3_600_000).toISOString(),
      ...(kind === 'draft'
        ? {}
        : {
            url: `https://github.com/${REPO}/${kind === 'pr' ? 'pull' : 'issues'}/${number}`,
            repo: REPO,
            number,
          }),
      ...rest,
    }
  }

  const tasks: Task[] = [
    // Mine, current sprint
    task({
      title: 'Wire the morning greeting to the caregiver schedule',
      kind: 'issue',
      key: 'inProgress',
      assignees: [person(ME)],
      type: 'Dev',
      priority: 'P0',
      size: 'M',
      storyPoints: 5,
      estimateHours: 6,
      doneBy: dayKey(today, -2),
      iteration: current,
    }),
    task({
      title: 'Large-print weather card: contrast pass',
      kind: 'issue',
      key: 'blocked',
      assignees: [person(ME), person('priya-n')],
      type: 'Dev',
      priority: 'P1',
      size: 'S',
      storyPoints: 3,
      estimateHours: 4,
      doneBy: dayKey(today, 1),
      iteration: current,
    }),
    task({
      title: 'Draft usability test script for St. Ann’s visit',
      key: 'inReview',
      assignees: [person(ME)],
      type: 'Docs',
      priority: 'P1',
      size: 'S',
      storyPoints: 2,
      estimateHours: 3,
      doneBy: dayKey(today, 3),
      iteration: current,
    }),
    task({
      title: 'Update the sprint 4 retrospective notes',
      key: 'sprintBacklog',
      assignees: [person(ME)],
      type: 'Admin',
      priority: 'P2',
      size: 'XS',
      estimateHours: 1,
      doneBy: dayKey(today, 9),
      iteration: current,
    }),
    task({
      title: 'Research tablet kiosk mode options',
      key: 'sprintBacklog',
      assignees: [person(ME)],
      type: 'Dev',
      size: 'M',
      storyPoints: 3,
      iteration: current,
    }),
    task({
      title: 'Add “today is” date banner',
      kind: 'pr',
      key: 'done',
      assignees: [person(ME)],
      type: 'Dev',
      priority: 'P1',
      size: 'S',
      storyPoints: 2,
      estimateHours: 2,
      doneBy: dayKey(today, -1),
      iteration: current,
    }),
    // Teammates, current sprint
    task({
      title: 'Caregiver photo upload: resize on device',
      kind: 'issue',
      key: 'inProgress',
      assignees: [person('river-b')],
      type: 'Dev',
      priority: 'P0',
      size: 'L',
      storyPoints: 8,
      estimateHours: 10,
      doneBy: dayKey(today, 2),
      iteration: current,
    }),
    task({
      title: 'Offline cache for the daily schedule',
      kind: 'issue',
      key: 'blocked',
      assignees: [person('sam-k')],
      type: 'Dev',
      priority: 'P1',
      size: 'M',
      storyPoints: 5,
      estimateHours: 8,
      doneBy: dayKey(today, 5),
      iteration: current,
    }),
    task({
      title: 'Write the accessibility section of the design doc',
      key: 'sprintBacklog',
      assignees: [person('priya-n')],
      type: 'Docs',
      priority: 'P2',
      size: 'S',
      storyPoints: 3,
      estimateHours: 4,
      doneBy: dayKey(today, 8),
      iteration: current,
    }),
    task({
      title: 'Schedule the sponsor demo',
      key: 'done',
      assignees: [person('sam-k')],
      type: 'Admin',
      priority: 'P1',
      size: 'XS',
      storyPoints: 1,
      estimateHours: 1,
      doneBy: dayKey(today, -3),
      iteration: current,
    }),
    task({
      title: 'Spike: text-to-speech voices on the beta tablets',
      key: 'sprintBacklog',
      type: 'Dev',
      size: 'S',
      storyPoints: 2,
      doneBy: dayKey(today, 6),
      iteration: current,
    }),
    // In "Sprint Backlog" but no iteration: won't count toward the burndown.
    task({
      title: 'Night-mode color tokens',
      key: 'sprintBacklog',
      assignees: [person('river-b')],
      type: 'Dev',
      priority: 'P2',
      size: 'S',
      storyPoints: 3,
    }),
    // Previous sprint
    task({
      title: 'Set up CI for the tablet app',
      kind: 'issue',
      key: 'done',
      assignees: [person('sam-k')],
      type: 'Dev',
      priority: 'P0',
      size: 'M',
      storyPoints: 5,
      estimateHours: 6,
      doneBy: dayKey(today, -8),
      iteration: previous,
    }),
    task({
      title: 'Requirements review with the coach',
      key: 'done',
      assignees: [person(ME)],
      type: 'Admin',
      priority: 'P1',
      size: 'S',
      storyPoints: 2,
      doneBy: dayKey(today, -10),
      iteration: previous,
    }),
    // Next sprint and backlog
    task({
      title: 'Family message inbox',
      kind: 'issue',
      key: 'productBacklog',
      assignees: [person(ME)],
      type: 'Dev',
      priority: 'P1',
      size: 'L',
      storyPoints: 8,
      doneBy: dayKey(today, 20),
      iteration: next,
    }),
    task({
      title: 'Explore medication reminders',
      key: 'productBacklog',
      type: 'Dev',
      size: 'XL',
    }),
  ]

  const statuses: StatusOption[] = STATUSES.map(([name, key, color]) => ({
    id: `S_${key}`,
    name,
    key,
    color,
  }))
  const meta: TaskMeta = {
    projectUrl: PROJECT_URL,
    burndownUnit: 'storyPoints',
    statuses,
    storyPointOptions: options(['1', '2', '3', '5', '8', '13'], 'SP'),
    priorities: options(['P0', 'P1', 'P2'], 'PR'),
    sizes: options(['XS', 'S', 'M', 'L', 'XL'], 'SZ'),
    types: options(['Dev', 'Docs', 'Admin'], 'T'),
    hasEstimate: true,
    iterations,
    currentIterationId: current.id,
  }
  return { tasks, meta, team: TEAM }
}
