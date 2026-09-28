import type { LucideIcon } from 'lucide-react'
import { useId, type ReactNode } from 'react'
import { isWidgetError, type DashboardQuery, type Widget } from '../../lib/dashboard'
import ErrorState from '../ErrorState'
import LoadingState from '../LoadingState'

interface WidgetCardProps {
  /** The section's id, the target of the header's "Waiting on you" links. */
  id: string
  title: string
  icon: LucideIcon
  /** Shown after the title, e.g. a count. */
  badge?: ReactNode
  footer?: ReactNode
  children: ReactNode
}

/**
 * One dashboard widget: a card that's a <section> with its own heading. Focusable from
 * script (tabIndex -1) so the header's links can move focus to it.
 */
export function WidgetCard({ id, title, icon: Icon, badge, footer, children }: WidgetCardProps) {
  const headingId = useId()
  return (
    <section
      id={id}
      aria-labelledby={headingId}
      tabIndex={-1}
      className="shadow-card hover:shadow-card-hover card-hover scroll-mt-24 rounded-2xl bg-surface p-5 sm:p-6"
    >
      <h2 id={headingId} className="flex items-center gap-2 text-xl font-semibold">
        <Icon aria-hidden="true" className="size-5 shrink-0 text-ink-muted" />
        {title}
        {badge}
      </h2>
      <div className="mt-4">{children}</div>
      {footer && (
        <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 border-t border-border pt-4 text-sm">
          {footer}
        </div>
      )}
    </section>
  )
}

/** "(3)" after a widget title. */
export function CountBadge({ count, label }: { count: number; label: string }) {
  return (
    <span className="font-body text-base font-normal text-ink-muted">
      <span aria-hidden="true">({count})</span>
      <span className="sr-only">, {label}</span>
    </span>
  )
}

interface WidgetBodyProps<T> {
  query: DashboardQuery
  value: Widget<T> | undefined
  skeleton: ReactNode
  children: (data: T) => ReactNode
}

/** Loading → the widget's skeleton; a failed source → its error with retry; else children. */
export function WidgetBody<T>({ query, value, skeleton, children }: WidgetBodyProps<T>) {
  if (query.loading || value === undefined) return <LoadingState>{skeleton}</LoadingState>
  if (isWidgetError(value)) {
    return <ErrorState message={value.error.message} onRetry={query.refetch} />
  }
  return <>{children(value)}</>
}

export const FOOTER_LINK =
  'inline-flex items-center gap-1 rounded-sm font-medium text-link underline-offset-4 hover:underline'
