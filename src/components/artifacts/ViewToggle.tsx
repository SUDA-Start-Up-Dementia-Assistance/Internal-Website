import { LayoutGrid, LayoutList } from 'lucide-react'
import type { FileView } from './FileList'

const OPTIONS: { value: FileView; label: string; icon: typeof LayoutList }[] = [
  { value: 'list', label: 'List', icon: LayoutList },
  { value: 'cards', label: 'Cards', icon: LayoutGrid },
]

interface ViewToggleProps {
  view: FileView
  onChange: (view: FileView) => void
}

export default function ViewToggle({ view, onChange }: ViewToggleProps) {
  return (
    <div role="group" aria-label="View" className="inline-flex rounded-full bg-night/5 p-1">
      {OPTIONS.map(({ value, label, icon: Icon }) => {
        const selected = view === value
        return (
          <button
            key={value}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(value)}
            className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
              selected ? 'bg-surface text-night shadow-card' : 'text-dusk hover:text-night'
            }`}
          >
            <Icon aria-hidden="true" className="size-4" />
            {label}
          </button>
        )
      })}
    </div>
  )
}
