export interface DonutSegment {
  label: string;
  value: number;
  /** Full Tailwind stroke class, e.g. "stroke-info" (must be a literal so Tailwind can detect it) */
  strokeClass: string;
}

export interface DonutChartProps {
  segments: DonutSegment[];
  /** Big number in the middle. Defaults to the sum of all segment values. */
  total?: number;
  label?: string;
  /** Outer diameter in px */
  size?: number;
  /** Ring thickness in px */
  strokeWidth?: number;
  className?: string;
}

export function DonutChart({
  segments,
  total,
  label = "total touches",
  size = 244,
  strokeWidth = 32,
  className = "",
}: DonutChartProps) {
  const sum = segments.reduce((acc, s) => acc + s.value, 0);
  const center = size / 2;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  // Each arc starts exactly where the previous one ends.
  const lengths = segments.map((seg) =>
    sum > 0 ? (seg.value / sum) * circumference : 0,
  );
  const arcs = segments
    .map((seg, index) => {
      const length = lengths[index] ?? 0;
      const start = lengths.slice(0, index).reduce((acc, len) => acc + len, 0);
      return { ...seg, length, start, end: start + length };
    })
    .filter((arc) => arc.length > 0);

  const circleProps = {
    cx: center,
    cy: center,
    r: radius,
    fill: "none",
    strokeWidth,
  };

  return (
    <div
      className={`relative inline-flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${total ?? sum} ${label}`}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Start at 12 o'clock and go clockwise */}
        <g transform={`rotate(-90 ${center} ${center})`}>
          {/* Pass 1: flat-ended bodies, perfectly flush, no overlap */}
          {arcs.map((arc) => (
            <circle
              key={`body-${arc.label}`}
              {...circleProps}
              strokeLinecap="butt"
              strokeDasharray={`${arc.length} ${circumference}`}
              strokeDashoffset={-arc.start}
              className={arc.strokeClass}
            >
              <title>{`${arc.label}: ${arc.value}`}</title>
            </circle>
          ))}

          {/* Pass 2: one rounded cap at the END of every segment.
              It bulges into the start of the next segment, so each segment
              has a rounded end and a matching concave start (no double ends). */}
          {arcs.map((arc) => {
            const angle = (arc.end / circumference) * 2 * Math.PI;
            const x = center + radius * Math.cos(angle);
            const y = center + radius * Math.sin(angle);
            return (
              <path
                key={`cap-${arc.label}`}
                d={`M ${x} ${y} l 0.001 0`}
                fill="none"
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                className={arc.strokeClass}
              />
            );
          })}
        </g>
      </svg>

      {/* Center label */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-5xl font-bold leading-none text-foreground">
          {total ?? sum}
        </span>
        <span className="mt-1 text-xl text-muted-foreground">
          {label}
        </span>
      </div>
    </div>
  );
}
