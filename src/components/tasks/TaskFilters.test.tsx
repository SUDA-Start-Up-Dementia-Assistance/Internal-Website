// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_FILTERS, type TaskMeta } from '../../lib/tasks'
import { createMockTasks } from '../../lib/tasks/mock'
import TaskFilters from './TaskFilters'

afterEach(cleanup)

function renderFilters(meta: TaskMeta) {
  render(<TaskFilters filters={DEFAULT_FILTERS} onChange={vi.fn()} meta={meta} showDoneToggle />)
}

describe('TaskFilters', () => {
  it('shows the Type filter when the project has a Type field', () => {
    renderFilters(createMockTasks().meta)
    expect(screen.getByLabelText('Type')).toBeTruthy()
  })

  it('hides the Type filter when the project has no Type field', () => {
    const meta: TaskMeta = { ...createMockTasks().meta }
    delete meta.types
    renderFilters(meta)
    expect(screen.queryByLabelText('Type')).toBeNull()
    expect(screen.getByLabelText('Status')).toBeTruthy()
  })
})
