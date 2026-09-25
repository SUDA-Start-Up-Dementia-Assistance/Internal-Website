import type { ReactNode } from 'react'

/** Wraps skeletons so screen readers hear "Loading…" instead of nothing. */
export default function LoadingState({ children }: { children: ReactNode }) {
  return (
    <div role="status" aria-busy="true">
      <span className="sr-only">Loading…</span>
      {children}
    </div>
  )
}
