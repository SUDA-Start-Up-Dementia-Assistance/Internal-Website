import type { ButtonSize, ButtonVariant } from './buttonStyles'
import { buttonClasses } from './buttonStyles'
import ExternalLinkLabel from './ExternalLinkLabel'

interface ExternalButtonLinkProps {
  href: string
  children: React.ReactNode
  variant?: ButtonVariant
  size?: ButtonSize
  /** Extra context for screen readers, e.g. the file name. */
  describedBy?: string
}

/** A button-styled link that opens in a new tab, e.g. "Open in Drive". */
export default function ExternalButtonLink({
  href,
  children,
  variant = 'secondary',
  size = 'md',
  describedBy,
}: ExternalButtonLinkProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-describedby={describedBy}
      className={buttonClasses(variant, size)}
    >
      {children}
      <ExternalLinkLabel />
    </a>
  )
}
