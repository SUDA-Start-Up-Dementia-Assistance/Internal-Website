import { useEffect, useId, useRef } from 'react'
import { buttonClasses } from '../buttonStyles'

const TITLE_PREVIEW = 40

/** "Email Gerry about the beta feedback su…" */
function previewTitle(title: string): string {
  return title.length > TITLE_PREVIEW ? `${title.slice(0, TITLE_PREVIEW - 1).trimEnd()}…` : title
}

interface ConfirmDeleteDialogProps {
  title: string
  onConfirm: () => void
  onClose: () => void
}

/**
 * "Delete 'Email Gerry…'? This can't be undone." A modal <dialog>: it traps focus, closes on
 * Esc, and starts on Cancel so Enter never deletes by accident.
 */
export default function ConfirmDeleteDialog({
  title,
  onConfirm,
  onClose,
}: ConfirmDeleteDialogProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const headingId = useId()

  useEffect(() => {
    const dialog = ref.current
    if (dialog && !dialog.open) {
      dialog.showModal()
      cancelRef.current?.focus()
    }
  }, [])

  return (
    <dialog
      ref={ref}
      aria-labelledby={headingId}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) ref.current?.close()
      }}
      className="shadow-photo m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl bg-surface p-6 text-ink backdrop:bg-backdrop"
    >
      <h2 id={headingId} className="font-body text-lg font-semibold">
        Delete “{previewTitle(title)}”?
      </h2>
      <p className="mt-2 text-ink-muted">This can&apos;t be undone.</p>
      <div className="mt-6 flex justify-end gap-3">
        <button
          ref={cancelRef}
          type="button"
          onClick={() => ref.current?.close()}
          className={buttonClasses('secondary', 'sm')}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => {
            onConfirm()
            ref.current?.close()
          }}
          className={buttonClasses('primary', 'sm')}
        >
          Delete
        </button>
      </div>
    </dialog>
  )
}
