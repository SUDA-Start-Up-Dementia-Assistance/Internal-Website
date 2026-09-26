// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AuthState } from '../../lib/auth'
import { AuthContext } from '../../lib/auth/context'
import HiddenItemsNotice from './HiddenItemsNotice'

afterEach(cleanup)

function renderNotice(count: number) {
  const signIn = vi.fn()
  const auth: AuthState = {
    user: { login: 'ada', name: 'Ada', avatarUrl: '' },
    loading: false,
    authAvailable: true,
    signIn,
    signOut: vi.fn(),
  }
  render(
    <AuthContext value={auth}>
      <HiddenItemsNotice count={count} />
    </AuthContext>,
  )
  return signIn
}

describe('HiddenItemsNotice', () => {
  it('renders nothing when no items are hidden', () => {
    renderNotice(0)
    expect(screen.queryByRole('heading')).toBeNull()
  })

  it('says how many items are hidden and offers to sign in again', () => {
    const signIn = renderNotice(3)
    expect(screen.getByRole('heading').textContent).toMatch(/3 project items are hidden/)
    fireEvent.click(screen.getByRole('button', { name: 'Sign in again' }))
    expect(signIn).toHaveBeenCalledWith('/tasks')
  })
})
