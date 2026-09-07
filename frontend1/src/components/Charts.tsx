/**
 * Dependency-free SVG chart primitives styled with the app palette.
 * Kept intentionally small — no chart library is installed in this project.
 */
import { useId } from 'react';

export const CHART_COLORS = ['#2a6326', '#e6b325', '#8b5a2b', '#5aa252', '#b78a5a', '#c9971a', '#1e4a1c'];

function fmt(n: number) {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return `${Math.round(n * 100) / 100}`;
}

export function ChartCard({
  title,
  subtitle,
  right,
  children,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="card p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2 mb-4">
        <div>
          <h2 className="font-serif text-lg text-ink">{title}</h2>
          {subtitle && <p className="text-xs text-brown-500">{subtitle}</p>}
        </div>
        {right}
      </div>
      {children}
    </div>
  );
}

export function EmptyChart({ label = 'No data yet' }: { label?: string }) {
  return (
    <div className="h-40 flex items-center justify-center text-sm text-brown-500 border border-dashed border-brown-100 rounded-lg">
      {label}
    </div>
  );
}

/** Vertical bars — best for a small number of ordered categories (e.g. months, buckets). */
export function BarChart({
  data,
  color = CHART_COLORS[0],
  height = 220,
  valueSuffix = '',
}: {
  data: { label: string; value: number }[];
  color?: string;
  height?: number;
  valueSuffix?: string;
}) {
  if (!data.length) return <EmptyChart />;
  const max = Math.max(...data.map((d) => d.value), 1);
  const w = 640;
  const h = height;
  const padB = 34;
  const padT = 16;
  const bandW = w / data.length;
  const barW = Math.min(bandW * 0.6, 48);

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height }} role="img">
      {[0, 0.5, 1].map((t) => (
        <line
          key={t}
          x1={0}
          x2={w}
          y1={padT + (h - padT - padB) * t}
          y2={padT + (h - padT - padB) * t}
          stroke="#e9d7bd"
          strokeWidth={1}
        />
      ))}
      {data.map((d, i) => {
        const bh = ((h - padT - padB) * d.value) / max;
        const x = i * bandW + (bandW - barW) / 2;
        const y = h - padB - bh;
        return (
          <g key={`${d.label}-${i}`}>
            <rect x={x} y={y} width={barW} height={Math.max(bh, d.value > 0 ? 2 : 0)} rx={4} fill={color}>
              <title>{`${d.label}: ${fmt(d.value)}${valueSuffix}`}</title>
            </rect>
            {d.value > 0 && (
              <text x={x + barW / 2} y={y - 5} textAnchor="middle" fontSize={11} fill="#6b4423">
                {fmt(d.value)}
              </text>
            )}
            <text x={i * bandW + bandW / 2} y={h - 12} textAnchor="middle" fontSize={11} fill="#4a4a4a">
              {d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/** Horizontal bars — best for many/long labels (statuses, users, stage names). */
export function HBarChart({
  data,
  color = CHART_COLORS[0],
  valueSuffix = '',
}: {
  data: { label: string; value: number; color?: string }[];
  color?: string;
  valueSuffix?: string;
}) {
  if (!data.length) return <EmptyChart />;
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <ul className="space-y-2">
      {data.map((d, i) => (
        <li key={`${d.label}-${i}`} className="flex items-center gap-3">
          <span className="w-40 sm:w-52 shrink-0 text-xs text-ink-muted truncate" title={d.label}>
            {d.label}
          </span>
          <span className="flex-1 h-5 rounded bg-paper-warm overflow-hidden">
            <span
              className="block h-full rounded"
              style={{ width: `${(d.value / max) * 100}%`, backgroundColor: d.color ?? color }}
            />
          </span>
          <span className="w-16 text-right text-xs font-medium text-ink tabular-nums">
            {fmt(d.value)}
            {valueSuffix}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Multi-series line/area — best for time trends. */
export function LineChart({
  labels,
  series,
  height = 220,
}: {
  labels: string[];
  series: { name: string; color: string; points: number[] }[];
  height?: number;
}) {
  const uid = useId().replace(/:/g, '');
  if (!labels.length) return <EmptyChart />;
  const w = 640;
  const h = height;
  const padL = 8;
  const padB = 26;
  const padT = 12;
  const max = Math.max(1, ...series.flatMap((s) => s.points));
  const stepX = (w - padL * 2) / Math.max(labels.length - 1, 1);
  const y = (v: number) => padT + (h - padT - padB) * (1 - v / max);
  const step = Math.ceil(labels.length / 8);

  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height }} role="img">
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <line
            key={t}
            x1={0}
            x2={w}
            y1={padT + (h - padT - padB) * t}
            y2={padT + (h - padT - padB) * t}
            stroke="#f0e6d6"
            strokeWidth={1}
          />
        ))}
        {series.map((s, si) => {
          const pts = s.points.map((v, i) => `${padL + i * stepX},${y(v)}`).join(' ');
          const area = `${padL},${h - padB} ${pts} ${padL + (s.points.length - 1) * stepX},${h - padB}`;
          return (
            <g key={s.name}>
              <defs>
                <linearGradient id={`g-${uid}-${si}`} x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor={s.color} stopOpacity={0.25} />
                  <stop offset="100%" stopColor={s.color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <polygon points={area} fill={`url(#g-${uid}-${si})`} />
              <polyline points={pts} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" />
              {s.points.map((v, i) => (
                <circle key={i} cx={padL + i * stepX} cy={y(v)} r={2.5} fill={s.color}>
                  <title>{`${labels[i]} · ${s.name}: ${fmt(v)}`}</title>
                </circle>
              ))}
            </g>
          );
        })}
        {labels.map((l, i) =>
          i % step === 0 ? (
            <text key={l + i} x={padL + i * stepX} y={h - 8} textAnchor="middle" fontSize={10} fill="#4a4a4a">
              {l}
            </text>
          ) : null,
        )}
      </svg>
      <div className="flex flex-wrap gap-4 mt-2">
        {series.map((s) => (
          <span key={s.name} className="flex items-center gap-1.5 text-xs text-ink-muted">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} />
            {s.name}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Donut — best for a share-of-total breakdown with few slices. */
export function DonutChart({
  data,
  size = 200,
}: {
  data: { label: string; value: number }[];
  size?: number;
}) {
  const total = data.reduce((a, b) => a + b.value, 0);
  if (!total) return <EmptyChart />;
  const r = 70;
  const c = 2 * Math.PI * r;
  let offset = 0;

  return (
    <div className="flex flex-wrap items-center gap-6">
      <svg viewBox="0 0 200 200" width={size} height={size} role="img">
        <g transform="translate(100,100) rotate(-90)">
          {data.map((d, i) => {
            const frac = d.value / total;
            const dash = `${c * frac} ${c * (1 - frac)}`;
            const el = (
              <circle
                key={d.label}
                r={r}
                fill="none"
                stroke={CHART_COLORS[i % CHART_COLORS.length]}
                strokeWidth={26}
                strokeDasharray={dash}
                strokeDashoffset={-offset}
              >
                <title>{`${d.label}: ${d.value} (${Math.round(frac * 100)}%)`}</title>
              </circle>
            );
            offset += c * frac;
            return el;
          })}
        </g>
        <text x="100" y="96" textAnchor="middle" fontSize={22} fill="#0e0e0e" fontWeight="600">
          {total}
        </text>
        <text x="100" y="116" textAnchor="middle" fontSize={11} fill="#6b4423">
          total
        </text>
      </svg>
      <ul className="space-y-1.5 min-w-[140px]">
        {data.map((d, i) => (
          <li key={d.label} className="flex items-center gap-2 text-sm">
            <span
              className="h-2.5 w-2.5 rounded-full shrink-0"
              style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
            />
            <span className="text-ink-muted truncate max-w-[160px]">{d.label}</span>
            <span className="ml-auto text-ink font-medium tabular-nums">{d.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
