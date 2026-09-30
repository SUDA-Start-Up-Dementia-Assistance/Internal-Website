import {
  CalendarClock,
  ChevronDown,
  CircleAlert,
  MoreHorizontal,
  Pencil,
  Trash2,
} from 'lucide-react'
import { useEffect, useId, useRef, useState, type FocusEvent, type KeyboardEvent } from 'react'
import type { TeamMember } from '../../lib/tasks'
import {
  doneLabel,
  dueLabel,
  editTodo,
  isPendingTodo,
  isTodoOverdue,
  personName,
  removeTodo,
  type Todo,
  type TodoChanges,
} from '../../lib/todos'
import Avatar from '../Avatar'
import ConfirmDeleteDialog from './ConfirmDeleteDialog'
import { AssigneeSelect } from './TodoFields'
import { DESCRIPTION_MAX, TITLE_MAX, TODO_FIELD } from './todoFieldStyles'

interface TodoRowProps {
  todo: Todo
  login: string
  team: readonly TeamMember[]
  /** Today's "YYYY-MM-DD" in America/New_York. */
  today: string
  now: Date
}

/**
 * One team to-do: a done checkbox, the title (click to edit inline), due date, assignee, an
 * expandable description, and an overflow menu with Edit and Delete. Every change is
 * optimistic; failures roll back with a toast (see useTodos).
 */
export default function TodoRow({ todo, login, team, today, now }: TodoRowProps) {
  const [editing, setEditing] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const titleButton = useRef<HTMLButtonElement>(null)
  const returnFocus = useRef(false)
  const descriptionId = useId()
  const pending = isPendingTodo(todo)
  const overdue = isTodoOverdue(todo, today)

  useEffect(() => {
    if (!editing && returnFocus.current) {
      returnFocus.current = false
      titleButton.current?.focus()
    }
  }, [editing])

  function stopEditing(refocus: boolean) {
    returnFocus.current = refocus
    setEditing(false)
  }

  return (
    <li
      aria-busy={pending || undefined}
      // Every row has the 4px left border (transparent unless overdue) so titles line up.
      className={`shadow-card rounded-2xl border-l-4 bg-surface p-4 sm:px-5 ${
        overdue ? 'border-link' : 'border-transparent'
      } ${pending ? 'opacity-70' : ''}`}
    >
      {editing ? (
        <EditForm todo={todo} login={login} team={team} onDone={stopEditing} />
      ) : (
        <div className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={todo.done}
            disabled={pending}
            aria-label={`Mark “${todo.title}” done`}
            onChange={(e) => void editTodo(todo.id, { done: e.target.checked }, login)}
            className="mt-1 size-4 shrink-0 cursor-pointer accent-link disabled:cursor-wait"
          />
          <div className="min-w-0 flex-1">
            <button
              ref={titleButton}
              type="button"
              disabled={pending}
              onClick={() => setEditing(true)}
              className={`group max-w-full rounded-sm text-left font-medium break-words hover:text-link disabled:cursor-wait ${
                todo.done ? 'text-ink-muted line-through' : ''
              }`}
            >
              {todo.title}
              <Pencil
                aria-hidden="true"
                className="ml-1.5 inline size-3.5 align-[-2px] text-ink-muted opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100"
              />
              <span className="sr-only"> (edit)</span>
            </button>
            <RowDetails todo={todo} team={team} overdue={overdue} now={now} />
            {expanded && todo.description && (
              <p
                id={descriptionId}
                className="mt-3 text-sm break-words whitespace-pre-line text-ink-muted"
              >
                {todo.description}
              </p>
            )}
          </div>
          <div className="-mr-1.5 flex shrink-0 items-center">
            {todo.description && (
              <button
                type="button"
                aria-expanded={expanded}
                aria-controls={expanded ? descriptionId : undefined}
                onClick={() => setExpanded((x) => !x)}
                className="rounded-full p-1.5 text-ink-muted hover:bg-ink/5 hover:text-link"
              >
                <ChevronDown
                  aria-hidden="true"
                  className={`size-4 transition-transform motion-reduce:transition-none ${expanded ? 'rotate-180' : ''}`}
                />
                <span className="sr-only">
                  {expanded ? 'Hide' : 'Show'} the description of “{todo.title}”
                </span>
              </button>
            )}
            {!pending && (
              <RowMenu
                title={todo.title}
                onEdit={() => setEditing(true)}
                onDelete={() => setConfirming(true)}
              />
            )}
          </div>
        </div>
      )}
      {confirming && (
        <ConfirmDeleteDialog
          title={todo.title}
          onConfirm={() => void removeTodo(todo.id)}
          onClose={() => setConfirming(false)}
        />
      )}
    </li>
  )
}

