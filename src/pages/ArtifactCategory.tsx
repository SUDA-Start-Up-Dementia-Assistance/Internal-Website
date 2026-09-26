import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import FileList, { type FileView } from '../components/artifacts/FileList'
import ViewToggle from '../components/artifacts/ViewToggle'
import Breadcrumb from '../components/Breadcrumb'
import CategoryIcon from '../components/CategoryIcon'
import { buttonClasses } from '../components/buttonStyles'
import EmptyState from '../components/EmptyState'
import ErrorState from '../components/ErrorState'
import LoadingState from '../components/LoadingState'
import Skeleton from '../components/Skeleton'
import { usePreviewPanel } from '../components/usePreviewPanel'
import { isSourceConfigured } from '../config/sources'
import { formatRelative } from '../lib/dates'
import { usePublishedCategory } from '../lib/drive'
import { artifactDisplayName } from '../lib/files'
import { categoryLastUpdated } from '../lib/selectors'
import { readPreference, writePreference } from '../lib/storage'
import PageTitle from '../components/PageTitle'

const VIEW_KEY = 'dawn:artifact-view'
const VIEWS = ['list', 'cards'] as const

export default function ArtifactCategory() {
  const { category: slug = '' } = useParams()

  return (
    <div className="mx-auto max-w-5xl px-6 py-12 sm:py-16">
      {isSourceConfigured('publishedArtifacts') ? (
        <CategoryView slug={slug} />
      ) : (
        <NotFound message="Published artifacts aren't connected yet." />
      )}
    </div>
  )
}

function CategoryView({ slug }: { slug: string }) {
  const query = usePublishedCategory(slug)
  const { openPreview, previewPanel } = usePreviewPanel()
  const [view, setView] = useState<FileView>(() => readPreference(VIEW_KEY, VIEWS, 'list'))

  function changeView(next: FileView) {
    setView(next)
    writePreference(VIEW_KEY, next)
  }

  if (query.loading) {
    return (
      <LoadingState>
        <PageTitle title="Artifacts" />
        <Skeleton className="h-4 w-40" />
        <Skeleton className="mt-5 h-10 w-72" />
        <Skeleton className="mt-3 h-4 w-48" />
        <div className="mt-10 space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-2xl" />
          ))}
        </div>
      </LoadingState>
    )
  }
  if (query.error) {
    return (
      <>
        <PageTitle title="Artifacts" />
        <Breadcrumb items={[{ label: 'Artifacts', to: '/artifacts' }, { label: 'Category' }]} />
        <div className="mt-8">
          <ErrorState message="We couldn't load this category right now." onRetry={query.refetch} />
        </div>
      </>
    )
  }

  const category = query.data
  if (!category) {
    return <NotFound message="We couldn't find that category. It may have been renamed." />
  }

  // Already in folder ("NN") order from the loader.
  const files = category.files
  const updated = categoryLastUpdated(category)

  return (
    <>
      <PageTitle title={category.displayName} />
      <Breadcrumb
        items={[{ label: 'Artifacts', to: '/artifacts' }, { label: category.displayName }]}
      />
      <div className="mt-5 flex items-center gap-4">
        <CategoryIcon slug={category.slug} size="lg" />
        <h1 className="text-4xl font-semibold">{category.displayName}</h1>
      </div>
      <p className="mt-3 text-dusk">
        {files.length} {files.length === 1 ? 'file' : 'files'}
        {updated && ` · Updated ${formatRelative(updated)}`}
      </p>
      <div aria-hidden="true" className="mt-6 horizon-line w-24" />

      {files.length === 0 ? (
        <div className="mt-10">
          <EmptyState>
            No files in this category yet. They&apos;ll appear here once they&apos;re published.
          </EmptyState>
        </div>
      ) : (
        <>
          <div className="mt-8 flex justify-end">
            <ViewToggle view={view} onChange={changeView} />
          </div>
          <div className="mt-4">
            <FileList
              files={files}
              view={view}
              onPreview={(file) =>
                openPreview({
                  title: category.displayName,
                  documents: [
                    { id: file.id, label: 'PDF', file, name: artifactDisplayName(file.name) },
                  ],
                })
              }
            />
          </div>
        </>
      )}
      {previewPanel}
    </>
  )
}

function NotFound({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-start">
      <PageTitle title="Category not found" />
      <Breadcrumb items={[{ label: 'Artifacts', to: '/artifacts' }, { label: 'Not found' }]} />
      <h1 className="mt-5 text-4xl font-semibold">Category not found</h1>
      <p className="mt-3 max-w-prose text-dusk">{message}</p>
      <Link to="/artifacts" className={`mt-8 ${buttonClasses('secondary')}`}>
        Back to all artifacts
      </Link>
    </div>
  )
}
