import { ExternalLink } from 'lucide-react'

/** Trailing icon + screen-reader hint for links that open in a new tab. */
export default function ExternalLinkLabel() {
  return (
    <>
      <ExternalLink aria-hidden="true" className="size-3.5 shrink-0" />
      <span className="sr-only"> (opens in a new tab)</span>
    </>
  )
}
