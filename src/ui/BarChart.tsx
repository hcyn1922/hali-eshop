import React, { useMemo, useState } from 'react';

export interface BarDatum {
  key: string;
  label: string;
  value: number;
  tooltip?: string;
}

function niceMax(max: number): number {
  if (max <= 0) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(max)));
  const n = max / pow;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * pow;
}

const compact = (v: number) =>
  v >= 1_000_000 ? `${+(v / 1_000_000).toFixed(1)}M` : v >= 1000 ? `${+(v / 1000).toFixed(1)}K` : `${Math.round(v)}`;

/**
 * Single-series column chart: thin columns with a 4px rounded cap, hairline grid,
 * hover tooltip, and a screen-reader table. Colour is the brand coral.
 */
export function BarChart({
  data,
  height = 220,
  formatValue = v => v.toFixed(2),
  ariaLabel,
}: {
  data: BarDatum[];
  height?: number;
  formatValue?: (v: number) => string;
  ariaLabel: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const max = useMemo(() => niceMax(Math.max(0, ...data.map(d => d.value))), [data]);
  const ticks = [0, max / 2, max];

  return (
    <div className="relative">
      <div className="flex" style={{ height }}>
        {/* Y axis */}
        <div className="flex w-10 shrink-0 flex-col justify-between pb-6 text-right text-xs text-fg-4 tabular">
          {[...ticks].reverse().map(t => (
            <span key={t} className="-translate-y-1/2 pr-2 first:translate-y-0 last:translate-y-0">
              {compact(t)}
            </span>
          ))}
        </div>
        <div className="relative flex-1">
          {/* Grid */}
          <div className="absolute inset-x-0 top-0 bottom-6 flex flex-col justify-between">
            {ticks.map(t => (
              <div key={t} className="h-px bg-line" />
            ))}
          </div>
          {/* Columns */}
          <div className="absolute inset-x-0 top-0 bottom-6 flex items-end gap-[2px]">
            {data.map((d, i) => (
              <div
                key={d.key}
                className="relative flex h-full flex-1 cursor-default items-end justify-center"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                onTouchStart={() => setHover(i)}
              >
                {hover === i && <div className="absolute inset-0 rounded-md bg-hover" />}
                <div
                  className="relative w-full max-w-6 rounded-t bg-brand-500 transition-opacity dark:bg-brand-400"
                  style={{ height: `${(d.value / max) * 100}%`, minHeight: d.value > 0 ? 2 : 0, opacity: hover === null || hover === i ? 1 : 0.55 }}
                />
                {hover === i && (
                  <div
                    role="tooltip"
                    className="pointer-events-none absolute bottom-full z-10 mb-2 whitespace-nowrap rounded-lg bg-gray-900 px-3 py-2 text-xs text-white shadow-lg dark:bg-gray-700"
                    style={i > data.length / 2 ? { right: 0 } : { left: 0 }}
                  >
                    <p className="font-semibold">{d.tooltip || d.label}</p>
                    <p className="tabular text-gray-300">{formatValue(d.value)}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
          {/* X labels: show a few to avoid collisions */}
          <div className="absolute inset-x-0 bottom-0 flex h-6 items-end gap-[2px] text-[11px] text-fg-4">
            {data.map((d, i) => (
              <span key={d.key} className="flex-1 truncate text-center">
                {i === 0 || i === data.length - 1 || i % Math.ceil(data.length / 5) === 0 ? d.label : ''}
              </span>
            ))}
          </div>
        </div>
      </div>
      <table className="sr-only">
        <caption>{ariaLabel}</caption>
        <tbody>
          {data.map(d => (
            <tr key={d.key}>
              <th>{d.tooltip || d.label}</th>
              <td>{formatValue(d.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
