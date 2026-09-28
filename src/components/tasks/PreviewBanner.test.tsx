// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { enableSampleMode } from '../../lib/sampleMode'
import PreviewBanner from './PreviewBanner'

afterEach(cleanup)

describe('PreviewBanner', () => {
  it('stays hidden on real data, and labels sample data once it is on', () => {
    const { container } = render(<PreviewBanner />)
    expect(container.textContent).toBe('')
    cleanup()

    enableSampleMode()
    render(<PreviewBanner />)
    expect(screen.getByRole('heading', { name: 'Preview: sample data' })).toBeTruthy()
    expect(screen.getByText(/never reach GitHub/)).toBeTruthy()
  })
})
