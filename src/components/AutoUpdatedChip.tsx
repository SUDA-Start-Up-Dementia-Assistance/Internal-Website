import { RefreshCw } from 'lucide-react'

/** Small tag signalling that content is pulled automatically from Drive. */
export default function AutoUpdatedChip() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-night/5 px-2.5 py-1 font-body text-xs font-medium text-dusk">
      <RefreshCw aria-hidden="true" className="size-3.5" />
      Auto-updated
    </span>
  )
}
