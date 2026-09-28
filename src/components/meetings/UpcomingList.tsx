import { useId } from 'react'
import type { JoinedMeeting } from '../../lib/meetings'
import { groupByWeekAndDay } from '../../lib/meetingsView'
import EmptyState from '../EmptyState'
import MeetingDayList from './MeetingDayList'

/** The next 3 weeks, under "This week / Next week / Later", then by day. */
export default function UpcomingList({
  meetings,
  todayKey,
  now,
}: {
  meetings: JoinedMeeting[]
  todayKey: string
  now: Date
}) {
  const sections = groupByWeekAndDay(meetings, todayKey)
  if (sections.length === 0) return <EmptyState>No meetings in the next 3 weeks.</EmptyState>
  return (
    <div className="space-y-10">
      {sections.map((section) => (
        <Section key={section.id} heading={section.heading}>
          <MeetingDayList days={section.days} todayKey={todayKey} now={now} />
        </Section>
      ))}
    </div>
  )
}

function Section({ heading, children }: { heading: string; children: React.ReactNode }) {
  const headingId = useId()
  return (
    <section aria-labelledby={headingId}>
      <h2 id={headingId} className="text-2xl font-semibold">
        {heading}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  )
}
