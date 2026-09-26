import { Eye } from 'lucide-react'
import { formatShortDate } from '../../lib/dates'
import type { DriveFile } from '../../lib/drive'
import { artifactDisplayName } from '../../lib/files'
import { buttonClasses } from '../buttonStyles'
import ExternalButtonLink from '../ExternalButtonLink'
import FileTypeIcon from '../FileTypeIcon'

export type FileView = 'list' | 'cards'

interface FileListProps {
  files: DriveFile[]
  view: FileView
  onPreview: (file: DriveFile) => void
}

export default function FileList({ files, view, onPreview }: FileListProps) {
  if (view === 'cards') {
    return (
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {files.map((file) => (
          <li key={file.id}>
            <article
              aria-labelledby={`file-${file.id}`}
              className="flex h-full flex-col rounded-2xl bg-surface p-5 shadow-card transition hover:shadow-card-hover motion-safe:hover:-translate-y-0.5"
            >
              <FileTypeIcon mimeType={file.mimeType} size="lg" />
              <h2 id={`file-${file.id}`} className="mt-4 text-lg leading-snug font-semibold">
                {artifactDisplayName(file.name)}
              </h2>
              <p className="mt-1 text-sm text-dusk">Updated {formatShortDate(file.modifiedTime)}</p>
              <FileActions file={file} onPreview={onPreview} className="mt-auto pt-5" />
            </article>
          </li>
        ))}
      </ul>
    )
  }

  return (
    <ul className="divide-y divide-night/10 overflow-hidden rounded-2xl bg-surface shadow-card">
      {files.map((file) => (
        <li key={file.id} className="flex flex-wrap items-center gap-x-4 gap-y-3 px-5 py-4">
          <FileTypeIcon mimeType={file.mimeType} />
          <div className="min-w-0 flex-1">
            <h2 id={`file-${file.id}`} className="truncate font-body text-base font-medium">
              {artifactDisplayName(file.name)}
            </h2>
            <p className="text-sm text-dusk">
              <span className="sr-only">Updated </span>
              {formatShortDate(file.modifiedTime)}
            </p>
          </div>
          <FileActions file={file} onPreview={onPreview} />
        </li>
      ))}
    </ul>
  )
}

interface FileActionsProps {
  file: DriveFile
  onPreview: (file: DriveFile) => void
  className?: string
}

function FileActions({ file, onPreview, className = '' }: FileActionsProps) {
  const nameId = `file-${file.id}`
  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-describedby={nameId}
        onClick={() => onPreview(file)}
        className={buttonClasses('secondary', 'sm')}
      >
        <Eye aria-hidden="true" className="size-4" />
        Preview
      </button>
      <ExternalButtonLink href={file.webViewLink} size="sm" describedBy={nameId}>
        Open in Drive
      </ExternalButtonLink>
    </div>
  )
}
