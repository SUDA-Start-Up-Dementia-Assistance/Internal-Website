import { describe, expect, it } from 'vitest'
import { formatDayMonth, formatRelative } from './dates'

const NOW = new Date(2026, 8, 26, 15, 0)

describe('formatRelative', () => {
  it.each([
    [new Date(2026, 8, 26, 1, 0), 'today'],
    [new Date(2026, 8, 25, 23, 0), 'yesterday'],
    [new Date(2026, 8, 23), '3 days ago'],
    [new Date(2026, 8, 12), '2 weeks ago'],
    [new Date(2026, 7, 20), 'last month'],
    [new Date(2026, 3, 1), '6 months ago'],
    [new Date(2024, 8, 1), '2 years ago'],
  ])('%s → %s', (when, expected) => {
    expect(formatRelative(when, NOW)).toBe(expected)
  })

  it('accepts ISO timestamps', () => {
    expect(formatRelative('2026-09-23T12:00:00.000Z', NOW)).toBe('3 days ago')
  })
})

describe('formatDayMonth', () => {
  it('omits the year for the current year', () => {
    expect(formatDayMonth(new Date(2026, 8, 29), NOW)).toBe('Sep 29')
  })

  it('includes the year otherwise', () => {
    expect(formatDayMonth(new Date(2025, 11, 2), NOW)).toBe('Dec 2, 2025')
  })
})
