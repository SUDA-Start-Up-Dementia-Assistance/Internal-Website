import { TriangleAlert, X } from 'lucide-react'
import { useState } from 'react'
import { githubLink, type Task } from '../../lib/tasks'
import { readPreference, writePreference } from '../../lib/storage'
import ExternalLinkLabel from '../ExternalLinkLabel'

const STORAGE_KEY = 'dawn.tasks.unscheduledNoticeDismissed'

/**
 * Warns about "Sprint Backlog" items with no iteration. Dismissing hides it for exactly this
 * set of items: if a new one shows up, the notice comes back.
 */
export default function UnscheduledNotice({
  tasks,
  projectUrl,
}: {
  tasks: Task[]
  projectUrl: string
}) {
  const signature = tasks
    .map((t) => t.itemId)
    .sort()
    .join(',')
  // The set of items last dismissed ('' if none, or if it was a different set).
  const [dismissedSet, setDismissedSet] = useState(() =>
    readPreference(STORAGE_KEY, [signature], ''),
  )
  if (tasks.length === 0 || dismissedSet === signature) return null

  function dismiss() {
    writePreference(STORAGE_KEY, signature)
    setDismissedSet(signature)
  }

  const count = tasks.length === 1 ? '1 item is' : `${tasks.length} items are`
  return (
    <section
      aria-labelledby="unscheduled-title"
      className="shadow-card flex gap-3 rounded-2xl border border-link/30 bg-surface p-4"
    >
      <TriangleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-link" />
      <div className="min-w-0 flex-1">
        <h2 id="unscheduled-title" className="font-body font-medium">
          {count} in Sprint Backlog without an iteration
        </h2>
        <p className="mt-1 text-sm text-ink-muted">
          These won&apos;t count toward the burndown. Set an iteration on each in GitHub.
        </p>
        <ul className="mt-2 space-y-1 text-sm">
          {tasks.map((task) => {
            const link = githubLink(task, projectUrl)
            return (
              <li key={task.itemId}>
                <a
                  href={link.href}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-link underline-offset-4 hover:underline"
                >
                  {task.title}
                  <ExternalLinkLabel />
                </a>
              </li>
            )
          })}
        </ul>
      </div>
      <button
        type="button"
        onClick={dismiss}
        className="-m-1 self-start rounded-full p-1.5 text-ink-muted hover:bg-ink/5 hover:text-ink"
      >
        <X aria-hidden="true" className="size-4" />
        <span className="sr-only">Dismiss this notice</span>
      </button>
    </section>
  )
}
