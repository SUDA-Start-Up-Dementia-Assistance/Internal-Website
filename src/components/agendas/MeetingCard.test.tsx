// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { FeedItem, Meeting } from '../../lib/drive'
import { parseLocalDate } from '../../lib/drive/parse'
import MeetingCard from './MeetingCard'

function item(sourceKey: string): FeedItem {
  return {
    date: parseLocalDate('2026-10-13')!,
    sourceKey,
    file: {
      id: sourceKey,
      name: `2026-10-13 ${sourceKey}`,
      mimeType: 'application/vnd.google-apps.document',
      modifiedTime: '2026-10-01T00:00:00.000Z',
      webViewLink: '',
      iconLink: '',
    },
  }
}

const fourUpOnly: Meeting = { date: parseLocalDate('2026-10-13')!, fourUp: item('fourUps') }

afterEach(cleanup)

describe('MeetingCard', () => {
  it('says the agenda is not posted yet on an upcoming meeting without one', () => {
    render(<MeetingCard meeting={fourUpOnly} show="all" upcoming today={false} onOpen={vi.fn()} />)
    expect(screen.getByText('Agenda not posted yet')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Agenda' })).toBeNull()
    expect(screen.getByRole('button', { name: '4Up' })).toBeTruthy()
  })

  it('hides a missing agenda entirely on a past meeting', () => {
    render(
      <MeetingCard
        meeting={fourUpOnly}
        show="all"
        upcoming={false}
        today={false}
        onOpen={vi.fn()}
      />,
    )
    expect(screen.queryByText('Agenda not posted yet')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Agenda' })).toBeNull()
  })

  it('only shows 4Ups under the 4Ups filter, without the not-posted note', () => {
    render(
      <MeetingCard meeting={fourUpOnly} show="fourUps" upcoming today={false} onOpen={vi.fn()} />,
    )
    expect(screen.queryByText('Agenda not posted yet')).toBeNull()
    expect(screen.getByRole('button', { name: '4Up' })).toBeTruthy()
  })

  it('marks today with a "Today" label', () => {
    render(<MeetingCard meeting={fourUpOnly} show="all" upcoming today onOpen={vi.fn()} />)
    expect(screen.getByText('Today')).toBeTruthy()
  })
})
