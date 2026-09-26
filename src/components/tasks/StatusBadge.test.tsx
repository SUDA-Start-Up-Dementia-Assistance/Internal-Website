// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import StatusBadge from './StatusBadge'

afterEach(cleanup)

describe('StatusBadge', () => {
  it('renders the status name as text, tinted with its color', () => {
    render(<StatusBadge status={{ name: 'In review', key: 'inReview', color: 'PURPLE' }} />)
    const badge = screen.getByText('In review')
    expect(badge.className).toContain('bg-status-purple-bg')
    expect(badge.className).toContain('text-status-purple-text')
    // A decorative dot, hidden from screen readers.
    const dot = badge.querySelector('[aria-hidden="true"]')!
    expect(dot.tagName).toBe('SPAN')
    expect(dot.className).toContain('bg-status-purple-text')
  })

  it('uses GRAY for an unknown or missing color', () => {
    render(<StatusBadge status={{ name: 'Icebox' }} />)
    expect(screen.getByText('Icebox').className).toContain('bg-status-gray-bg')
  })

  it('shows an alert icon instead of the dot for Blocked, still with the text', () => {
    render(<StatusBadge status={{ name: 'Blocked', key: 'blocked', color: 'RED' }} />)
    const badge = screen.getByText('Blocked')
    expect(badge.querySelector('svg[aria-hidden="true"]')).not.toBeNull()
    expect(badge.querySelector('span[aria-hidden="true"]')).toBeNull()
  })
})
