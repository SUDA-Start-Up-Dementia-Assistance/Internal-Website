import { CalendarClock, ExternalLink, Repeat } from 'lucide-react'
import { formatCardDate } from '../../lib/dates'
import {
  doneByDate,
  githubLink,
  isBlocked,
  isDone,
  isOverdue,
  type Task,
  type TaskMeta,
} from '../../lib/tasks'
import { TaskStatusBadge } from './StatusBadge'

const BADGE = 'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium'

function PriorityBadge({ priority }: { priority: string }) {
  // The top priority gets the ember outline; the rest stay quiet.
  const urgent = /^p0$/i.test(priority)
  return (
    <span
      className={`${BADGE} border ${urgent ? 'border-ember text-ember' : 'border-night/15 text-dusk'}`}
    >
      <span className="sr-only">Priority </span>
      {priority}
    </span>
  )
}

/** "Done by Tue, Sep 29", in ember with "overdue" when it has passed. */
export function DoneByLabel({ task, today }: { task: Task; today?: Date }) {
  const date = doneByDate(task)
  if (!date) return null
  const overdue = isOverdue(task, today)
  return (
    <span className={`inline-flex items-center gap-1 ${overdue ? 'font-medium text-ember' : ''}`}>
      <CalendarClock aria-hidden="true" className="size-3.5" />
      Done by {formatCardDate(date, today)}
      {overdue && <span> · overdue</span>}
    </span>
  )
}

interface TaskRowProps {
  task: Task
  meta: Pick<TaskMeta, 'projectUrl' | 'statuses'>
  /** Hide the iteration when every row is in the same one. */
  showIteration?: boolean
  today?: Date
}

export default function TaskRow({ task, meta, showIteration = true, today }: TaskRowProps) {
  const link = githubLink(task, meta.projectUrl)
  const overdue = isOverdue(task, today)
  const blocked = isBlocked(task)

  return (
    <li
      // Every row has the 4px left border (transparent unless flagged) so titles line up.
      className={`rounded-2xl border-l-4 bg-surface p-4 shadow-card sm:px-5 ${
        overdue || blocked ? 'border-ember' : 'border-transparent'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <p className={`font-medium ${isDone(task) ? 'text-dusk line-through' : ''}`}>
          {task.title}
        </p>
        <a
          href={link.href}
          target="_blank"
          rel="noreferrer"
          title={link.label}
          className="-m-1.5 shrink-0 rounded-full p-1.5 text-dusk hover:bg-night/5 hover:text-ember"
        >
          <ExternalLink aria-hidden="true" className="size-4" />
          <span className="sr-only">
            {link.label}: {task.title} (opens in a new tab)
          </span>
        </a>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-dusk">
        <span className="flex flex-wrap items-center gap-1.5">
          <TaskStatusBadge task={task} meta={meta} />
          {task.type && (
            <span className={`${BADGE} border border-night/15 text-dusk`}>
              <span className="sr-only">Type </span>
              {task.type}
            </span>
          )}
          {task.priority && <PriorityBadge priority={task.priority} />}
        </span>
        {task.storyPoints !== undefined && (
          <span>
            {task.storyPoints} {task.storyPoints === 1 ? 'pt' : 'pts'}
          </span>
        )}
        {task.estimateHours !== undefined && (
          <span>
            {task.estimateHours}h<span className="sr-only"> estimated</span>
          </span>
        )}
        {task.size && (
          <span>
            <span className="sr-only">Size </span>
            {task.size}
          </span>
        )}
        <DoneByLabel task={task} today={today} />
        {showIteration && task.iteration && (
          <span className="inline-flex items-center gap-1">
            <Repeat aria-hidden="true" className="size-3.5" />
            {task.iteration.title}
          </span>
        )}
        {task.kind === 'draft' && <span className="text-xs">Draft</span>}
      </div>
    </li>
  )
}
