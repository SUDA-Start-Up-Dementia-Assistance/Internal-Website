interface SunArcProps {
  className?: string
  /** Draw a flat horizon line under the arc (used for the small wordmark icon). */
  horizon?: boolean
}

// A shallow arc (less than a semicircle): 60 wide, 20 tall, base at y=54.
// Its circle's center sits below the base, and rays radiate from that center.
const CX = 50
const CY = 66.5
const R = 32.5
const RAY_ANGLES = [150, 120, 90, 60, 30]

function rayPath(angle: number): string {
  const rad = (angle * Math.PI) / 180
  const point = (r: number) => `${CX + r * Math.cos(rad)} ${CY - r * Math.sin(rad)}`
  return `M${point(R + 7)} L${point(R + 16)}`
}

/** Decorative half-sun: arc and rays. Always aria-hidden. */
export default function SunArc({ className, horizon = false }: SunArcProps) {
  return (
    <svg
      viewBox="0 14 100 42"
      className={className}
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d={`M20 54 A${R} ${R} 0 0 1 80 54`}
        className="stroke-gold"
        strokeWidth="2"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      {RAY_ANGLES.map((angle) => (
        <path
          key={angle}
          d={rayPath(angle)}
          className="stroke-gold"
          strokeWidth="2"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      ))}
      {horizon && (
        <path
          d="M4 54 H96"
          className="stroke-gold"
          strokeWidth="2"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      )}
    </svg>
  )
}
