import { hkdfSync } from 'node:crypto'
import { EncryptJWT, jwtDecrypt, type JWTPayload } from 'jose'
import { ConfigError } from './env.js'

const MIN_SECRET_LENGTH = 32

/** A 256-bit key derived from a secret; `purpose` keeps keys for different cookies separate. */
export function deriveKey(secret: string, purpose: string): Uint8Array {
  if (secret.length < MIN_SECRET_LENGTH) {
    throw new ConfigError(`SESSION_SECRET must be at least ${MIN_SECRET_LENGTH} characters.`)
  }
  return new Uint8Array(hkdfSync('sha256', secret, 'dawn-team-site', purpose, 32))
}

/** Encrypts a payload as a compact JWE (dir + A256GCM), which also authenticates it. */
export async function seal(
  payload: JWTPayload,
  key: Uint8Array,
  maxAgeSeconds: number,
): Promise<string> {
  return new EncryptJWT(payload)
    .setProtectedHeader({ alg: 'dir', enc: 'A256GCM' })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + maxAgeSeconds)
    .encrypt(key)
}

/** Decrypts and validates; null if tampered, expired, or sealed with another key. */
export async function unseal(token: string, key: Uint8Array): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtDecrypt(token, key, {
      keyManagementAlgorithms: ['dir'],
      contentEncryptionAlgorithms: ['A256GCM'],
    })
    return payload
  } catch {
    return null
  }
}
