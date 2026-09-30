import { useId } from 'react'
import type { TeamMember } from '../../lib/tasks'
import Avatar from '../Avatar'
import { assigneeOptions } from './todoFieldStyles'

interface AssigneePickerProps {
  /** Logins; [] = for everyone. */
  value: readonly string[]
  onChange: (logins: string[]) => void
  team: readonly TeamMember[]
  login: string
  /** Visible label style; the default matches the quick-add form. */
  labelClassName?: string
}

/**
 * Pick any number of teammates. None picked = the to-do is for everyone, so it's shown
 * without a label. A labelled group of checkboxes: Tab moves between people, Space toggles.
 */
export function AssigneePicker({
  value,
  onChange,
  team,
  login,
  labelClassName = 'text-sm font-medium',
}: AssigneePickerProps) {
  const hintId = useId()
  const picked = (l: string) => value.some((v) => v.toLowerCase() === l.toLowerCase())
  const toggle = (l: string, on: boolean) =>
    onChange(on ? [...value, l] : value.filter((v) => v.toLowerCase() !== l.toLowerCase()))

  return (
    <fieldset aria-describedby={hintId}>
      <legend className={labelClassName}>Assigned to</legend>
      <p id={hintId} className="mt-0.5 text-xs text-ink-muted">
        Leave empty if it&apos;s for everyone.
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {assigneeOptions(team, login, value).map((o) => (
          <label
            key={o.login}
            className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-border py-1 pr-3 pl-1.5 text-sm text-ink transition-colors hover:border-link has-checked:border-link has-checked:bg-link/10"
          >
            <input
              type="checkbox"
              checked={picked(o.login)}
              onChange={(e) => toggle(o.login, e.target.checked)}
              className="size-4 cursor-pointer accent-link"
            />
            <Avatar person={o} size="xs" />
            {o.login.toLowerCase() === login.toLowerCase() ? `${o.name} (me)` : o.name}
          </label>
        ))}
      </div>
    </fieldset>
  )
}
