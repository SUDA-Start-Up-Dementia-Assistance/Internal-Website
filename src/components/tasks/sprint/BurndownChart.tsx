import { useEffect, useId, useRef, useState, type PointerEvent, type RefObject } from 'react'
import {
  daysByDate,
  formatAmount,
  formatAxisDate,
  formatLongDate,
  idealLine,
  iterationDates,
  niceScale,
  segments,
  startingScope,
  UNIT_LABELS,
  type BurndownDay,
  type BurndownUnit,
} from '../../../lib/burndown'
import type { Iteration } from '../../../lib/tasks'

export type ChartView = 'burndown' | 'burnup'

interface BurndownChartProps {
  iteration: Iteration
  days: BurndownDay[]
  unit: BurndownUnit
  view: ChartView
  /** Today's date key, when viewing the current sprint: its point is drawn as live. */
  liveDate: string | null
}

interface Series {
  key: string
  label: string
  values: (number | null)[]
  /** Tailwind stroke/fill classes: series color on marks only, never on text. */
  stroke: string
  fill: string
  dashed?: boolean
  /** A reference line: no markers, no end label. */
  reference?: boolean
}

const HEIGHT = 280
const MARGIN = { top: 28, right: 48, bottom: 32, left: 44 }
/** Transparent hit target per day, bigger than the 8px marker. */
const HIT_RADIUS = 12

/** The chart's series for a view, from the day-by-day snapshots. */
function chartSeries(
  view: ChartView,
  byDay: (BurndownDay | null)[],
  ideal: number[] | null,
): Series[] {
  if (view === 'burnup') {
    return [
      {
        key: 'scope',
        label: 'Scope',
        values: byDay.map((d) => d?.scope ?? null),
        stroke: 'stroke-night',
        fill: 'fill-night',
      },
      {
        key: 'done',
        label: 'Done',
        values: byDay.map((d) => d?.done ?? null),
        stroke: 'stroke-apricot',
        fill: 'fill-apricot',
      },
    ]
  }
  return [
    ...(ideal
      ? [
          {
            key: 'ideal',
            label: 'Ideal',
            values: ideal,
            stroke: 'stroke-dusk',
            fill: 'fill-dusk',
            dashed: true,
            reference: true,
          },
        ]
      : []),
    {
      key: 'remaining',
      label: 'Remaining',
      values: byDay.map((d) => d?.remaining ?? null),
      stroke: 'stroke-ember',
      fill: 'fill-ember',
    },
  ]
}

