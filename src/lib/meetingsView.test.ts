import { describe, expect, it } from 'vitest'
import type { Meeting } from './meetings'
import {
  DEFAULT_HOURS,
  groupByWeekAndDay,
  layoutDay,
  weekHourRange,
  weekStartKey,
} from './meetingsView'
import { zonedInstant } from './teamTime'

function meeting(id: string, start: Date, end: Date, fields: Partial<Meeting> = {}): Meeting {
  return {
    id,
    title: id,
    start: start.toISOString(),
    end: end.toISOString(),
    allDay: false,
    kind: 'official',
    recurring: true,
    htmlLink: 'https://calendar.google.com/',
    ...fields,
  }
}

/** A meeting on `day` from h1:m1 to h2:m2, New York time. */
const at = (id: string, day: string, [h1, m1]: number[], [h2, m2]: number[]) =>
  meeting(id, zonedInstant(day, h1, m1), zonedInstant(day, h2, m2))

describe('weekStartKey', () => {
  it('starts weeks on Monday', () => {
    expect(weekStartKey('2026-09-28')).toBe('2026-09-28') // Monday
    expect(weekStartKey('2026-10-01')).toBe('2026-09-28') // Thursday
    expect(weekStartKey('2026-10-04')).toBe('2026-09-28') // Sunday
  })
})

describe('groupByWeekAndDay', () => {
  it('groups by New York date across the end of DST (Sun, Nov 1, 2026)', () => {
    // Saturday 8pm EDT is Sunday 00:00 UTC; Sunday 8pm EST is Monday 01:00 UTC. Grouping by
    // UTC date would push both a day late.
    const sat = at('sat', '2026-10-31', [20, 0], [21, 0])
    const sun = at('sun', '2026-11-01', [20, 0], [21, 0])
    const sunEarly = at('sun-early', '2026-11-01', [1, 30], [2, 30]) // the repeated hour
    const mon = at('mon', '2026-11-02', [20, 0], [21, 0])
    expect(sat.start).toBe('2026-11-01T00:00:00.000Z')
    expect(sun.start).toBe('2026-11-02T01:00:00.000Z')

    const sections = groupByWeekAndDay([mon, sun, sat, sunEarly], '2026-10-28')
    expect(sections.map((s) => s.heading)).toEqual(['This week', 'Next week'])
    expect(
      sections.flatMap((s) => s.days.map((d) => [d.label, d.meetings.map((m) => m.id)])),
    ).toEqual([
      ['Sat, Oct 31', ['sat']],
      ['Sun, Nov 1', ['sun-early', 'sun']],
      ['Mon, Nov 2', ['mon']],
    ])
  })

  it('puts meetings under This week, Next week, and Later (Monday–Sunday weeks)', () => {
    const sections = groupByWeekAndDay(
      [
        at('a', '2026-10-04', [17, 0], [18, 0]), // Sunday, this week
        at('b', '2026-10-05', [17, 0], [18, 0]), // Monday, next week
        at('c', '2026-10-12', [17, 0], [18, 0]), // later
      ],
      '2026-09-30',
    )
    expect(sections.map((s) => [s.heading, s.days.map((d) => d.dateKey)])).toEqual([
      ['This week', ['2026-10-04']],
      ['Next week', ['2026-10-05']],
      ['Later', ['2026-10-12']],
    ])
  })

  it('groups all-day events by their date', () => {
    const allDay = meeting('demo', new Date(0), new Date(0), {
      allDay: true,
      start: '2026-10-06',
      end: '2026-10-07',
    })
    expect(groupByWeekAndDay([allDay], '2026-09-30')[0].days[0].dateKey).toBe('2026-10-06')
  })
})

describe('weekHourRange', () => {
  const WEEK = '2026-09-28'

  it('defaults to 4pm–9pm when the week fits', () => {
    expect(weekHourRange([], WEEK)).toEqual(DEFAULT_HOURS)
    expect(weekHourRange([at('tm', '2026-09-29', [17, 0], [18, 15])], WEEK)).toEqual({
      start: 16,
      end: 21,
    })
  })

  it('widens to whole hours that fit every meeting in the week', () => {
    const range = weekHourRange(
      [at('lunch', '2026-09-30', [11, 30], [12, 15]), at('late', '2026-10-02', [20, 30], [21, 45])],
      WEEK,
    )
    expect(range).toEqual({ start: 11, end: 22 })
  })

  it('runs to midnight for a meeting that crosses it', () => {
    const overnight = meeting(
      'hack',
      zonedInstant('2026-10-01', 22, 0),
      zonedInstant('2026-10-02', 1, 0),
    )
    expect(weekHourRange([overnight], WEEK)).toEqual({ start: 16, end: 24 })
  })

  it('ignores all-day events and meetings in other weeks', () => {
    const allDay = meeting('demo', new Date(0), new Date(0), {
      allDay: true,
      start: '2026-09-30',
      end: '2026-10-01',
    })
    const nextWeek = at('early', '2026-10-05', [8, 0], [9, 0])
    expect(weekHourRange([allDay, nextWeek], WEEK)).toEqual(DEFAULT_HOURS)
  })

  it('uses New York hours on DST days', () => {
    expect(weekHourRange([at('x', '2026-11-01', [9, 0], [10, 0])], '2026-10-26')).toEqual({
      start: 9,
      end: 21,
    })
  })
})

describe('layoutDay', () => {
  it('places meetings by time and puts overlaps side by side', () => {
    const hours = { start: 16, end: 21 }
    const placed = layoutDay(
      [
        at('a', '2026-09-29', [17, 0], [18, 15]),
        at('b', '2026-09-29', [17, 30], [18, 0]),
        at('c', '2026-09-29', [19, 0], [20, 0]),
      ],
      hours,
    )
    const byId = Object.fromEntries(placed.map((p) => [p.meeting.id, p]))
    expect(byId.a).toMatchObject({ top: 20, height: 25, lane: 0, lanes: 2 })
    expect(byId.b).toMatchObject({ lane: 1, lanes: 2 })
    expect(byId.c).toMatchObject({ top: 60, height: 20, lane: 0, lanes: 1 })
  })
})
