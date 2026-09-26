import { AlertCircle } from 'lucide-react'
import {
  statusOptionOf,
  tokensForStatusColor,
  type StatusOption,
  type Task,
  type TaskMeta,
} from '../../lib/tasks'

type StatusLike = Pick<StatusOption, 'name'> & Partial<Pick<StatusOption, 'key' | 'color'>>

/** The solid dot in a status's color. Decorative: the status name is always shown too. */
export function StatusDot({ color }: { color?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block size-1.5 shrink-0 rounded-full ${tokensForStatusColor(color).dot}`}
    />
  )
}

/**
 * The one status badge, used everywhere a status appears: a pill tinted with the option's
 * GitHub color. Never color alone: the name is always shown, and Blocked gets an alert icon
 * in place of the dot.
 */
export default function StatusBadge({ status }: { status: StatusLike }) {
  const tokens = tokensForStatusColor(status.color)
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${tokens.bg} ${tokens.text}`}
    >
      {status.key === 'blocked' ? (
        <AlertCircle aria-hidden="true" className="size-3.5 shrink-0" />
      ) : (
        <StatusDot color={status.color} />
      )}
      {status.name}
    </span>
  )
}

/** A task's status badge, colored from the project's status options. Nothing if unset. */
export function TaskStatusBadge({ task, meta }: { task: Task; meta: Pick<TaskMeta, 'statuses'> }) {
  const status = statusOptionOf(task, meta)
  return status ? <StatusBadge status={status} /> : null
}
