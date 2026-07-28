/**
 * Raspberry mark — a small clustered-berry glyph in the brand gradient.
 * Pure SVG so it stays crisp at any DPI and needs no asset pipeline.
 */
export function RaspberryLogo({ size = 22 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="rb-grad" x1="4" y1="3" x2="20" y2="22">
          <stop offset="0%" stopColor="var(--raspberry-hi)" />
          <stop offset="100%" stopColor="var(--purple)" />
        </linearGradient>
      </defs>
      {/* leaf */}
      <path
        d="M12 6.2c-1.1-2-3.2-3-5.2-2.8.2 2 1.4 3.9 3.3 4.6"
        stroke="url(#rb-grad)"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      {/* berry cluster */}
      {[
        [9, 10],
        [12, 9.4],
        [15, 10],
        [10.5, 12.4],
        [13.5, 12.4],
        [12, 15],
      ].map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r="2.05" fill="url(#rb-grad)" />
      ))}
    </svg>
  );
}
