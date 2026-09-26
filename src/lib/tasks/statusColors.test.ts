import { describe, expect, it } from 'vitest'
import {
  normalizeStatusColor,
  STATUS_COLORS,
  statusColorTokens,
  statusOptionOf,
  tokensForStatusColor,
} from './statusColors'
import type { Task } from './types'

describe('statusColorTokens', () => {
  it.each(STATUS_COLORS)('maps %s to its bg, text, and dot tokens', (color) => {
    const name = color.toLowerCase()
    expect(statusColorTokens[color]).toEqual({
      bg: `bg-status-${name}-bg`,
      text: `text-status-${name}-text`,
      dot: `bg-status-${name}-text`,
    })
  })

  it('covers every GitHub option color', () => {
    expect(Object.keys(statusColorTokens).sort()).toEqual([
      'BLUE',
      'GRAY',
      'GREEN',
      'ORANGE',
      'PINK',
      'PURPLE',
      'RED',
      'YELLOW',
    ])
  })
})

describe('normalizeStatusColor', () => {
  it('accepts GitHub enum values, ignoring case and spaces', () => {
    expect(normalizeStatusColor('GREEN')).toBe('GREEN')
    expect(normalizeStatusColor(' purple ')).toBe('PURPLE')
  })

  it.each(['TEAL', '', null, undefined])('falls back to GRAY for %j', (color) => {
    expect(normalizeStatusColor(color)).toBe('GRAY')
    expect(tokensForStatusColor(color)).toBe(statusColorTokens.GRAY)
  })
})

describe('statusOptionOf', () => {
  const task = (status: string | null): Task => ({
    itemId: 'i',
    contentId: 'c',
    kind: 'draft',
    title: 't',
    assignees: [],
    status,
    statusKey: status === 'Blocked' ? 'blocked' : null,
    updatedAt: '',
  })
  const meta = { statuses: [{ id: 's', name: 'Blocked', key: 'blocked' as const, color: 'RED' }] }

  it("finds the task's option, with its color", () => {
    expect(statusOptionOf(task('Blocked'), meta)?.color).toBe('RED')
  })

  it('falls back to the task’s own name when the option is unknown, and null when unset', () => {
    expect(statusOptionOf(task('Icebox'), meta)).toEqual({ name: 'Icebox', key: null })
    expect(statusOptionOf(task(null), meta)).toBeNull()
  })
})
