import { AlertTriangle, CheckCircle2, CircleDashed, Clock, XCircle } from 'lucide-react'
import type { ReactNode } from 'react'
import type { CiState, DashboardPr } from '../../lib/dashboard'
import ExternalLinkLabel from '../ExternalLinkLabel'

const CI: Record<
  CiState | 'NONE',
  { label: string; icon: typeof CheckCircle2; className: string }
> = {
  SUCCESS: { label: 'CI passing', icon: CheckCircle2, className: 'text-status-green-text' },
  FAILURE: { label: 'CI failing', icon: XCircle, className: 'text-status-red-text font-medium' },
  PENDING: { label: 'CI running', icon: Clock, className: 'text-status-yellow-text' },
  NONE: { label: 'No CI', icon: CircleDashed, className: 'text-dusk' },
}

/** The head commit's checks: an icon plus a text label (never color alone). */
export function CiStatus({ state }: { state: CiState | null }) {
  const { label, icon: Icon, className } = CI[state ?? 'NONE']
  return (
    <span className={`inline-flex items-center gap-1 text-xs ${className}`}>
      <Icon aria-hidden="true" className="size-3.5 shrink-0" />
      {label}
    </span>
  )
}

/** A process warning ("No demo video"): amber pill with an icon and text. */
export function Warning({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-status-yellow-bg px-2 py-0.5 text-xs font-medium text-status-yellow-text">
      <AlertTriangle aria-hidden="true" className="size-3 shrink-0" />
      {children}
    </span>
  )
}

/** A neutral outlined tag ("Draft"). */
export function Tag({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-night/15 px-2 py-0.5 text-xs font-medium text-dusk">
      {children}
    </span>
  )
}

/** The PR title, opening GitHub in a new tab. */
export function PrTitleLink({ pr }: { pr: DashboardPr }) {
  return (
    <a
      href={pr.url}
      target="_blank"
      rel="noreferrer"
      className="rounded-sm font-medium underline-offset-4 hover:text-ember hover:underline"
    >
      {pr.title}
      <span className="ml-1.5 inline-block align-[-2px] text-dusk">
        <ExternalLinkLabel />
      </span>
    </a>
  )
}
