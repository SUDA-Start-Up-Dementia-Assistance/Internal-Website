import { AlertCircle } from 'lucide-react'
import { tokensForStatusColor, type StatusOption } from '../../lib/tasks'
import { StatusDot } from './StatusBadge'

interface StatusSelectProps {
  statuses: StatusOption[]
  /** The selected option id, or '' for none. */
  value: string
  onChange: (optionId: string) => void
  /** "pill": tinted like StatusBadge, for task rows. "field": a plain form field. */
  variant: 'pill' | 'field'
  id?: string
  'aria-label'?: string
  /** A name to show when the task's status isn't among the options (e.g. renamed). */
  unknownName?: string
}

/**
 * A native status <select>. Native options can't be colored reliably, so the selected
 * status's dot (or Blocked's alert icon) sits inside the closed select, and the pill variant
 * takes the StatusBadge tint. The name is always shown as text.
 */
export default function StatusSelect({
  statuses,
  value,
  onChange,
  variant,
  id,
  'aria-label': ariaLabel,
  unknownName,
}: StatusSelectProps) {
  const selected = statuses.find((s) => s.id === value)
  const tokens = tokensForStatusColor(selected?.color)
  const pill = variant === 'pill'
  const box = pill
    ? `min-h-6 rounded-full py-0.5 pr-7 pl-6 text-xs font-medium ${tokens.bg} ${tokens.text}`
    : 'w-full rounded-xl border border-border bg-surface py-2 pr-8 pl-8 text-sm text-ink'

  return (
    <span className={`relative items-center ${pill ? 'inline-flex' : 'flex'}`}>
      {selected && (
        <span
          className={`pointer-events-none absolute inline-flex ${pill ? `left-2.5 ${tokens.text}` : 'left-3.5 [&>span]:size-2'}`}
        >
          {selected.key === 'blocked' ? (
            <AlertCircle aria-hidden="true" className={`size-3.5 ${tokens.text}`} />
          ) : (
            <StatusDot color={selected.color} />
          )}
        </span>
      )}
      <select
        id={id}
        aria-label={ariaLabel}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={box}
      >
        {!selected && (
          <option value={value} disabled>
            {unknownName ?? 'No status'}
          </option>
        )}
        {statuses.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
    </span>
  )
}
