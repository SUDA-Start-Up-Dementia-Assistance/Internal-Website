import type { ReactNode } from 'react'

export default function EmptyState({ children }: { children: ReactNode }) {
  return <p className="text-dusk">{children}</p>
}
