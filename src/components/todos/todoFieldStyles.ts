import type { TeamMember } from '../../lib/tasks'

export const TODO_FIELD =
  'w-full rounded-xl border border-border bg-surface px-3.5 py-2 text-sm text-ink'

export const TITLE_MAX = 200
export const DESCRIPTION_MAX = 2000

/**
 * Who a to-do can be assigned to: the team list, or (if it hasn't loaded) just the signed-in
 * user. An assignee missing from the list is kept as an option so a save never drops it.
 */
export function assigneeOptions(
  team: readonly TeamMember[],
  login: string,
  current?: string,
): { login: string; name: string }[] {
  const options =
    team.length > 0
      ? team.map((m) => ({ login: m.login, name: m.name }))
      : [{ login, name: `${login} (me)` }]
  if (current && !options.some((o) => o.login.toLowerCase() === current.toLowerCase())) {
    options.push({ login: current, name: current })
  }
  return options
}
