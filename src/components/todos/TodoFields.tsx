import type { TeamMember } from '../../lib/tasks'
import { assigneeOptions, TODO_FIELD } from './todoFieldStyles'

interface AssigneeSelectProps {
  id: string
  value: string
  onChange: (login: string) => void
  team: readonly TeamMember[]
  login: string
  className?: string
}

/** "Unassigned" plus the team; the value is a login ("" = unassigned). */
export function AssigneeSelect({
  id,
  value,
  onChange,
  team,
  login,
  className,
}: AssigneeSelectProps) {
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={className ?? TODO_FIELD}
    >
      <option value="">Unassigned</option>
      {assigneeOptions(team, login, value || undefined).map((o) => (
        <option key={o.login} value={o.login}>
          {o.name}
        </option>
      ))}
    </select>
  )
}
