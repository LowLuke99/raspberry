/**
 * Raspberry brand marks.
 *
 * `RaspberryLogo` — pure SVG glyph, always crisp. Use for small chrome
 * (top-bar, status-bar, favicons rendered in HTML).
 *
 * `RaspberryMark` — the Kling-rendered photo mark. Use for large displays
 * (splash, welcome, empty states, module hero panels).
 */

export function RaspberryLogo({ size = 22 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="rb-body" x1="6" y1="6" x2="26" y2="28">
          <stop offset="0%" stopColor="var(--raspberry-hi)" />
          <stop offset="60%" stopColor="var(--raspberry)" />
          <stop offset="100%" stopColor="var(--purple)" />
        </linearGradient>
        <radialGradient id="rb-halo" cx="16" cy="19" r="14" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="var(--raspberry-hi)" stopOpacity="0.55" />
          <stop offset="100%" stopColor="var(--purple)" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="rb-leaf" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--raspberry-hi)" />
          <stop offset="100%" stopColor="var(--purple)" />
        </linearGradient>
      </defs>

      {/* soft halo */}
      <circle cx="16" cy="19" r="12" fill="url(#rb-halo)" />

      {/* stem + leaf */}
      <path
        d="M15.5 8.5 C 15 5.5, 17 3.5, 20 3"
        stroke="url(#rb-leaf)"
        strokeWidth="1.2"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M13 8.5 C 12.4 5.6, 14.6 4, 17.4 5 C 16.6 6.4, 15.2 7.6, 13 8.5 Z"
        fill="url(#rb-leaf)"
        opacity="0.85"
      />

      {/* drupelet cluster: 3-4-3-2 */}
      {(
        [
          [11.5, 12], [16, 12], [20.5, 12],
          [9.5, 15.5], [13.5, 15.5], [18.5, 15.5], [22.5, 15.5],
          [11.5, 19], [16, 19], [20.5, 19],
          [13.5, 22.5], [18.5, 22.5],
        ] as ReadonlyArray<readonly [number, number]>
      ).map(([cx, cy], i) => (
        <g key={i}>
          <circle cx={cx} cy={cy} r="2.15" fill="url(#rb-body)" />
          <circle cx={cx - 0.6} cy={cy - 0.7} r="0.55" fill="#ffffff" opacity="0.5" />
        </g>
      ))}
    </svg>
  );
}

export function RaspberryMark({
  size = 128,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  const src = size <= 256 ? "/raspberry-256.png" : "/raspberry-512.png";
  return (
    <img
      src={src}
      width={size}
      height={size}
      alt="Raspberry"
      className={className}
      style={{ display: "block" }}
      draggable={false}
    />
  );
}
