import { formatMonth } from '../../lib/dates'
import type { MeetingFilter } from '../../lib/selectors'

const SHOW_OPTIONS: { value: MeetingFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'agendas', label: 'Agendas' },
  { value: 'fourUps', label: '4Ups' },
]

interface AgendaFiltersProps {
  show: MeetingFilter
  onShowChange: (show: MeetingFilter) => void
  month: string
  months: { key: string; date: Date }[]
  onMonthChange: (month: string) => void
}

/** "Show" segmented control (native radios, so arrow keys work) and a month filter. */
export default function AgendaFilters({
  show,
  onShowChange,
  month,
  months,
  onMonthChange,
}: AgendaFiltersProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <fieldset className="flex items-center gap-3">
        <legend className="float-left mr-3 text-sm font-medium text-dusk">Show</legend>
        <div className="inline-flex rounded-full bg-night/5 p-1">
          {SHOW_OPTIONS.map((option) => (
            <label key={option.value} className="cursor-pointer">
              <input
                type="radio"
                name="agenda-show"
                value={option.value}
                checked={show === option.value}
                onChange={() => onShowChange(option.value)}
                className="peer sr-only"
              />
              <span className="block rounded-full px-4 py-1.5 text-sm font-medium text-dusk transition-colors peer-checked:bg-surface peer-checked:text-night peer-checked:shadow-card peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ember hover:text-night">
                {option.label}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <label className="flex items-center gap-3 text-sm font-medium text-dusk">
        Month
        <select
          value={month}
          onChange={(e) => onMonthChange(e.target.value)}
          className="rounded-full border border-night/15 bg-surface py-1.5 pr-8 pl-4 text-night"
        >
          <option value="all">All months</option>
          {months.map((m) => (
            <option key={m.key} value={m.key}>
              {formatMonth(m.date)}
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}
