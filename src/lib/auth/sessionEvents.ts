/*
 * "The server no longer accepts this session" (GitHub revoked or expired the token, or the
 * cookie expired). Any API caller reports it; AuthProvider listens and signs the user out.
 */
export const SESSION_EXPIRED_MESSAGE =
  'Your GitHub sign-in expired, so you’ve been signed out. Sign in again to continue.'

const listeners = new Set<() => void>()

export function reportSessionExpired(): void {
  for (const listener of listeners) listener()
}

export function onSessionExpired(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
