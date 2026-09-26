import { Eye } from 'lucide-react'
import { Link } from 'react-router-dom'
import { formatShortDate } from '../../lib/dates'
import { artifactDisplayName } from '../../lib/files'
import type { PublishedFileRef } from '../../lib/selectors'
import { buttonClasses } from '../buttonStyles'
import ExternalButtonLink from '../ExternalButtonLink'
import FileTypeIcon from '../FileTypeIcon'
import type { PreviewRequest } from '../usePreviewPanel'

interface SearchResultsProps {
  query: string
  results: PublishedFileRef[]
  onPreview: (request: PreviewRequest) => void
}

export default function SearchResults({ query, results, onPreview }: SearchResultsProps) {
  return (
    <div>
      <p role="status" className="text-sm text-dusk">
        {results.length === 0
          ? `No files match “${query}”.`
          : `${results.length} ${results.length === 1 ? 'file matches' : 'files match'} “${query}”.`}
      </p>
      {results.length > 0 && (
        <ul className="mt-4 space-y-3">
          {results.map(({ file, category }) => {
            const nameId = `result-${file.id}`
            const name = artifactDisplayName(file.name)
            return (
              <li
                key={file.id}
                className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl bg-surface px-5 py-4 shadow-card"
              >
                <FileTypeIcon mimeType={file.mimeType} />
                <div className="min-w-0 flex-1">
                  <p id={nameId} className="truncate font-medium">
                    {name}
                  </p>
                  <p className="text-sm text-dusk">
                    <Link
                      to={`/artifacts/${category.slug}`}
                      className="rounded-sm text-ember underline decoration-ember/40 underline-offset-2 hover:decoration-ember"
                    >
                      {category.displayName}
                    </Link>
                    {` · Updated ${formatShortDate(file.modifiedTime)}`}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    aria-haspopup="dialog"
                    aria-describedby={nameId}
                    onClick={() =>
                      onPreview({
                        title: category.displayName,
                        documents: [{ id: file.id, label: 'PDF', file, name }],
                      })
                    }
                    className={buttonClasses('secondary', 'sm')}
                  >
                    <Eye aria-hidden="true" className="size-4" />
                    Preview
                  </button>
                  <ExternalButtonLink href={file.webViewLink} size="sm" describedBy={nameId}>
                    Open in Drive
                  </ExternalButtonLink>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
