import type { TeamMember } from '../../lib/tasks'

export const TODO_FIELD =
  'w-full rounded-xl border border-border bg-surface px-3.5 py-2 text-sm text-ink'

export const TITLE_MAX = 200
export const DESCRIPTION_MAX = 2000

/**
 * Who a to-do can be assigned to: the team list, or (if it hasn't loaded) just the signed-in
 * user. Current assignees missing from the list are kept as options so a save never drops them.
 */
export function assigneeOptions(
  team: readonly TeamMember[],
  login: string,
  current: readonly string[] = [],
): { login: string; name: string; avatarUrl: string }[] {
  const options =
    team.length > 0
      ? team.map((m) => ({ login: m.login, name: m.name, avatarUrl: m.avatarUrl }))
      : [{ login, name: login, avatarUrl: '' }]
  for (const a of current) {
    if (!options.some((o) => o.login.toLowerCase() === a.toLowerCase())) {
      options.push({ login: a, name: a, avatarUrl: '' })
    }
  }
  return options
}
