import { describe, expect, it } from 'vitest'
import { createState, sanitizeReturnTo, sealState, unsealState, verifyState } from './oauth.js'

const SECRET = 'test-secret-that-is-definitely-32-chars-long!'

describe('sanitizeReturnTo', () => {
  it.each([
    ['/tasks', '/tasks'],
    ['/', '/'],
    ['/agendas?show=4ups#past', '/agendas?show=4ups#past'],
    ['  /artifacts  ', '/artifacts'],
    ['/a/../tasks', '/tasks'],
  ])('keeps the relative path %j → %j', (input, expected) => {
    expect(sanitizeReturnTo(input)).toBe(expected)
  })

  it.each([
    'https://evil.example',
    '//evil.example/path',
    '/\\evil.example',
    '\\\\evil.example',
    'javascript:alert(1)',
    'tasks',
    '',
    '/tasks\r\nSet-Cookie: x=1',
    '/\tevil',
    '/' + 'a'.repeat(600),
  ])('rejects %j', (input) => {
    expect(sanitizeReturnTo(input)).toBe('/tasks')
  })

  it.each([undefined, null, 42, ['/tasks', '/admin']])(
    'defaults non-strings (%j) to /tasks',
    (input) => {
      expect(sanitizeReturnTo(input)).toBe('/tasks')
    },
  )
})

describe('verifyState', () => {
  it('accepts the exact state we issued', () => {
    const state = createState()
    expect(verifyState(state, state)).toBe(true)
  })

  it('rejects a different state, including one of a different length', () => {
    const state = createState()
    expect(verifyState(state, createState())).toBe(false)
    expect(verifyState(state, state.slice(1))).toBe(false)
    expect(verifyState(state, state + 'x')).toBe(false)
  })

  it('rejects missing or malformed values', () => {
    expect(verifyState(undefined, 'abc')).toBe(false)
    expect(verifyState('abc', undefined)).toBe(false)
    expect(verifyState('abc', '')).toBe(false)
    expect(verifyState('abc', ['abc'])).toBe(false)
  })

  it('issues long, unpredictable states', () => {
    const states = new Set(Array.from({ length: 50 }, createState))
    expect(states.size).toBe(50)
    expect(createState().length).toBeGreaterThanOrEqual(43)
  })
})

describe('state cookie', () => {
  it('round-trips the state and returnTo', async () => {
    const sealed = await sealState({ state: 'abc', returnTo: '/agendas' }, SECRET)
    expect(await unsealState(sealed, SECRET)).toEqual({ state: 'abc', returnTo: '/agendas' })
  })

  it('re-sanitizes returnTo on the way out', async () => {
    const sealed = await sealState({ state: 'abc', returnTo: '//evil.example' }, SECRET)
    expect((await unsealState(sealed, SECRET))?.returnTo).toBe('/tasks')
  })

  it('rejects a tampered or foreign cookie', async () => {
    const sealed = await sealState({ state: 'abc', returnTo: '/tasks' }, SECRET)
    expect(await unsealState(sealed.slice(0, -3) + 'AAA', SECRET)).toBeNull()
    expect(await unsealState(sealed, 'another-secret-that-is-also-32-chars-long')).toBeNull()
  })
})
