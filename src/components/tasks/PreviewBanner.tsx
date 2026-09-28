import { FlaskConical } from 'lucide-react'
import { isSampleMode } from '../../lib/sampleMode'

/**
 * Shown whenever the Tasks UI runs on sample data (a preview deployment without sign-in, or
 * VITE_TASKS_MOCK), so nobody mistakes it for the team's real GitHub Project.
 */
export default function PreviewBanner() {
  if (!isSampleMode()) return null
  return (
    <section
      aria-labelledby="preview-banner-title"
      className="flex gap-3 rounded-2xl bg-accent/25 p-4 text-ink"
    >
      <FlaskConical aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-link" />
      <div className="min-w-0">
        <h2 id="preview-banner-title" className="font-body font-semibold">
          Preview: sample data
        </h2>
        <p className="mt-1 text-sm">
          Sign-in isn&apos;t set up on this version of the site, so these are made-up tasks, not the
          team&apos;s GitHub Project. Changes stay in this browser tab and never reach GitHub.
        </p>
      </div>
    </section>
  )
}
