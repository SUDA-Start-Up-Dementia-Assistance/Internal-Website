import type { LucideIcon } from 'lucide-react'
import { useId, type ReactNode } from 'react'

interface CardProps {
  title: string
  icon?: LucideIcon
  children: ReactNode
}

export default function Card({ title, icon: Icon, children }: CardProps) {
  const headingId = useId()
  return (
    <section
      aria-labelledby={headingId}
      className="shadow-card hover:shadow-card-hover card-hover rounded-2xl bg-surface p-6 sm:p-8"
    >
      <h2
        id={headingId}
        className="flex items-center gap-2 font-body text-sm font-semibold tracking-wider text-ink-muted uppercase"
      >
        {Icon && <Icon aria-hidden="true" className="size-4" />}
        {title}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  )
}
