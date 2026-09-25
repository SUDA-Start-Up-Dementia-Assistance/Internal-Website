import { X } from 'lucide-react'
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { USE_MOCK_DATA } from '../config/sources'
import { getEmbedUrl, type DriveFile } from '../lib/drive'
import ExternalLinkLabel from './ExternalLinkLabel'

export interface PanelDocument {
  id: string
  label: string
  file: DriveFile
}

interface DocumentPanelProps {
  title: string
  /** One or more documents; with more than one, the panel shows tabs to switch between them. */
  documents: PanelDocument[]
  initialId?: string
  onClose: () => void
}

/**
 * Drive preview in a side panel (full-screen sheet on small screens). Mount it to open it
 * and unmount it in onClose. A native modal <dialog> provides the focus trap, Esc to close,
 * and makes the page behind it inert.
 */
export default function DocumentPanel({
  title,
  documents,
  initialId,
  onClose,
}: DocumentPanelProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const baseId = useId()
  const [activeId, setActiveId] = useState(initialId ?? documents[0]?.id)
  const active = documents.find((d) => d.id === activeId) ?? documents[0]
  const hasTabs = documents.length > 1

  useEffect(() => {
    const dialog = ref.current
    const returnFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null
    if (dialog && !dialog.open) {
      dialog.showModal()
      // Start on the selected tab (or the close button) rather than the first link.
      dialog.querySelector<HTMLElement>('[data-initial-focus]')?.focus()
    }
    // Don't call dialog.close() here: it fires the close event, which would call onClose
    // (and in StrictMode's mount/unmount/mount, close the panel right after opening it).
    // Unmounting removes the <dialog>, which ends its modal state anyway.
    return () => returnFocus?.focus()
  }, [])

  if (!active) return null

  const tabId = (id: string) => `${baseId}-tab-${id}`
  const panelId = `${baseId}-panel`
  const titleId = `${baseId}-title`

  function onTabKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    const index = documents.findIndex((d) => d.id === active.id)
    const next =
      e.key === 'ArrowRight'
        ? (index + 1) % documents.length
        : e.key === 'ArrowLeft'
          ? (index - 1 + documents.length) % documents.length
          : e.key === 'Home'
            ? 0
            : e.key === 'End'
              ? documents.length - 1
              : null
    if (next === null) return
    e.preventDefault()
    setActiveId(documents[next].id)
    document.getElementById(tabId(documents[next].id))?.focus()
  }

  // Mock files have fake IDs that Drive can't embed.
  const src = USE_MOCK_DATA ? undefined : getEmbedUrl(active.file)

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => {
        // A click on the backdrop lands on the <dialog> element itself.
        if (e.target === e.currentTarget) ref.current?.close()
      }}
      className="m-0 ml-auto h-dvh max-h-none w-full max-w-none bg-surface text-night shadow-photo backdrop:bg-night/50 open:flex open:flex-col motion-safe:animate-panel-in sm:w-[min(56rem,75vw)] sm:rounded-l-2xl"
    >
      <header className="border-b border-night/10 px-5 pt-4 sm:px-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 id={titleId} className="truncate text-xl font-semibold">
              {title}
            </h2>
            <p className="truncate text-sm text-dusk">{active.file.name}</p>
          </div>
          <button
            type="button"
            onClick={() => ref.current?.close()}
            data-initial-focus={hasTabs ? undefined : true}
            className="-mr-2 shrink-0 rounded-md p-2 text-dusk hover:text-night"
          >
            <X aria-hidden="true" className="size-5" />
            <span className="sr-only">Close preview</span>
          </button>
        </div>

        <div className="mt-2 flex items-end justify-between gap-4">
          {hasTabs ? (
            <div role="tablist" aria-label="Documents" className="flex gap-6">
              {documents.map((doc) => {
                const selected = doc.id === active.id
                return (
                  <button
                    key={doc.id}
                    id={tabId(doc.id)}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    aria-controls={panelId}
                    tabIndex={selected ? 0 : -1}
                    data-initial-focus={selected ? true : undefined}
                    onClick={() => setActiveId(doc.id)}
                    onKeyDown={onTabKeyDown}
                    className={`-mb-px rounded-t-sm border-b-2 pb-2.5 text-sm font-medium transition-colors ${
                      selected
                        ? 'border-ember text-night'
                        : 'border-transparent text-dusk hover:text-night'
                    }`}
                  >
                    {doc.label}
                  </button>
                )
              })}
            </div>
          ) : (
            <span />
          )}
          <a
            href={active.file.webViewLink}
            target="_blank"
            rel="noreferrer"
            className="mb-2.5 inline-flex shrink-0 items-center gap-1.5 rounded-sm text-sm font-medium text-ember hover:underline hover:underline-offset-4"
          >
            Open in Drive
            <ExternalLinkLabel />
          </a>
        </div>
      </header>

      <div
        id={panelId}
        role={hasTabs ? 'tabpanel' : undefined}
        aria-labelledby={hasTabs ? tabId(active.id) : undefined}
        className="min-h-0 flex-1 bg-cream"
      >
        {src ? (
          <iframe
            key={active.file.id}
            src={src}
            title={`Preview of ${active.file.name}`}
            className="size-full"
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
            <p className="font-heading text-lg">Preview unavailable for sample data</p>
            <p className="max-w-sm text-dusk">
              Once Drive is connected, &ldquo;{active.file.name}&rdquo; will appear here.
            </p>
          </div>
        )}
      </div>
    </dialog>
  )
}
