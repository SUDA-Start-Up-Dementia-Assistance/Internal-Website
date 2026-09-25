import { CircleAlert, RotateCw } from 'lucide-react'
import { buttonClasses } from './buttonStyles'

interface ErrorStateProps {
  message?: string
  onRetry: () => void
}

export default function ErrorState({
  message = "We couldn't load this right now.",
  onRetry,
}: ErrorStateProps) {
  return (
    <div role="alert" className="flex flex-col items-start gap-4">
      <p className="flex items-center gap-2 text-dusk">
        <CircleAlert aria-hidden="true" className="size-4 text-ember" />
        {message}
      </p>
      <button type="button" onClick={onRetry} className={buttonClasses('secondary')}>
        <RotateCw aria-hidden="true" className="size-4" />
        Try again
      </button>
    </div>
  )
}
