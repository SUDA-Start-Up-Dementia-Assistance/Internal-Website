import {
  File,
  FileSpreadsheet,
  FileText,
  FileType,
  Presentation,
  type LucideIcon,
} from 'lucide-react'
import { FILE_KIND_LABEL, fileKind, type FileKind } from '../lib/files'

const STYLE: Record<FileKind, { icon: LucideIcon; className: string }> = {
  doc: { icon: FileText, className: 'bg-status-purple-bg text-status-purple-text' },
  slides: { icon: Presentation, className: 'bg-accent/20 text-link' },
  sheet: { icon: FileSpreadsheet, className: 'bg-status-yellow-bg text-status-yellow-text' },
  pdf: { icon: FileType, className: 'bg-link/10 text-link' },
  other: { icon: File, className: 'bg-ink/5 text-ink-muted' },
}

interface FileTypeIconProps {
  mimeType: string
  size?: 'sm' | 'lg'
}

/** A tinted file-type badge. The kind is announced to screen readers ("PDF", "Slides"). */
export default function FileTypeIcon({ mimeType, size = 'sm' }: FileTypeIconProps) {
  const kind = fileKind(mimeType)
  const { icon: Icon, className } = STYLE[kind]
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-lg ${className} ${
        size === 'lg' ? 'size-12' : 'size-9'
      }`}
    >
      <Icon aria-hidden="true" className={size === 'lg' ? 'size-6' : 'size-4.5'} />
      <span className="sr-only">{FILE_KIND_LABEL[kind]}</span>
    </span>
  )
}
