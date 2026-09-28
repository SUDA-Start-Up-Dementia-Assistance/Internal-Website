import { CalendarDays, FileText, LayoutGrid, Video } from 'lucide-react'
import type { JoinedMeeting } from '../../lib/meetings'
import ExternalLinkLabel from '../ExternalLinkLabel'

const LINK =
  'inline-flex items-center gap-1 rounded-sm font-medium text-link underline-offset-4 hover:underline'

const DOCS = {
  agenda: { label: 'Agenda', icon: FileText, missing: 'Agenda not posted yet' },
  fourUp: { label: '4Up', icon: LayoutGrid, missing: '4Up not posted yet' },
} as const

/**
 * An official meeting's agenda or 4Up: a link, or muted "… not posted yet" text. Nothing at
 * all for retro and ad hoc meetings (they never have the key; see joinAgendas) or while the
 * feed is loading.
 */
export function DocStatus({
  meeting,
  doc,
  missingText,
}: {
  meeting: JoinedMeeting
  doc: keyof typeof DOCS
  missingText?: string
}) {
  const item = meeting[doc]
  if (meeting.kind !== 'official' || item === undefined) return null
  const { label, icon: Icon, missing } = DOCS[doc]
  if (!item) return <span className="text-ink-muted">{missingText ?? missing}</span>
  return (
    <a href={item.file.webViewLink} target="_blank" rel="noreferrer" className={LINK}>
      <Icon aria-hidden="true" className="size-4" />
      {label}
      <span className="sr-only">{` for ${meeting.title}`}</span>
      <ExternalLinkLabel />
    </a>
  )
}

/** Both of an official meeting's docs: the agenda, then the 4Up. */
export function MeetingDocLinks({
  meeting,
  past = false,
}: {
  meeting: JoinedMeeting
  /** Past meetings say "No agenda posted" rather than "not posted yet". */
  past?: boolean
}) {
  return (
    <>
      <DocStatus
        meeting={meeting}
        doc="agenda"
        missingText={past ? 'No agenda posted' : undefined}
      />
      <DocStatus meeting={meeting} doc="fourUp" missingText={past ? 'No 4Up posted' : undefined} />
    </>
  )
}

export function JoinLink({ meeting }: { meeting: JoinedMeeting }) {
  if (!meeting.joinUrl) return null
  return (
    <a href={meeting.joinUrl} target="_blank" rel="noreferrer" className={LINK}>
      <Video aria-hidden="true" className="size-4" />
      Join<span className="sr-only"> {meeting.title}</span>
      <ExternalLinkLabel />
    </a>
  )
}

/** The event in Google Calendar. */
export function DetailsLink({ meeting }: { meeting: JoinedMeeting }) {
  return (
    <a href={meeting.htmlLink} target="_blank" rel="noreferrer" className={LINK}>
      <CalendarDays aria-hidden="true" className="size-4" />
      Details<span className="sr-only"> for {meeting.title} in Google Calendar</span>
      <ExternalLinkLabel />
    </a>
  )
}
