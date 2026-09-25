import { links } from '../config/links'
import ExternalLinkLabel from './ExternalLinkLabel'

const FOOTER_LINKS = [links.repo, links.driveFolder].filter((link) => link.href)

export default function Footer() {
  return (
    <footer className="bg-night text-cream on-night">
      <div className="horizon-line" aria-hidden="true" />
      <div className="mx-auto flex max-w-5xl flex-col gap-4 px-6 py-8 text-sm sm:flex-row sm:items-center sm:justify-between">
        <p className="text-cream/85">RIT SWEN 561/562 · 2026–27</p>
        {FOOTER_LINKS.length > 0 && (
          <ul className="flex flex-wrap gap-6">
            {FOOTER_LINKS.map((link) => (
              <li key={link.label}>
                <a
                  href={link.href}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-sm text-cream underline decoration-cream/40 underline-offset-4 hover:decoration-gold"
                >
                  {link.label}
                  <ExternalLinkLabel />
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </footer>
  )
}
