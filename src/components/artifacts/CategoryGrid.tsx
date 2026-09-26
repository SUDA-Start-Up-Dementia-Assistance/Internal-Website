import { Link } from 'react-router-dom'
import { formatRelative } from '../../lib/dates'
import type { ArtifactCategory, DriveQuery } from '../../lib/drive'
import { categoryLastUpdated } from '../../lib/selectors'
import CategoryIcon from '../CategoryIcon'
import EmptyState from '../EmptyState'
import ErrorState from '../ErrorState'
import LoadingState from '../LoadingState'
import Skeleton from '../Skeleton'

/** "Published artifacts": one card per category, in folder ("NN") order. */
export default function CategoryGrid({
  categories,
}: {
  categories: DriveQuery<ArtifactCategory[]>
}) {
  return (
    <section aria-labelledby="published-title">
      <h2 id="published-title" className="text-2xl font-semibold">
        Published artifacts
      </h2>
      <p className="mt-1 text-sm text-dusk">
        Final deliverables from each phase of the project.
      </p>
      <div className="mt-5">
        <CategoryGridBody categories={categories} />
      </div>
    </section>
  )
}

function CategoryGridBody({ categories }: { categories: DriveQuery<ArtifactCategory[]> }) {
  if (categories.loading) {
    return (
      <LoadingState>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex gap-4 rounded-2xl bg-surface p-5 shadow-card">
              <Skeleton className="size-11 rounded-xl" />
              <div className="flex-1">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="mt-2 h-3.5 w-40" />
              </div>
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
  const list = categories.data ?? []
  if (list.length === 0) {
    return <EmptyState>No categories yet. Published artifacts will appear here.</EmptyState>
  }

  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {list.map((category) => {
        const updated = categoryLastUpdated(category)
        const count = category.files.length
        return (
          <li key={category.id}>
            <Link
              to={`/artifacts/${category.slug}`}
              className="group flex h-full items-start gap-4 rounded-2xl bg-surface p-5 shadow-card transition hover:shadow-card-hover motion-safe:hover:-translate-y-0.5"
            >
              <CategoryIcon slug={category.slug} />
              <span className="min-w-0">
                <span className="block font-heading text-lg leading-snug font-semibold group-hover:text-ember">
                  {category.displayName}
                </span>
                <span className="mt-1 block text-sm text-dusk">
                  {count === 0 ? 'No files yet' : `${count} ${count === 1 ? 'file' : 'files'}`}
                  {updated && ` · Updated ${formatRelative(updated)}`}
                </span>
              </span>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
