/** A pulsing placeholder block. Size it with className (e.g. "h-6 w-40"). */
export default function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`rounded-md bg-night/10 motion-safe:animate-pulse ${className}`}
    />
  )
}
