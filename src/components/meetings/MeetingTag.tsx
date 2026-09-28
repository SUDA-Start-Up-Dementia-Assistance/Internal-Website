import type { Meeting } from '../../lib/meetings'

/**
 * The meeting's tag: "Retro" for retros, "Recurring" for any other event that's part of a
 * repeating series in Google Calendar, and none for one-off events. Always text, never color
 * alone.
 */
export default function MeetingTag({ meeting }: { meeting: Meeting }) {
  const tag =
    meeting.kind === 'retro'
      ? { label: 'Retro', className: 'bg-status-purple-bg text-status-purple-text' }
      : meeting.recurring
        ? { label: 'Recurring', className: 'bg-status-blue-bg text-status-blue-text' }
        : null
  if (!tag) return null
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${tag.className}`}>
      {tag.label}
    </span>
  )
}

/** Shown while a meeting is in progress. Text, with a decorative pulsing dot. */
export function HappeningNowBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-ink">
      <span
        aria-hidden="true"
        className="size-1.5 rounded-full bg-on-accent motion-safe:animate-pulse"
      />
      Happening now
    </span>
  )
}
