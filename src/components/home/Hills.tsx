const LAYERS = [
  {
    // Back: palest, highest ridge.
    d: 'M0 150 C160 118 330 92 540 118 S880 84 1080 110 S1340 92 1440 104 V320 H0 Z',
    className: 'fill-apricot/25',
    delay: '0ms',
  },
  {
    d: 'M0 205 C190 172 380 222 610 190 S1000 160 1210 196 S1390 186 1440 176 V320 H0 Z',
    className: 'fill-apricot/35',
    delay: '150ms',
  },
  {
    // Front: strongest, lowest.
    d: 'M0 262 C230 236 470 276 760 252 S1170 228 1440 256 V320 H0 Z',
    className: 'fill-apricot/50',
    delay: '300ms',
  },
]

/** Layered rolling-hill silhouettes along the bottom of the hero. Decorative. */
export default function Hills({ className = '' }: { className?: string }) {
  return (
    <div aria-hidden="true" className={`pointer-events-none ${className}`}>
      {LAYERS.map((layer) => (
        <svg
          key={layer.d}
          viewBox="0 0 1440 320"
          preserveAspectRatio="none"
          focusable="false"
          className="absolute inset-0 size-full motion-safe:animate-hill-rise"
          style={{ animationDelay: layer.delay }}
        >
          <path d={layer.d} className={layer.className} />
        </svg>
      ))}
    </div>
  )
}
