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
  doc: { icon: FileText, className: 'bg-lavender/20 text-dusk' },
  slides: { icon: Presentation, className: 'bg-apricot/20 text-ember' },
  sheet: { icon: FileSpreadsheet, className: 'bg-gold/25 text-night' },
  pdf: { icon: FileType, className: 'bg-ember/10 text-ember' },
  other: { icon: File, className: 'bg-night/5 text-dusk' },
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
