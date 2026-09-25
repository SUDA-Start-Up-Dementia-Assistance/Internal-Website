import { FolderGit2, FolderOpen, MessagesSquare, SquareKanban, type LucideIcon } from 'lucide-react'
import { links, type ExternalLinkConfig } from '../../config/links'
import ExternalLinkLabel from '../ExternalLinkLabel'

const QUICK_LINKS: { link: ExternalLinkConfig; icon: LucideIcon }[] = [
  { link: links.repo, icon: FolderGit2 },
  { link: links.taskBoard, icon: SquareKanban },
  { link: links.teamChat, icon: MessagesSquare },
  { link: links.driveFolder, icon: FolderOpen },
]

export default function QuickLinks() {
  return (
    <section aria-labelledby="quick-links-title">
      <h2 id="quick-links-title" className="text-2xl font-semibold">
        Quick links
      </h2>
      <ul className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        {QUICK_LINKS.map(({ link, icon: Icon }) => (
          <li key={link.label}>
            {link.href ? (
              <a
                href={link.href}
                target="_blank"
                rel="noreferrer"
                className="flex h-full flex-col gap-3 rounded-2xl bg-surface p-5 shadow-card transition hover:text-ember hover:shadow-card-hover motion-safe:hover:-translate-y-0.5"
              >
                <Icon aria-hidden="true" className="size-6 text-ember" />
                <span className="flex items-center gap-1.5 font-medium">
                  {link.label}
                  <ExternalLinkLabel />
                </span>
              </a>
            ) : (
              <div className="flex h-full flex-col gap-3 rounded-2xl border border-dashed border-night/20 p-5">
                <Icon aria-hidden="true" className="size-6 text-dusk" />
                <span className="font-medium">{link.label}</span>
                <span className="text-sm text-dusk">Not set yet</span>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
