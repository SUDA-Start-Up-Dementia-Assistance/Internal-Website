import { useSyncExternalStore } from 'react'

/*
 * App-wide toasts: small, self-dismissing notes about background work ("Saved to GitHub").
 * A module-level store, like the tasks cache, so any code can raise one.
 */

export type ToastKind = 'success' | 'error'

export interface Toast {
  id: number
  kind: ToastKind
  message: string
}

/** Errors stay long enough to read; confirmations are meant to be glanced at. */
const DURATION_MS: Record<ToastKind, number> = { success: 2500, error: 8000 }
/** Older toasts drop off beyond this many. */
const MAX_TOASTS = 4

let toasts: Toast[] = []
let nextId = 1
const listeners = new Set<() => void>()

function set(next: Toast[]): void {
  toasts = next
  for (const listener of listeners) listener()
}

export function dismissToast(id: number): void {
  set(toasts.filter((t) => t.id !== id))
}

export function showToast(kind: ToastKind, message: string): void {
  const id = nextId++
  set([...toasts, { id, kind, message }].slice(-MAX_TOASTS))
  setTimeout(() => dismissToast(id), DURATION_MS[kind])
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useToasts(): Toast[] {
  return useSyncExternalStore(subscribe, () => toasts)
}