function RowDetails({
  todo,
  team,
  overdue,
  now,
}: {
  todo: Todo
  team: readonly TeamMember[]
  overdue: boolean
  now: Date
}) {
  const member = todo.assignee
    ? team.find((m) => m.login.toLowerCase() === todo.assignee!.toLowerCase())
    : undefined
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-ink-muted">
      {todo.done ? (
        <span>{doneLabel(todo, team, now)}</span>
      ) : (
        todo.dueDate && (
          <span
            className={`inline-flex items-center gap-1 ${overdue ? 'font-medium text-link' : ''}`}
          >
            {overdue ? (
              <CircleAlert aria-hidden="true" className="size-3.5" />
            ) : (
              <CalendarClock aria-hidden="true" className="size-3.5" />
            )}
            {overdue && <span>Overdue ·</span>}
            {dueLabel(todo.dueDate, now)}
          </span>
        )
      )}
      {todo.assignee ? (
        <span className="inline-flex items-center gap-1.5">
          <Avatar
            person={{ name: personName(todo.assignee, team), avatarUrl: member?.avatarUrl ?? '' }}
            size="sm"
          />
          <span className="sr-only">Assigned to </span>
          {personName(todo.assignee, team)}
        </span>
      ) : (
        <span>Unassigned</span>
      )}
    </div>
  )
}

/** Inline editing: Esc cancels; Enter (Shift+Enter for a new line in the description) or leaving the form saves. */
function EditForm({
  todo,
  login,
  team,
  onDone,
}: {
  todo: Todo
  login: string
  team: readonly TeamMember[]
  onDone: (refocus: boolean) => void
}) {
  const id = useId()
  const [title, setTitle] = useState(todo.title)
  const [description, setDescription] = useState(todo.description ?? '')
  const [dueDate, setDueDate] = useState(todo.dueDate ?? '')
  const [assignee, setAssignee] = useState(todo.assignee ?? '')
  const finished = useRef(false)

  function save(refocus: boolean) {
    if (finished.current) return
    finished.current = true
    const changes: TodoChanges = {}
    const trimmedTitle = title.trim()
    if (trimmedTitle && trimmedTitle !== todo.title) changes.title = trimmedTitle
    const trimmedDescription = description.trim()
    if (trimmedDescription !== (todo.description ?? '')) {
      changes.description = trimmedDescription || null
    }
    if (dueDate !== (todo.dueDate ?? '')) changes.dueDate = dueDate || null
    if (assignee !== (todo.assignee ?? '')) changes.assignee = assignee || null
    if (Object.keys(changes).length > 0) void editTodo(todo.id, changes, login)
    onDone(refocus)
  }

  function cancel() {
    if (finished.current) return
    finished.current = true
    onDone(true)
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      cancel()
    } else if (
      e.key === 'Enter' &&
      !(e.target instanceof HTMLTextAreaElement && e.shiftKey) &&
      !(e.target instanceof HTMLSelectElement)
    ) {
      e.preventDefault()
      save(true)
    }
  }

  function onBlur(e: FocusEvent<HTMLDivElement>) {
    // Moving between the form's own fields isn't leaving it.
    if (e.relatedTarget instanceof Node && e.currentTarget.contains(e.relatedTarget)) return
    save(false)
  }

  return (
    <div
      role="group"
      aria-label={`Edit “${todo.title}”`}
      onKeyDown={onKeyDown}
      onBlur={onBlur}
      className="grid gap-3 sm:grid-cols-2"
    >
      <div className="sm:col-span-2">
        <label htmlFor={`${id}-title`} className="sr-only">
          Title
        </label>
        <input
          id={`${id}-title`}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={TITLE_MAX}
          autoFocus
          className={`${TODO_FIELD} font-medium`}
        />
      </div>
      <div className="sm:col-span-2">
        <label htmlFor={`${id}-description`} className="text-xs font-medium text-ink-muted">
          Description
        </label>
        <textarea
          id={`${id}-description`}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={DESCRIPTION_MAX}
          rows={2}
          className={`mt-1 ${TODO_FIELD} resize-y`}
        />
      </div>
      <div>
        <label htmlFor={`${id}-due`} className="text-xs font-medium text-ink-muted">
          Due date
        </label>
        <input
          id={`${id}-due`}
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className={`mt-1 ${TODO_FIELD}`}
        />
      </div>
      <div>
        <label htmlFor={`${id}-assignee`} className="text-xs font-medium text-ink-muted">
          Assignee
        </label>
        <div className="mt-1">
          <AssigneeSelect
            id={`${id}-assignee`}
            value={assignee}
            onChange={setAssignee}
            team={team}
            login={login}
          />
        </div>
      </div>
      <p className="text-xs text-ink-muted sm:col-span-2">
        Enter saves · Esc cancels · Shift+Enter adds a line to the description
      </p>
    </div>
  )
}

