import { Eye, LayoutGrid } from 'lucide-react'
import { useState } from 'react'
import { formatCardDate, formatMeetingDate } from '../../lib/dates'
import type { DriveFile, DriveQuery, Meeting } from '../../lib/drive'
import { selectLatestFourUp } from '../../lib/selectors'
import { buttonClasses } from '../buttonStyles'
import Card from '../Card'
import EmptyState from '../EmptyState'
import ErrorState from '../ErrorState'
import ExternalLinkLabel from '../ExternalLinkLabel'
import DocumentPanel from '../DocumentPanel'
import LoadingState from '../LoadingState'
import Skeleton from '../Skeleton'

export default function LatestFourUpCard({ meetings }: { meetings: DriveQuery<Meeting[]> }) {
  return (
    <Card title="Latest 4Up" icon={LayoutGrid}>
      <LatestFourUpBody meetings={meetings} />
    </Card>
  )
}

function LatestFourUpBody({ meetings }: { meetings: DriveQuery<Meeting[]> }) {
  if (meetings.loading) {
    return (
      <LoadingState>
        <Skeleton className="h-4 w-20" />
        <Skeleton className="mt-3 h-8 w-56" />
        <Skeleton className="mt-6 h-10 w-32 rounded-full" />
      </LoadingState>
    )
  }
  if (meetings.error) {
    return <ErrorState message="We couldn't load 4Ups right now." onRetry={meetings.refetch} />
  }

  const latest = selectLatestFourUp(meetings.data ?? [])
  if (!latest?.fourUp) {
    return <EmptyState>No 4Ups yet. The most recent one will show up here.</EmptyState>
  }

  return <FourUpSummary date={latest.date} file={latest.fourUp.file} />
}

function FourUpSummary({ date, file }: { date: Date; file: DriveFile }) {
  const [previewOpen, setPreviewOpen] = useState(false)

  return (
    <>
      <p className="text-sm font-medium text-dusk">For the meeting on</p>
      <p className="mt-1 font-heading text-2xl sm:text-3xl">{formatMeetingDate(date)}</p>
      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => setPreviewOpen(true)}
          className={buttonClasses('primary')}
        >
          <Eye aria-hidden="true" className="size-4" />
          Preview
        </button>
        <a
          href={file.webViewLink}
          target="_blank"
          rel="noreferrer"
          className={buttonClasses('secondary')}
        >
          Open in Drive
          <ExternalLinkLabel />
        </a>
      </div>
      {previewOpen && (
        <DocumentPanel
          title={`4Up · ${formatCardDate(date)}`}
          documents={[{ id: 'fourUp', label: '4Up', file }]}
          onClose={() => setPreviewOpen(false)}
        />
      )}
    </>
  )
}
