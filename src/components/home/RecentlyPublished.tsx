import { ArrowRight, FileText } from 'lucide-react'
import { Link } from 'react-router-dom'
import { formatShortDate } from '../../lib/dates'
import type { ArtifactCategory, DriveQuery } from '../../lib/drive'
import { selectRecentlyPublished } from '../../lib/selectors'
import EmptyState from '../EmptyState'
import ErrorState from '../ErrorState'
import ExternalLinkLabel from '../ExternalLinkLabel'
import LoadingState from '../LoadingState'
import Skeleton from '../Skeleton'

const RECENT_COUNT = 3

export default function RecentlyPublished({
  categories,
}: {
  categories: DriveQuery<ArtifactCategory[]>
}) {
  return (
    <section aria-labelledby="recent-title">
      <div className="flex items-baseline justify-between gap-4">
        <h2 id="recent-title" className="text-2xl font-semibold">
          Recently published
        </h2>
        <Link
          to="/artifacts"
          className="inline-flex items-center gap-1 rounded-sm text-sm font-medium text-ember hover:underline hover:underline-offset-4"
        >
          All artifacts
          <ArrowRight aria-hidden="true" className="size-4" />
        </Link>
      </div>
      <div className="mt-6">
        <RecentlyPublishedBody categories={categories} />
      </div>
    </section>
  )
}

function RecentlyPublishedBody({ categories }: { categories: DriveQuery<ArtifactCategory[]> }) {
  if (categories.loading) {
    return (
      <LoadingState>
        <div className="grid gap-6 sm:grid-cols-3">
          {Array.from({ length: RECENT_COUNT }, (_, i) => (
            <div key={i} className="rounded-2xl bg-surface p-6 shadow-card">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="mt-3 h-6 w-full" />
              <Skeleton className="mt-4 h-3 w-24" />
            </div>
          ))}
        </div>
      </LoadingState>
    )
  }
  if (categories.error) {
    return (
      <ErrorState
        message="We couldn't load published artifacts right now."
        onRetry={categories.refetch}
      />
    )
  }
  const recent = selectRecentlyPublished(categories.data ?? [], RECENT_COUNT)
  if (recent.length === 0) {
    return <EmptyState>Nothing published yet. Final artifacts will appear here.</EmptyState>
  }

  return (
    <ul className="grid gap-6 sm:grid-cols-3">
      {recent.map(({ file, category }) => (
        <li key={file.id}>
          <a
            href={file.webViewLink}
            target="_blank"
            rel="noreferrer"
            className="group flex h-full flex-col rounded-2xl bg-surface p-6 shadow-card transition hover:shadow-card-hover motion-safe:hover:-translate-y-0.5"
          >
            <span className="flex items-center gap-1.5 text-xs font-semibold tracking-wider text-dusk uppercase">
              <FileText aria-hidden="true" className="size-3.5" />
              {category.displayName}
            </span>
            <span className="mt-2 font-heading text-lg leading-snug font-semibold group-hover:text-ember">
              {file.name}
            </span>
            <span className="mt-auto flex items-center gap-1.5 pt-4 text-sm text-dusk">
              Updated {formatShortDate(file.modifiedTime)}
              <ExternalLinkLabel />
            </span>
          </a>
        </li>
      ))}
    </ul>
  )
}
