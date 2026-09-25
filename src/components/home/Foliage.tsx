/*
 * A loose cluster of leafy stems and grass blades for the hero's bottom-right corner.
 * Geometry is generated once at module load from a few hand-picked stems.
 */

const WIDTH = 400
const HEIGHT = 260

interface Stem {
  x: number
  height: number
  lean: number
}

const STEMS: Stem[] = [
  { x: 70, height: 110, lean: -14 },
  { x: 128, height: 84, lean: 10 },
  { x: 186, height: 136, lean: -8 },
  { x: 240, height: 104, lean: 16 },
  { x: 296, height: 214, lean: -22 },
  { x: 344, height: 166, lean: 12 },
  { x: 384, height: 238, lean: -10 },
]

function pointOnStem({ x, height, lean }: Stem, t: number) {
  // Quadratic curve from the base (x, HEIGHT) to the tip, bowing slightly.
  const cx = x + lean * 0.2
  const cy = HEIGHT - height * 0.5
  const tipX = x + lean
  const tipY = HEIGHT - height
  const u = 1 - t
  return {
    x: u * u * x + 2 * u * t * cx + t * t * tipX,
    y: u * u * HEIGHT + 2 * u * t * cy + t * t * tipY,
  }
}

const STEM_PATHS = STEMS.map((s) => {
  const tip = pointOnStem(s, 1)
  return `M${s.x} ${HEIGHT} Q${s.x + s.lean * 0.2} ${HEIGHT - s.height * 0.5} ${tip.x} ${tip.y}`
})

const LEAVES = STEMS.flatMap((stem, stemIndex) => {
  const count = Math.max(4, Math.round(stem.height / 22))
  return Array.from({ length: count }, (_, i) => {
    const t = 0.3 + (0.7 * (i + 1)) / (count + 0.5)
    const side = (i + stemIndex) % 2 === 0 ? 1 : -1
    const { x, y } = pointOnStem(stem, t)
    const size = Math.max(8, 17 - i * 0.9)
    return {
      cx: x + side * size * 0.8,
      cy: y - size * 0.35,
      rx: size,
      ry: size * 0.38,
      rotate: side * -38,
    }
  })
})

const BLADES = Array.from({ length: 22 }, (_, i) => {
  const x = 20 + i * 18
  const h = 28 + ((i * 37) % 44)
  const lean = ((i * 13) % 17) - 8
  return `M${x - 3} ${HEIGHT} Q${x + lean * 0.3} ${HEIGHT - h * 0.6} ${x + lean} ${HEIGHT - h} Q${x + lean * 0.2 + 2} ${HEIGHT - h * 0.5} ${x + 3} ${HEIGHT} Z`
})

/** Decorative grass and leaf silhouettes. Always aria-hidden. */
export default function Foliage({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      preserveAspectRatio="xMaxYMax meet"
      aria-hidden="true"
      focusable="false"
      className={`pointer-events-none ${className}`}
    >
      <g className="fill-night stroke-night">
        {STEM_PATHS.map((d) => (
          <path key={d} d={d} fill="none" strokeWidth="2.5" strokeLinecap="round" />
        ))}
        {LEAVES.map((leaf, i) => (
          <ellipse
            key={i}
            cx={leaf.cx}
            cy={leaf.cy}
            rx={leaf.rx}
            ry={leaf.ry}
            stroke="none"
            transform={`rotate(${leaf.rotate} ${leaf.cx} ${leaf.cy})`}
          />
        ))}
        {BLADES.map((d) => (
          <path key={d} d={d} stroke="none" />
        ))}
      </g>
    </svg>
  )
}
