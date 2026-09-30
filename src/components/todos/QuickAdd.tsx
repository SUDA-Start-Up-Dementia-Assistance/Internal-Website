import { ChevronDown, Plus } from 'lucide-react'
import { useId, useRef, useState, type FormEvent } from 'react'
import type { TeamMember } from '../../lib/tasks'
import { addTodo, type NewTodo } from '../../lib/todos'
import { buttonClasses } from '../buttonStyles'
import { AssigneePicker } from './TodoFields'
import { DESCRIPTION_MAX, TITLE_MAX, TODO_FIELD } from './todoFieldStyles'

interface QuickAddProps {
  login: string
  team: readonly TeamMember[]
  autoFocus?: boolean
}

/**
 * "Add a to-do…": Enter creates it with just the title. "More" reveals the description, due
 * date, and assignees (none by default: it's for everyone) first. The new row shows at once.
 */
export default function QuickAdd({ login, team, autoFocus = false }: QuickAddProps) {
  const id = useId()
  const titleRef = useRef<HTMLInputElement>(null)
  const [title, setTitle] = useState('')
  const [more, setMore] = useState(false)
  const [description, setDescription] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [assignees, setAssignees] = useState<string[]>([])

  function submit(e: FormEvent) {
    e.preventDefault()
    const trimmed = title.trim()
    if (!trimmed) return
    const input: NewTodo = { title: trimmed }
    if (more) {
      if (description.trim()) input.description = description.trim()
      if (dueDate) input.dueDate = dueDate
      if (assignees.length > 0) input.assignees = assignees
    }
    void addTodo(input, login)
    setTitle('')
    setDescription('')
    setDueDate('')
    setAssignees([])
    titleRef.current?.focus()
  }

  return (
    <form
      onSubmit={submit}
      aria-label="Add a to-do"
      className="shadow-card rounded-2xl bg-surface p-4"
    >
      <div className="flex items-center gap-2">
        <Plus aria-hidden="true" className="size-5 shrink-0 text-ink-muted" />
        <label htmlFor={`${id}-title`} className="sr-only">
          New to-do
        </label>
        <input
          ref={titleRef}
          id={`${id}-title`}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Add a to-do…"
          maxLength={TITLE_MAX}
          autoFocus={autoFocus}
          autoComplete="off"
          className="min-w-0 flex-1 rounded-lg bg-transparent px-2 py-1.5 text-ink placeholder:text-ink-muted"
        />
        <button
          type="button"
          aria-expanded={more}
          aria-controls={`${id}-more`}
          onClick={() => setMore((m) => !m)}
          className="inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-sm font-medium text-ink-muted hover:bg-ink/5 hover:text-link"
        >
          More
          <ChevronDown
            aria-hidden="true"
            className={`size-4 transition-transform motion-reduce:transition-none ${more ? 'rotate-180' : ''}`}
          />
        </button>
      </div>
      {more && (
        <div
          id={`${id}-more`}
          className="mt-4 grid gap-4 border-t border-border pt-4 sm:grid-cols-2"
        >
          <div className="sm:col-span-2">
            <label htmlFor={`${id}-description`} className="text-sm font-medium">
              Description <span className="font-normal text-ink-muted">(optional)</span>
            </label>
            <textarea
              id={`${id}-description`}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={DESCRIPTION_MAX}
              rows={3}
              className={`mt-1.5 ${TODO_FIELD} resize-y`}
            />
          </div>
          <div>
            <label htmlFor={`${id}-due`} className="text-sm font-medium">
              Due date <span className="font-normal text-ink-muted">(optional)</span>
            </label>
            <input
              id={`${id}-due`}
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className={`mt-1.5 ${TODO_FIELD}`}
            />
          </div>
          <div className="sm:col-span-2">
            <AssigneePicker value={assignees} onChange={setAssignees} team={team} login={login} />
          </div>
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={!title.trim()}
              className={`${buttonClasses('primary', 'sm')} disabled:opacity-60`}
            >
              Add to-do
            </button>
          </div>
        </div>
      )}
    </form>
  )
}
