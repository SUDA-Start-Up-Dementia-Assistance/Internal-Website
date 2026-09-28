import { describe, expect, it } from 'vitest'
import { businessDaysInclusive, businessHoursBetween, isPastSla } from './businessTime'
import { zonedInstant } from './teamTime'

/** An instant from America/New_York wall-clock time. */
const ny = (dateKey: string, hour: number, minute = 0) => zonedInstant(dateKey, hour, minute)

describe('isPastSla (1 business day, Mon–Fri America/New_York)', () => {
  // 2026-10-02 is a Friday.
  const fridayFourPm = ny('2026-10-02', 16)

  it('a Friday 4pm request is not late until Monday 4pm', () => {
    expect(isPastSla(fridayFourPm, ny('2026-10-02', 23, 59))).toBe(false)
    expect(isPastSla(fridayFourPm, ny('2026-10-04', 23, 59))).toBe(false) // Sunday night
    expect(isPastSla(fridayFourPm, ny('2026-10-05', 15, 59))).toBe(false) // Monday 3:59pm
    expect(isPastSla(fridayFourPm, ny('2026-10-05', 16))).toBe(true) // Monday 4pm
  })

  it('a Tuesday request is late 24 hours later', () => {
    const tuesday = ny('2026-09-29', 10)
    expect(isPastSla(tuesday, ny('2026-09-30', 9, 59))).toBe(false)
    expect(isPastSla(tuesday, ny('2026-09-30', 10))).toBe(true)
  })

  it('a weekend request starts the clock Monday at midnight', () => {
    const saturday = ny('2026-10-03', 11)
    expect(isPastSla(saturday, ny('2026-10-05', 23, 59))).toBe(false)
    expect(isPastSla(saturday, ny('2026-10-06', 0))).toBe(true)
  })

  it('judges weekdays in New York, not UTC (Friday 9pm Eastern is Saturday in UTC)', () => {
    const fridayNine = ny('2026-10-02', 21)
    expect(fridayNine.toISOString()).toBe('2026-10-03T01:00:00.000Z')
    // 3 business hours Friday night, then 21 on Monday.
    expect(isPastSla(fridayNine, ny('2026-10-05', 20, 59))).toBe(false)
    expect(isPastSla(fridayNine, ny('2026-10-05', 21))).toBe(true)
  })
})

describe('businessHoursBetween', () => {
  it('skips the weekend', () => {
    expect(businessHoursBetween(ny('2026-10-02', 12), ny('2026-10-05', 12))).toBe(24)
  })

  it('is 0 when b is not after a', () => {
    const t = ny('2026-10-01', 9)
    expect(businessHoursBetween(t, t)).toBe(0)
    expect(businessHoursBetween(t, ny('2026-09-30', 9))).toBe(0)
  })

  it('is unaffected by DST changes, which happen on (non-business) Sundays', () => {
    // Monday 2026-11-02 to Tuesday 2026-11-03, the week after DST ends: a plain 24h.
    expect(businessHoursBetween(ny('2026-11-02', 9), ny('2026-11-03', 9))).toBe(24)
    // Friday 2027-03-12 noon → Monday 2027-03-15 noon, straddling the spring-forward Sunday.
    expect(businessHoursBetween(ny('2027-03-12', 12), ny('2027-03-15', 12))).toBe(24)
  })
})

describe('businessDaysInclusive', () => {
  it('counts weekdays, both ends included', () => {
    expect(businessDaysInclusive('2026-09-28', '2026-10-02')).toBe(5) // Mon–Fri
    expect(businessDaysInclusive('2026-10-02', '2026-10-05')).toBe(2) // Fri–Mon
    expect(businessDaysInclusive('2026-10-03', '2026-10-04')).toBe(0) // weekend
    expect(businessDaysInclusive('2026-10-05', '2026-10-02')).toBe(0) // reversed
  })
})
