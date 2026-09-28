import { FileText, LayoutGrid } from 'lucide-react'
import { useId } from 'react'
import { formatCardDate, relativeDayLabel } from '../../lib/dates'
import type { Meeting } from '../../lib/drive'
import { toDateKey } from '../../lib/drive/parse'
import type { MeetingFilter } from '../../lib/selectors'
import SunArc from '../SunArc'

export type MeetingDoc = 'agenda' | 'fourUp'

interface MeetingCardProps {
  meeting: Meeting
  show: MeetingFilter
  upcoming: boolean
  today: boolean
  onOpen: (meeting: Meeting, doc: MeetingDoc) => void
}

const BADGE =
  'inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-colors'

export default function MeetingCard({ meeting, show, upcoming, today, onOpen }: MeetingCardProps) {
  const dateId = useId()
  const showAgenda = show !== 'fourUps'
  const showFourUp = show !== 'agendas'

  return (
    <article
      aria-labelledby={dateId}
      className={`shadow-card hover:shadow-card-hover flex h-full card-hover flex-col rounded-2xl bg-surface p-5 ${
        today ? 'ring-2 ring-accent' : ''
      }`}
    >
      {today ? (
        <p className="flex items-center gap-1.5 text-sm font-semibold text-link">
          <SunArc horizon className="h-3.5 w-6" />
          Today
        </p>
      ) : (
        upcoming && <p className="text-sm text-ink-muted">{relativeDayLabel(meeting.date)}</p>
      )}
      <h3 id={dateId} className="text-xl font-semibold">
        <time dateTime={toDateKey(meeting.date)}>{formatCardDate(meeting.date)}</time>
      </h3>

      <div className="mt-auto flex flex-wrap items-center gap-2 pt-4">
        {showAgenda &&
          (meeting.agenda ? (
            <button
              type="button"
              aria-haspopup="dialog"
              aria-describedby={dateId}
              onClick={() => onOpen(meeting, 'agenda')}
              className={`${BADGE} bg-accent text-on-accent hover:bg-accent/85`}
            >
              <FileText aria-hidden="true" className="size-4" />
              Agenda
            </button>
          ) : (
            upcoming && <p className="py-2 text-sm text-ink-muted italic">Agenda not posted yet</p>
          ))}
        {showFourUp && meeting.fourUp && (
          <button
            type="button"
            aria-haspopup="dialog"
            aria-describedby={dateId}
            onClick={() => onOpen(meeting, 'fourUp')}
            className={`${BADGE} bg-ink text-page hover:bg-ink/85 dark:bg-surface-raised dark:text-ink dark:ring-1 dark:ring-border dark:hover:bg-ink/15`}
          >
            <LayoutGrid aria-hidden="true" className="size-4" />
            4Up
          </button>
        )}
      </div>
    </article>
  )
}
