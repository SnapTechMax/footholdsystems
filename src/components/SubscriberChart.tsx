import type { SubscriberPoint } from "@/lib/tracking";

/**
 * Subscribers over time.
 *
 * Hand-drawn SVG rather than a charting library. The whole dashboard is five
 * server components with no client JavaScript, and pulling in a chart package
 * would mean shipping a bundle and a client boundary for one line on one page.
 *
 * The line is drawn straight between points rather than smoothed. Signups are
 * lumpy at this volume, and a spline through them invents gentle growth on days
 * nobody joined, which is exactly the shape someone reads a chart to check.
 */

const W = 720;
const H = 220;
const PAD = { top: 18, right: 18, bottom: 34, left: 52 };

const mono = "font-mono text-[10px] uppercase tracking-[0.14em]";

/** Round to a nice number so the axis reads 0/25/50 rather than 0/23/46. */
function niceCeiling(value: number): number {
  if (value <= 5) return 5;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  for (const step of [1, 2, 2.5, 5, 10]) {
    const candidate = step * magnitude;
    if (candidate >= value) return candidate;
  }
  return 10 * magnitude;
}

function formatDay(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function SubscriberChart({ series }: { series: SubscriberPoint[] }) {
  if (series.length === 0) {
    return (
      <div className="rounded-lg border border-[#33332f] bg-[#232320] p-8 text-center">
        <p className={`${mono} text-[#7a786f]`}>Subscribers</p>
        <p className="mt-2 text-sm text-[#8a887f]">
          No opt-ins recorded yet. The line starts the day the first person
          ticks the box.
        </p>
      </div>
    );
  }

  const latest = series[series.length - 1];
  const first = series[0];
  const gained = latest.total - first.total + first.added;
  const busiest = series.reduce((a, b) => (b.added > a.added ? b : a));

  const top = niceCeiling(Math.max(latest.total, 1));
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  // A single point has no span to divide by; park it mid-plot rather than
  // dividing by zero and drawing the line off-canvas.
  const x = (i: number) =>
    series.length === 1
      ? PAD.left + plotW / 2
      : PAD.left + (i / (series.length - 1)) * plotW;
  const y = (v: number) => PAD.top + plotH - (v / top) * plotH;

  const points = series.map((p, i) => `${x(i).toFixed(1)},${y(p.total).toFixed(1)}`);
  const line = `M ${points.join(" L ")}`;
  const area =
    `M ${x(0).toFixed(1)},${(PAD.top + plotH).toFixed(1)} ` +
    `L ${points.join(" L ")} ` +
    `L ${x(series.length - 1).toFixed(1)},${(PAD.top + plotH).toFixed(1)} Z`;

  // Midpoint only when it lands on a whole subscriber. Half a person rounds to
  // a gridline labelled 3 sitting at 2.5, which misreads the chart it labels.
  const midpoint = top / 2;
  const gridValues =
    Number.isInteger(midpoint) ? [0, midpoint, top] : [0, top];

  // At most six date labels, so a 60 day window doesn't overlap itself.
  const labelEvery = Math.max(1, Math.ceil(series.length / 6));
  const lastIndex = series.length - 1;

  /**
   * Which points get a date printed under them.
   *
   * The final day is always labelled, and any regular label falling too close
   * to it is dropped — otherwise the last stride lands a few pixels short and
   * the two collide, which is what "Jul 29 Aug 2" looked like.
   */
  const showLabel = (i: number) =>
    i === lastIndex ||
    (i % labelEvery === 0 && lastIndex - i >= labelEvery * 0.6);

  return (
    <div className="rounded-lg border border-[#33332f] bg-[#232320] p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <div>
          <p className={`${mono} text-[#7a786f]`}>Subscribers</p>
          <p className="mt-1 text-3xl font-bold text-[#f2efe6]">
            {latest.total.toLocaleString()}
          </p>
        </div>
        <div className="text-right">
          <p className={`${mono} text-[#7a786f]`}>
            {series.length} day{series.length === 1 ? "" : "s"}
          </p>
          <p className="mt-1 text-sm text-[#f6be00]">
            +{gained.toLocaleString()} in this window
          </p>
        </div>
      </div>

      {/* Scales with the card, so the axis type shrinks with it. The sizes below
          are in viewBox units and are deliberately larger than they look here:
          at the narrowest the card gets, the whole drawing is at about half
          scale, which turns a 10px label into an unreadable 5px one. */}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-4 w-full"
        role="img"
        aria-label={`Subscribers over time, ending at ${latest.total} on ${formatDay(latest.date)}`}
      >
        <defs>
          <linearGradient id="fh-sub-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f6be00" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#f6be00" stopOpacity="0" />
          </linearGradient>
        </defs>

        {gridValues.map((v) => (
          <g key={v}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={y(v)}
              y2={y(v)}
              stroke="#33332f"
              strokeWidth="1"
            />
            <text
              x={PAD.left - 10}
              y={y(v) + 3.5}
              textAnchor="end"
              fill="#7a786f"
              fontSize="13"
              fontFamily="ui-monospace, monospace"
            >
              {Math.round(v)}
            </text>
          </g>
        ))}

        <path d={area} fill="url(#fh-sub-fill)" />
        <path
          d={line}
          fill="none"
          stroke="#f6be00"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />

        {/* Every point carries a title, so hovering reads the exact day without
            any client JavaScript — the browser draws the tooltip itself. */}
        {series.map((p, i) => (
          <circle key={p.date} cx={x(i)} cy={y(p.total)} r="7" fill="transparent">
            <title>{`${formatDay(p.date)} — ${p.total} subscriber${p.total === 1 ? "" : "s"}${p.added ? ` (+${p.added})` : ""}`}</title>
          </circle>
        ))}

        <circle cx={x(series.length - 1)} cy={y(latest.total)} r="7" fill="#f6be00" opacity="0.18" />
        <circle cx={x(series.length - 1)} cy={y(latest.total)} r="3.5" fill="#f6be00" />

        {series.map((p, i) =>
          showLabel(i) ? (
            <text
              key={`label-${p.date}`}
              x={x(i)}
              y={H - 8}
              textAnchor={i === 0 ? "start" : i === lastIndex ? "end" : "middle"}
              fill="#7a786f"
              fontSize="13"
              fontFamily="ui-monospace, monospace"
            >
              {formatDay(p.date)}
            </text>
          ) : null
        )}
      </svg>

      <p className="mt-3 text-[11px] leading-relaxed text-[#7a786f]">
        Counted from the consent record on the day of a person&apos;s first
        opt-in, so the line is people who agreed to the emails rather than
        everyone who downloaded.
        {busiest.added > 0 && (
          <> Best day so far: {formatDay(busiest.date)}, {busiest.added} added.</>
        )}
      </p>
    </div>
  );
}