/** The row's "…" menu: Edit, Delete. Arrow keys move between items; Esc closes it. */
function RowMenu({
  title,
  onEdit,
  onDelete,
}: {
  title: string
  onEdit: () => void
  onDelete: () => void
}) {
  const [open, setOpen] = useState(false)
  const menuId = useId()
  const wrapper = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  const items = useRef<(HTMLButtonElement | null)[]>([])

  useEffect(() => {
    if (!open) return
    items.current[0]?.focus()
    const onPointerDown = (e: PointerEvent) => {
      if (!wrapper.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  function close(refocus = true) {
    setOpen(false)
    if (refocus) button.current?.focus()
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const list = items.current.filter((el): el is HTMLButtonElement => el !== null)
    const index = list.indexOf(document.activeElement as HTMLButtonElement)
    if (e.key === 'Escape') {
      e.preventDefault()
      close()
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      const step = e.key === 'ArrowDown' ? 1 : -1
      list[(index + step + list.length) % list.length]?.focus()
    } else if (e.key === 'Tab') {
      setOpen(false)
    }
  }

  return (
    <div ref={wrapper} className="relative">
      <button
        ref={button}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((o) => !o)}
        className="rounded-full p-1.5 text-ink-muted hover:bg-ink/5 hover:text-link"
      >
        <MoreHorizontal aria-hidden="true" className="size-4" />
        <span className="sr-only">More actions for “{title}”</span>
      </button>
      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label={`Actions for “${title}”`}
          onKeyDown={onKeyDown}
          className="shadow-card absolute top-full right-0 z-20 mt-1 w-36 rounded-xl border border-border bg-surface-raised py-1"
        >
          <button
            ref={(el) => {
              items.current[0] = el
            }}
            type="button"
            role="menuitem"
            tabIndex={-1}
            onClick={() => {
              close(false)
              onEdit()
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-ink hover:bg-ink/5 focus-visible:bg-ink/5"
          >
            <Pencil aria-hidden="true" className="size-4 text-ink-muted" />
            Edit
          </button>
          <button
            ref={(el) => {
              items.current[1] = el
            }}
            type="button"
            role="menuitem"
            tabIndex={-1}
            onClick={() => {
              close(false)
              onDelete()
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-link hover:bg-ink/5 focus-visible:bg-ink/5"
          >
            <Trash2 aria-hidden="true" className="size-4" />
            Delete
          </button>
        </div>
      )}
    </div>
  )
}