function useWidth(ref: RefObject<HTMLElement | null>, fallback: number): number {
  const [width, setWidth] = useState(fallback)
  useEffect(() => {
    const el = ref.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(([entry]) => {
      setWidth(Math.max(280, Math.round(entry.contentRect.width)))
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [ref])
  return width
}

/**
 * The sprint burndown (Remaining vs. Ideal) or burn-up (Scope vs. Done), as a hand-built,
 * responsive SVG. One x position per iteration day; days with no snapshot are gaps.
 * Accessible: <title>/<desc>, keyboard-focusable points with the same tooltip as hover, and
 * a visually hidden table with every number.
 */
export default function BurndownChart({
  iteration,
  days,
  unit,
  view,
  liveDate,
}: BurndownChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const width = useWidth(containerRef, 640)
  const baseId = useId()
  const [active, setActive] = useState<number | null>(null)
  const [focused, setFocused] = useState<number | null>(null)

  const dates = iterationDates(iteration.startDate, iteration.duration)
  const byDay = daysByDate(days, dates)
  const start = startingScope(days)
  const ideal = start === null ? null : idealLine(start, dates.length)
  const series = chartSeries(view, byDay, ideal)
  const primary = series[series.length - 1]
  const unitLabel = UNIT_LABELS[unit]

  const plotW = width - MARGIN.left - MARGIN.right
  const plotH = HEIGHT - MARGIN.top - MARGIN.bottom
  const allValues = series.flatMap((s) => s.values.filter((v): v is number => v !== null))
  const scale = niceScale(Math.max(0, ...allValues))
  const x = (i: number) =>
    MARGIN.left + (dates.length <= 1 ? plotW / 2 : (i * plotW) / (dates.length - 1))
  const y = (v: number) => MARGIN.top + plotH - (v / scale.max) * plotH

  // Label every k-th day so dates never collide (~56px per label).
  const every = Math.max(1, Math.ceil(dates.length / Math.max(1, Math.floor(plotW / 56))))
  const liveIndex = liveDate ? dates.indexOf(liveDate) : -1
  const recorded = byDay.flatMap((d, i) => (d ? [i] : []))
  const missing = dates.length - recorded.length

  function nearestIndex(e: PointerEvent<SVGRectElement>): number {
    const rect = e.currentTarget.getBoundingClientRect()
    const px = e.clientX - rect.left
    const step = dates.length <= 1 ? plotW : plotW / (dates.length - 1)
    return Math.min(dates.length - 1, Math.max(0, Math.round(px / step)))
  }

  const titleId = `${baseId}-title`
  const descId = `${baseId}-desc`
  const title = `${iteration.title} ${view === 'burnup' ? 'burn-up' : 'burndown'}`
  const last = recorded.length > 0 ? byDay[recorded[recorded.length - 1]]! : null
  const description = [
    view === 'burnup'
      ? `Scope and done ${unitLabel.many} by day`
      : `Remaining ${unitLabel.many} by day, against an ideal line falling to 0 on the last day`,
    `from ${formatLongDate(dates[0])} to ${formatLongDate(dates[dates.length - 1])}.`,
    last
      ? `On ${formatLongDate(last.date)}: ${formatAmount(last.remaining, unit)} remaining of ${formatAmount(last.scope, unit)}.`
      : 'No snapshots yet.',
    missing > 0 ? `${missing} of ${dates.length} days have no snapshot and are left as gaps.` : '',
  ]
    .filter(Boolean)
    .join(' ')

  // End labels: the latest value of each plotted (non-reference) series, in text colors.
  // Skipped when two would collide; the legend and tooltip carry them instead.
  const endLabels = series
    .filter((s) => !s.reference)
    .flatMap((s) => {
      const i = s.values.findLastIndex((v) => v !== null)
      return i === -1 ? [] : [{ key: s.key, i, value: s.values[i]!, py: y(s.values[i]!) }]
    })
  const labelsCollide = endLabels.length === 2 && Math.abs(endLabels[0].py - endLabels[1].py) < 14

  const tooltipIndex = focused ?? active

  return (
    <div>
      <div ref={containerRef} className="relative">
        <svg
          width={width}
          height={HEIGHT}
          viewBox={`0 0 ${width} ${HEIGHT}`}
          role="group"
          aria-labelledby={titleId}
          aria-describedby={descId}
          className="block max-w-full overflow-visible"
        >
          <title id={titleId}>{title}</title>
          <desc id={descId}>{description}</desc>

          {/* Unit label on the y-axis */}
          <text
            x={MARGIN.left - 8}
            y={MARGIN.top - 14}
            textAnchor="end"
            aria-hidden="true"
            className="fill-dusk text-[11px] font-medium"
          >
            {unitLabel.many[0].toUpperCase() + unitLabel.many.slice(1)}
          </text>

          {/* Gridlines and y ticks: hairline, recessive */}
          <g aria-hidden="true">
            {scale.ticks.map((t) => (
              <g key={t}>
                <line
                  x1={MARGIN.left}
                  x2={width - MARGIN.right}
                  y1={y(t)}
                  y2={y(t)}
                  className="stroke-night/10"
                  strokeWidth={1}
                  shapeRendering="crispEdges"
                />
                <text
                  x={MARGIN.left - 8}
                  y={y(t)}
                  dy="0.32em"
                  textAnchor="end"
                  className="fill-dusk text-[11px] tabular-nums"
                >
                  {t}
                </text>
              </g>
            ))}
            {dates.map((date, i) =>
              i % every === 0 || i === dates.length - 1 ? (
                <text
                  key={date}
                  x={x(i)}
                  y={HEIGHT - MARGIN.bottom + 18}
                  textAnchor={i === 0 ? 'start' : i === dates.length - 1 ? 'end' : 'middle'}
                  className="fill-dusk text-[11px]"
                >
                  {formatAxisDate(date)}
                </text>
              ) : null,
            )}
          </g>

          {/* Crosshair */}
          {tooltipIndex !== null && (
            <line
              aria-hidden="true"
              x1={x(tooltipIndex)}
              x2={x(tooltipIndex)}
              y1={MARGIN.top}
              y2={MARGIN.top + plotH}
              className="stroke-night/20"
              strokeWidth={1}
              shapeRendering="crispEdges"
            />
          )}

          {/* Lines, split at gaps */}
          <g
            aria-hidden="true"
            fill="none"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {series.map((s) =>
              segments(s.values).map(([from, to]) =>
                from === to ? null : (
                  <path
                    key={`${s.key}-${from}`}
                    d={s.values
                      .slice(from, to + 1)
                      .map((v, k) => `${k === 0 ? 'M' : 'L'}${x(from + k)},${y(v!)}`)
                      .join(' ')}
                    className={s.stroke}
                    strokeDasharray={s.dashed ? '6 4' : undefined}
                  />
                ),
              ),
            )}
          </g>

          {/* Markers: 8px, with a 2px surface ring. Today's live point is larger and hollow. */}
          <g aria-hidden="true">
            {series
              .filter((s) => !s.reference)
              .flatMap((s) =>
                s.values.map((v, i) => {
                  if (v === null) return null
                  const live = i === liveIndex && s === primary
                  return (
                    <circle
                      key={`${s.key}-${i}`}
                      cx={x(i)}
                      cy={y(v)}
                      r={live ? 6 : 4}
                      strokeWidth={2}
                      className={live ? `fill-surface ${s.stroke}` : `${s.fill} stroke-surface`}
                    />
                  )
                }),
              )}
            {liveIndex !== -1 && primary.values[liveIndex] !== null && (
              <text
                x={x(liveIndex)}
                y={y(primary.values[liveIndex]!) - 12}
                textAnchor="middle"
                className="fill-night text-[11px] font-medium"
              >
                Today
              </text>
            )}
          </g>

          {/* Direct end labels, in text colors (the series color stays on the marks) */}
          {!labelsCollide && (
            <g aria-hidden="true">
              {endLabels.map((l) => (
                <text
                  key={l.key}
                  x={x(l.i) + 10}
                  y={l.py}
                  dy="0.32em"
                  className="fill-night text-xs font-semibold tabular-nums"
                >
                  {Number.isInteger(l.value) ? l.value : l.value.toFixed(1)}
                </text>
              ))}
            </g>
          )}

          {/* Hover layer: the crosshair snaps to the nearest day */}
          <rect
            aria-hidden="true"
            x={MARGIN.left - HIT_RADIUS}
            y={MARGIN.top}
            width={plotW + HIT_RADIUS * 2}
            height={plotH}
            fill="transparent"
            onPointerMove={(e) => setActive(nearestIndex(e))}
            onPointerLeave={() => setActive(null)}
          />

          {/* Keyboard: one focusable point per recorded day, same readout as hover */}
          <g>
            {recorded.map((i) => {
              const v = primary.values[i]!
              return (
                <g
                  key={dates[i]}
                  tabIndex={0}
                  role="img"
                  aria-label={pointLabel(dates[i], byDay[i]!, ideal?.[i], view, unit)}
                  onFocus={() => setFocused(i)}
                  onBlur={() => setFocused(null)}
                  className="outline-none"
                  onPointerMove={() => setActive(i)}
                  onPointerLeave={() => setActive(null)}
                >
                  <circle cx={x(i)} cy={y(v)} r={HIT_RADIUS} fill="transparent" />
                  {focused === i && (
                    <circle
                      cx={x(i)}
                      cy={y(v)}
                      r={9}
                      fill="none"
                      strokeWidth={2}
                      className="stroke-ember"
                    />
                  )}
                </g>
              )
            })}
          </g>
        </svg>

        {tooltipIndex !== null && (
          <Tooltip
            left={Math.min(Math.max(x(tooltipIndex), 84), width - 84)}
            date={dates[tooltipIndex]}
            rows={series.map((s) => ({
              key: s.key,
              label: s.label,
              value: s.values[tooltipIndex],
              stroke: s.stroke,
              dashed: s.dashed,
            }))}
            recorded={byDay[tooltipIndex] !== null}
            live={tooltipIndex === liveIndex}
            unit={unit}
          />
        )}
      </div>

      <DataTable title={title} dates={dates} byDay={byDay} ideal={ideal} unit={unit} />
    </div>
  )
}

function pointLabel(
  date: string,
  day: BurndownDay,
  ideal: number | undefined,
  view: ChartView,
  unit: BurndownUnit,
): string {
  const parts =
    view === 'burnup'
      ? [`scope ${formatAmount(day.scope, unit)}`, `done ${formatAmount(day.done, unit)}`]
      : [
          `${formatAmount(day.remaining, unit)} remaining`,
          ...(ideal !== undefined ? [`ideal ${formatAmount(ideal, unit)}`] : []),
        ]
  return `${formatLongDate(date)}: ${parts.join(', ')}`
}

/** A short stroke in the series color, mirroring the mark (dashed for Ideal). */
export function LineKey({ stroke, dashed }: { stroke: string; dashed?: boolean }) {
  return (
    <svg aria-hidden="true" width="16" height="4" className="shrink-0">
      <line
        x1="1"
        x2="15"
        y1="2"
        y2="2"
        strokeWidth={2}
        strokeLinecap="round"
        strokeDasharray={dashed ? '4 3' : undefined}
        className={stroke}
      />
    </svg>
  )
}

function Tooltip({
  left,
  date,
  rows,
  recorded,
  live,
  unit,
}: {
  left: number
  date: string
  rows: { key: string; label: string; value: number | null; stroke: string; dashed?: boolean }[]
  recorded: boolean
  live: boolean
  unit: BurndownUnit
}) {
  return (
    <div
      aria-hidden="true"
      style={{ left }}
      className="pointer-events-none absolute top-0 w-40 -translate-x-1/2 rounded-xl bg-surface px-3 py-2 text-xs shadow-card ring-1 ring-night/10"
    >
      <p className="text-dusk">
        {formatLongDate(date)}
        {live && ' · today'}
      </p>
      {rows.map((r) => (
        <p key={r.key} className="mt-1 flex items-center gap-2">
          <LineKey stroke={r.stroke} dashed={r.dashed} />
          {r.value === null || (!recorded && r.key !== 'ideal') ? (
            <span className="text-dusk">Not recorded</span>
          ) : (
            <span className="font-semibold text-night tabular-nums">
              {formatAmount(r.value, unit)}
            </span>
          )}
          <span className="ml-auto text-dusk">{r.label}</span>
        </p>
      ))}
    </div>
  )
}

/** Every number in the chart, for screen readers. */
function DataTable({
  title,
  dates,
  byDay,
  ideal,
  unit,
}: {
  title: string
  dates: string[]
  byDay: (BurndownDay | null)[]
  ideal: number[] | null
  unit: BurndownUnit
}) {
  const unitName = UNIT_LABELS[unit].many
  return (
    <table className="sr-only">
      <caption>
        {title} data, in {unitName}
      </caption>
      <thead>
        <tr>
          <th scope="col">Date</th>
          <th scope="col">Remaining</th>
          <th scope="col">Done</th>
          <th scope="col">Scope</th>
          {ideal && <th scope="col">Ideal</th>}
        </tr>
      </thead>
      <tbody>
        {dates.map((date, i) => {
          const d = byDay[i]
          return (
            <tr key={date}>
              <th scope="row">{formatLongDate(date)}</th>
              {d ? (
                <>
                  <td>{d.remaining}</td>
                  <td>{d.done}</td>
                  <td>{d.scope}</td>
                </>
              ) : (
                <td colSpan={3}>Not recorded</td>
              )}
              {ideal && <td>{ideal[i]}</td>}
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
