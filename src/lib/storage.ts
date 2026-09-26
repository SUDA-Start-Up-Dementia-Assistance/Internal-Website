/**
 * localStorage wrappers that never throw: storage can be unavailable (private browsing,
 * blocked site data), and a preference is never worth crashing over.
 */
export function readPreference<T extends string>(
  key: string,
  allowed: readonly T[],
  fallback: T,
): T {
  try {
    const value = window.localStorage.getItem(key)
    return allowed.includes(value as T) ? (value as T) : fallback
  } catch {
    return fallback
  }
}

export function writePreference(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // Ignore: the preference just won't persist.
  }
}
