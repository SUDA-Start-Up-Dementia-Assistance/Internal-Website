import { Search } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import CategoryGrid from '../components/artifacts/CategoryGrid'
import SearchResults from '../components/artifacts/SearchResults'
import EmptyState from '../components/EmptyState'
import LoadingState from '../components/LoadingState'
import Skeleton from '../components/Skeleton'
import { usePreviewPanel } from '../components/usePreviewPanel'
import { isSourceConfigured } from '../config/sources'
import { usePublishedCategories } from '../lib/drive'
import { searchPublished } from '../lib/selectors'
import PageTitle from '../components/PageTitle'

export default function Artifacts() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-12 sm:py-16">
      <PageTitle title="Artifacts" />
      <h1 className="text-4xl font-semibold">Artifacts</h1>
      <p className="mt-3 max-w-prose text-dusk">
        The team&apos;s published deliverables, organized by category.
      </p>
      <div aria-hidden="true" className="mt-6 horizon-line w-24" />
      {isSourceConfigured('publishedArtifacts') ? (
        <PublishedView />
      ) : (
        <div className="mt-10">
          <EmptyState>Published artifacts aren&apos;t connected yet.</EmptyState>
        </div>
      )}
    </div>
  )
}

function PublishedView() {
  const categories = usePublishedCategories()
  const { openPreview, previewPanel } = usePreviewPanel()

  // The query lives in the URL (?q=) so a search can be shared or survive a reload.
  const [params, setParams] = useSearchParams()
  const query = params.get('q') ?? ''
  const searching = query.trim().length > 0

  return (
    <>
      <search className="mt-10 block">
        <label htmlFor="artifact-search" className="sr-only">
          Search artifacts
        </label>
        <div className="relative max-w-xl">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-dusk"
          />
          <input
            id="artifact-search"
            type="search"
            value={query}
            onChange={(e) =>
              setParams(e.target.value ? { q: e.target.value } : {}, { replace: true })
            }
            placeholder="Search published files"
            autoComplete="off"
            className="w-full rounded-full border border-night/15 bg-surface py-3 pr-4 pl-12 text-night shadow-card placeholder:text-dusk"
          />
        </div>
      </search>

      <div className="mt-12">
        {!searching ? (
          <CategoryGrid categories={categories} />
        ) : categories.loading ? (
          <LoadingState>
            <Skeleton className="h-4 w-48" />
            <Skeleton className="mt-6 h-16 w-full rounded-2xl" />
            <Skeleton className="mt-3 h-16 w-full rounded-2xl" />
          </LoadingState>
        ) : (
          <SearchResults
            query={query.trim()}
            results={searchPublished(query, categories.data ?? [])}
            onPreview={openPreview}
          />
        )}
      </div>
      {previewPanel}
    </>
  )
}
