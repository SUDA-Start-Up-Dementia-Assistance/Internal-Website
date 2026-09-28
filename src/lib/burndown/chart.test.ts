import { describe, expect, it } from 'vitest'
import {
  addDaysToKey,
  daysBetween,
  daysByDate,
  formatAmount,
  idealLine,
  iterationDates,
  niceScale,
  segments,
  startingScope,
} from './chart'
import type { BurndownDay } from './types'

const day = (date: string, scope: number, done = 0): BurndownDay => ({
  date,
  scope,
  done,
  remaining: scope - done,
  unestimatedCount: 0,
  unit: 'storyPoints',
})

describe('idealLine', () => {
  it('falls in a straight line from the starting scope to 0 on the last day', () => {
    expect(idealLine(20, 5)).toEqual([20, 15, 10, 5, 0])
  })

  it('has one value per day of a two-week sprint, ending exactly at 0', () => {
    const line = idealLine(26, 14)
    expect(line).toHaveLength(14)
    expect(line[0]).toBe(26)
    expect(line[13]).toBe(0)
    expect(line[1]).toBe(24)
    // Evenly spaced.
    for (let i = 1; i < line.length; i++) expect(line[i - 1] - line[i]).toBeCloseTo(2, 5)
  })

  it('rounds uneven steps to 2 decimals', () => {
    expect(idealLine(10, 4)).toEqual([10, 6.67, 3.33, 0])
  })

  it('handles zero scope and degenerate durations', () => {
    expect(idealLine(0, 3)).toEqual([0, 0, 0])
    expect(idealLine(5, 1)).toEqual([0])
    expect(idealLine(5, 0)).toEqual([])
  })
})

describe('startingScope', () => {
  it('is the earliest snapshot’s scope, even when recording began mid-sprint', () => {
    expect(startingScope([day('2026-09-24', 18), day('2026-09-25', 21)])).toBe(18)
    expect(startingScope([])).toBeNull()
  })
})

describe('iteration dates and gaps', () => {
  it('lists every day of the iteration, across a month end', () => {
    expect(iterationDates('2026-09-29', 4)).toEqual([
      '2026-09-29',
      '2026-09-30',
      '2026-10-01',
      '2026-10-02',
    ])
  })

  it('crosses the DST change without skipping or repeating a day', () => {
    const dates = iterationDates('2026-10-30', 5)
    expect(dates).toEqual(['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02', '2026-11-03'])
    expect(daysBetween('2026-10-30', '2026-11-03')).toBe(4)
    expect(addDaysToKey('2026-03-07', 2)).toBe('2026-03-09')
  })

  it('maps snapshots onto dates, leaving null where nothing was recorded', () => {
    const dates = iterationDates('2026-09-22', 4)
    const byDate = daysByDate([day('2026-09-22', 10), day('2026-09-24', 12)], dates)
    expect(byDate.map((d) => d?.scope ?? null)).toEqual([10, null, 12, null])
  })

  it('splits lines at gaps instead of interpolating', () => {
    expect(segments([5, 4, null, 3, null, null, 1, 0])).toEqual([
      [0, 1],
      [3, 3],
      [6, 7],
    ])
    expect(segments([null, null])).toEqual([])
    expect(segments([1])).toEqual([[0, 0]])
  })
})

describe('niceScale', () => {
  it.each([
    [0, 1],
    [3, 3],
    [21, 25],
    [26, 30],
    [97, 100],
    [130, 150],
  ])('max %d → axis to %d with round ticks', (value, max) => {
    const scale = niceScale(value)
    expect(scale.max).toBe(max)
    expect(scale.ticks[0]).toBe(0)
    expect(scale.ticks.at(-1)).toBe(max)
    expect(scale.ticks.length).toBeLessThanOrEqual(6)
  })

  it('never uses fractional steps (points are whole)', () => {
    expect(niceScale(3).ticks).toEqual([0, 1, 2, 3])
  })
})

describe('formatAmount', () => {
  it('matches the unit and number', () => {
    expect(formatAmount(1, 'storyPoints')).toBe('1 point')
    expect(formatAmount(21, 'storyPoints')).toBe('21 points')
    expect(formatAmount(3.25, 'estimateHours')).toBe('3.3 hours')
    expect(formatAmount(2.5, 'estimateHours')).toBe('2.5 hours')
  })
})
