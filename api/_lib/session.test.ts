import { afterEach, describe, expect, it, vi } from 'vitest'
import { deriveKey, seal } from './crypto.js'
import { ConfigError } from './env.js'
import { decryptSession, encryptSession, type Session } from './session.js'

const SECRET = 'test-secret-that-is-definitely-32-chars-long!'
const SESSION: Session = {
  token: 'gho_exampletoken',
  user: { login: 'octocat', name: 'Octo Cat', avatarUrl: 'https://example.com/a.png' },
}

afterEach(() => {
  vi.useRealTimers()
})

describe('session encryption', () => {
  it('round-trips a session', async () => {
    const sealed = await encryptSession(SESSION, SECRET)
    expect(await decryptSession(sealed, SECRET)).toEqual(SESSION)
  })

  it('never exposes the token in the cookie value', async () => {
    const sealed = await encryptSession(SESSION, SECRET)
    expect(sealed).not.toContain('gho_exampletoken')
    expect(Buffer.from(sealed.split('.')[3], 'base64url').toString('latin1')).not.toContain('gho_')
  })

  it('rejects a tampered ciphertext', async () => {
    const parts = (await encryptSession(SESSION, SECRET)).split('.')
    const ciphertext = parts[3]
    const flipped = (ciphertext[0] === 'A' ? 'B' : 'A') + ciphertext.slice(1)
    expect(
      await decryptSession([...parts.slice(0, 3), flipped, parts[4]].join('.'), SECRET),
    ).toBeNull()
  })

  it('rejects a tampered authentication tag or header', async () => {
    const parts = (await encryptSession(SESSION, SECRET)).split('.')
    const badTag = [...parts.slice(0, 4), parts[4].slice(0, -2) + 'AA'].join('.')
    const badHeader = [
      Buffer.from('{"alg":"dir","enc":"A128GCM"}').toString('base64url'),
      ...parts.slice(1),
    ].join('.')
    expect(await decryptSession(badTag, SECRET)).toBeNull()
    expect(await decryptSession(badHeader, SECRET)).toBeNull()
  })

  it('rejects garbage and cookies sealed with a different secret', async () => {
    expect(await decryptSession('not-a-jwe', SECRET)).toBeNull()
    const other = await encryptSession(SESSION, 'a-completely-different-secret-of-32+-chars')
    expect(await decryptSession(other, SECRET)).toBeNull()
  })

  it('rejects an expired session (after 7 days)', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-01T12:00:00Z'))
    const sealed = await encryptSession(SESSION, SECRET)
    vi.setSystemTime(new Date('2026-09-07T11:00:00Z'))
    expect(await decryptSession(sealed, SECRET)).toEqual(SESSION)
    vi.setSystemTime(new Date('2026-09-08T12:00:01Z'))
    expect(await decryptSession(sealed, SECRET)).toBeNull()
  })

  it('rejects a well-formed payload that is missing session fields', async () => {
    const sealed = await seal({ user: SESSION.user }, deriveKey(SECRET, 'session'), 60)
    expect(await decryptSession(sealed, SECRET)).toBeNull()
  })

  it('does not accept an OAuth-state cookie as a session (keys are separated by purpose)', async () => {
    const stateCookie = await seal({ ...SESSION }, deriveKey(SECRET, 'oauth-state'), 60)
    expect(await decryptSession(stateCookie, SECRET)).toBeNull()
  })

  it('refuses a SESSION_SECRET shorter than 32 characters', async () => {
    await expect(encryptSession(SESSION, 'too-short')).rejects.toBeInstanceOf(ConfigError)
  })
})
