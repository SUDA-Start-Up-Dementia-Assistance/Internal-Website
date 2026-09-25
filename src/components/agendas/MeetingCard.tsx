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
      className={`flex h-full flex-col rounded-2xl bg-surface p-5 shadow-card transition hover:shadow-card-hover motion-safe:hover:-translate-y-0.5 ${
        today ? 'ring-2 ring-gold' : ''
      }`}
    >
      {today ? (
        <p className="flex items-center gap-1.5 text-sm font-semibold text-ember">
          <SunArc horizon className="h-3.5 w-6" />
          Today
        </p>
      ) : (
        upcoming && <p className="text-sm text-dusk">{relativeDayLabel(meeting.date)}</p>
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
              className={`${BADGE} bg-apricot text-night hover:bg-apricot/85`}
            >
              <FileText aria-hidden="true" className="size-4" />
              Agenda
            </button>
          ) : (
            upcoming && <p className="py-2 text-sm text-dusk italic">Agenda not posted yet</p>
          ))}
        {showFourUp && meeting.fourUp && (
          <button
            type="button"
            aria-haspopup="dialog"
            aria-describedby={dateId}
            onClick={() => onOpen(meeting, 'fourUp')}
            className={`${BADGE} bg-night text-cream hover:bg-night/85`}
          >
            <LayoutGrid aria-hidden="true" className="size-4" />
            4Up
          </button>
        )}
      </div>
    </article>
  )
}
