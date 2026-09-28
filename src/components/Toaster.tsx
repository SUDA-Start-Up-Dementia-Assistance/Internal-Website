import { Check, CircleAlert, X } from 'lucide-react'
import { dismissToast, useToasts, type Toast } from '../lib/toast'

/**
 * Where toasts appear (bottom of the screen). Both live regions are always rendered, so
 * screen readers announce what's added: confirmations politely, errors right away.
 */
export default function Toaster() {
  const toasts = useToasts()
  const successes = toasts.filter((t) => t.kind === 'success')
  const errors = toasts.filter((t) => t.kind === 'error')
  return (
    <div className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex flex-col items-center gap-2 sm:right-6 sm:left-auto sm:items-end">
      <div role="alert" className="flex flex-col items-center gap-2 sm:items-end">
        {errors.map((t) => (
          <ToastCard key={t.id} toast={t} />
        ))}
      </div>
      <div role="status" className="flex flex-col items-center gap-2 sm:items-end">
        {successes.map((t) => (
          <ToastCard key={t.id} toast={t} />
        ))}
      </div>
    </div>
  )
}

function ToastCard({ toast }: { toast: Toast }) {
  const error = toast.kind === 'error'
  return (
    <div
      className={`shadow-card pointer-events-auto flex max-w-sm items-start gap-2 rounded-2xl bg-surface text-sm ${
        error ? 'border border-link/40 py-3 pr-2 pl-4 text-ink' : 'px-4 py-2 text-ink-muted'
      }`}
    >
      {error ? (
        <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-link" />
      ) : (
        <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-link" />
      )}
      <p className="min-w-0 flex-1">{toast.message}</p>
      {error && (
        <button
          type="button"
          onClick={() => dismissToast(toast.id)}
          className="-my-1 shrink-0 rounded-full p-1 text-ink-muted hover:bg-ink/5 hover:text-ink"
        >
          <X aria-hidden="true" className="size-4" />
          <span className="sr-only">Dismiss</span>
        </button>
      )}
    </div>
  )
}
