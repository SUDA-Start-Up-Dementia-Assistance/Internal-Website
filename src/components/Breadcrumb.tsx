import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'

export interface Crumb {
  label: string
  /** Omit for the current page (the last crumb). */
  to?: string
}

export default function Breadcrumb({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex flex-wrap items-center gap-1.5 text-sm">
        {items.map((item, i) => (
          <li key={`${item.label}-${i}`} className="flex items-center gap-1.5">
            {i > 0 && <ChevronRight aria-hidden="true" className="size-4 text-dusk" />}
            {item.to ? (
              <Link
                to={item.to}
                className="rounded-sm font-medium text-ember hover:underline hover:underline-offset-4"
              >
                {item.label}
              </Link>
            ) : (
              <span aria-current="page" className="text-dusk">
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}
