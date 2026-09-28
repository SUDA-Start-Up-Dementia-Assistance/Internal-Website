// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { FeedItem } from '../../lib/drive'
import { joinAgendas, type Meeting } from '../../lib/meetings'
import { zonedInstant } from '../../lib/teamTime'
import PastMeetings from './PastMeetings'
import UpcomingList from './UpcomingList'

afterEach(cleanup)

const NOW = zonedInstant('2026-09-28', 9)

function meeting(id: string, day: string, kind: Meeting['kind']): Meeting {
  return {
    id,
    title: `${kind} meeting ${day}`,
    start: zonedInstant(day, 17).toISOString(),
    end: zonedInstant(day, 18).toISOString(),
    allDay: false,
    kind,
    recurring: kind !== 'adhoc',
    htmlLink: 'https://calendar.google.com/',
  }
}

function agenda(day: string): FeedItem {
  const [y, m, d] = day.split('-').map(Number)
  return {
    file: { id: day, name: `${day} Agenda`, webViewLink: `https://docs.google.com/${day}` },
    date: new Date(y, m - 1, d),
    sourceKey: 'agendas',
  } as FeedItem
}

// Every meeting shares a date with an agenda, or with no agenda at all (Oct 1).
const meetings = joinAgendas(
  [
    meeting('off-29', '2026-09-29', 'official'),
    meeting('retro-29', '2026-09-29', 'retro'),
    meeting('adhoc-29', '2026-09-29', 'adhoc'),
    meeting('off-1', '2026-10-01', 'official'),
    meeting('retro-1', '2026-10-01', 'retro'),
    meeting('adhoc-1', '2026-10-01', 'adhoc'),
  ],
  [agenda('2026-09-29')],
  [{ ...agenda('2026-09-29'), sourceKey: 'fourUps' }],
)

const row = (title: string) => screen.getByText(title).closest('li')!

describe('agenda and 4Up state', () => {
  it('shows both only for official meetings in the upcoming list', () => {
    render(<UpcomingList meetings={meetings} todayKey="2026-09-28" now={NOW} />)

    expect(within(row('official meeting 2026-09-29')).getByRole('link', { name: /Agenda/ }))
    expect(within(row('official meeting 2026-09-29')).getByRole('link', { name: /4Up/ }))
    expect(within(row('official meeting 2026-10-01')).getByText('Agenda not posted yet'))
    expect(within(row('official meeting 2026-10-01')).getByText('4Up not posted yet'))
    for (const title of [
      'retro meeting 2026-09-29',
      'adhoc meeting 2026-09-29',
      'retro meeting 2026-10-01',
      'adhoc meeting 2026-10-01',
    ]) {
      const r = row(title)
      expect(within(r).queryByText(/Agenda|4Up/)).toBeNull()
      // Details is still there.
      expect(within(r).getByRole('link', { name: /Details/ }))
    }
  })

  it('never renders agenda state for retro or ad hoc meetings, even if handed one', () => {
    const odd = [{ ...meeting('r', '2026-09-29', 'retro'), agenda: null, fourUp: null }]
    render(<PastMeetings meetings={odd} />)
    expect(screen.queryByText(/agenda|4Up/i)).toBeNull()
  })

  it('says "No agenda posted" / "No 4Up posted" for past official meetings', () => {
    render(<PastMeetings meetings={[meetings[3]]} />)
    expect(screen.getByText('No agenda posted')).toBeTruthy()
    expect(screen.getByText('No 4Up posted')).toBeTruthy()
  })

  it('shows "Recurring" and "Retro" tags as text, and none for one-offs', () => {
    render(<UpcomingList meetings={meetings} todayKey="2026-09-28" now={NOW} />)
    expect(within(row('official meeting 2026-09-29')).getByText('Recurring'))
    expect(within(row('retro meeting 2026-09-29')).getByText('Retro'))
    const adhoc = row('adhoc meeting 2026-09-29')
    expect(within(adhoc).queryByText(/Recurring|Retro/)).toBeNull()
  })
})
