import { describe, expect, it } from 'vitest'
import { parseLocalDate } from './drive/parse'
import type { FeedItem } from './drive/types'
import { isUpcoming, joinAgendas, meetingDateKey, type Meeting } from './meetings'
import { mockMeetings } from './meetingsMock'
import { zonedInstant } from './teamTime'

function agenda(dateKey: string): FeedItem {
  return {
    date: parseLocalDate(dateKey)!,
    sourceKey: 'agendas',
    file: {
      id: `a-${dateKey}`,
      name: `${dateKey} Agenda`,
      mimeType: 'application/vnd.google-apps.document',
      modifiedTime: '2026-01-01T00:00:00Z',
      webViewLink: `https://docs.google.com/document/d/a-${dateKey}`,
      iconLink: '',
    },
  }
}

function meeting(start: string, end: string, kind: Meeting['kind'] = 'official'): Meeting {
  return {
    id: start,
    title: 'x',
    start,
    end,
    allDay: false,
    kind,
    htmlLink: 'https://calendar.google.com/',
  }
}

describe('joinAgendas', () => {
  it('attaches the same-date agenda to official meetings, and null when none is posted', () => {
    const joined = joinAgendas(
      [
        meeting('2026-09-29T17:00:00-04:00', '2026-09-29T18:15:00-04:00'),
        meeting('2026-10-01T17:00:00-04:00', '2026-10-01T18:15:00-04:00'),
      ],
      [agenda('2026-09-29'), agenda('2026-09-22')],
    )
    expect(joined[0].agenda?.file.id).toBe('a-2026-09-29')
    expect(joined[1].agenda).toBeNull()
  })

  it('never gives retro or ad hoc meetings agenda state, even with an agenda that day', () => {
    const joined = joinAgendas(
      [
        meeting('2026-09-28T20:00:00-04:00', '2026-09-28T21:00:00-04:00', 'retro'),
        meeting('2026-09-29T12:00:00-04:00', '2026-09-29T12:30:00-04:00', 'adhoc'),
      ],
      [agenda('2026-09-28'), agenda('2026-09-29')],
    )
    for (const m of joined) expect('agenda' in m).toBe(false)
  })

  it('uses the Eastern date: an 11pm meeting is still that day (it is the next day in UTC)', () => {
    const late = meeting('2026-09-29T23:00:00-04:00', '2026-09-29T23:45:00-04:00')
    expect(new Date(late.start).toISOString().slice(0, 10)).toBe('2026-09-30')
    expect(meetingDateKey(late)).toBe('2026-09-29')
    const [joined] = joinAgendas([late], [agenda('2026-09-30'), agenda('2026-09-29')])
    expect(joined.agenda?.file.id).toBe('a-2026-09-29')
  })

  it('handles the early-November DST change (EDT → EST on 2026-11-01)', () => {
    // 11:30pm EST on the fall-back day, and 11:30pm EDT the night before.
    const afterChange = meeting('2026-11-01T23:30:00-05:00', '2026-11-02T00:15:00-05:00')
    const beforeChange = meeting('2026-10-31T23:30:00-04:00', '2026-11-01T00:15:00-04:00')
    const joined = joinAgendas(
      [beforeChange, afterChange],
      [agenda('2026-10-31'), agenda('2026-11-01')],
    )
    expect(joined.map((m) => m.agenda?.file.id)).toEqual(['a-2026-10-31', 'a-2026-11-01'])
  })

  it('handles the mid-March DST change (EST → EDT on 2027-03-14)', () => {
    const beforeChange = meeting('2027-03-13T23:00:00-05:00', '2027-03-13T23:30:00-05:00')
    const afterChange = meeting('2027-03-14T23:00:00-04:00', '2027-03-14T23:30:00-04:00')
    const early = meeting('2027-03-14T00:30:00-05:00', '2027-03-14T01:00:00-05:00')
    const joined = joinAgendas(
      [beforeChange, early, afterChange],
      [agenda('2027-03-13'), agenda('2027-03-14')],
    )
    expect(joined.map((m) => m.agenda?.file.id)).toEqual([
      'a-2027-03-13',
      'a-2027-03-14',
      'a-2027-03-14',
    ])
  })

  it('uses an all-day meeting’s own date', () => {
    const allDay: Meeting = { ...meeting('2026-10-06', '2026-10-07'), allDay: true }
    expect(joinAgendas([allDay], [agenda('2026-10-06')])[0].agenda?.file.id).toBe('a-2026-10-06')
  })
})

describe('isUpcoming', () => {
  const m = meeting('2026-09-29T17:00:00-04:00', '2026-09-29T18:15:00-04:00')

  it('counts a meeting as upcoming until it ends', () => {
    expect(isUpcoming(m, new Date('2026-09-29T16:00:00-04:00'))).toBe(true)
    expect(isUpcoming(m, new Date('2026-09-29T18:14:59-04:00'))).toBe(true) // in progress
    expect(isUpcoming(m, new Date('2026-09-29T18:15:00-04:00'))).toBe(false)
  })

  it('ends an all-day meeting at Eastern midnight', () => {
    const allDay: Meeting = { ...meeting('2026-10-06', '2026-10-07'), allDay: true }
    expect(isUpcoming(allDay, new Date('2026-10-06T23:59:00-04:00'))).toBe(true)
    expect(isUpcoming(allDay, new Date('2026-10-07T00:00:00-04:00'))).toBe(false)
  })
})

describe('mockMeetings', () => {
  // Monday 2026-09-28 through Sunday 2026-10-04; "now" is Monday morning.
  const res = mockMeetings('2026-09-28', '2026-10-04', zonedInstant('2026-09-28', 9))

  it('has Tue/Thu official meetings 17:00–18:15, a Monday 20:00 retro, and one ad hoc with a Meet link', () => {
    const summary = res.meetings.map((m) => [m.kind, m.start, m.end])
    expect(summary).toEqual([
      ['retro', '2026-09-29T00:00:00.000Z', '2026-09-29T01:00:00.000Z'],
      ['official', '2026-09-29T21:00:00.000Z', '2026-09-29T22:15:00.000Z'],
      ['adhoc', '2026-09-30T18:00:00.000Z', '2026-09-30T18:30:00.000Z'],
      ['official', '2026-10-01T21:00:00.000Z', '2026-10-01T22:15:00.000Z'],
    ])
    expect(res.meetings.find((m) => m.kind === 'adhoc')?.joinUrl).toMatch(
      /^https:\/\/meet\.google\.com\//,
    )
  })

  it('gives one official meeting an agenda and the other none, with the mock Drive feed', () => {
    // The mock Drive feed posts agendas on Tuesdays only.
    const joined = joinAgendas(res.meetings, [agenda('2026-09-29')])
    const official = joined.filter((m) => m.kind === 'official')
    expect(official.map((m) => m.agenda === null)).toEqual([false, true])
  })
})
