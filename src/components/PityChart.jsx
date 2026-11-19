import React, { useState } from 'react';
import { BarChart3 } from 'lucide-react';
import { POOL_ORDER } from '../lib/catalog.js';

export default function PityChart({ pools }) {
  const [selectedPool, setSelectedPool] = useState('monopoly_limited');
  const stats = pools[selectedPool];
  if (!stats) return null;

  const hardPity = stats.definition.hardPity || 90;
  const softPity = stats.definition.softPity;
  const hist = stats.pityHistogram || [];

  const bucketCount = Math.ceil(hardPity / 10);
  const buckets = [];
  let maxVal = 1;
  for (let b = 0; b < bucketCount; b++) {
    const start = b * 10 + 1;
    const end = Math.min(hardPity, (b + 1) * 10);
    let sum = 0;
    for (let p = start; p <= end; p++) {
      sum += hist[p] || 0;
    }
    if (sum > maxVal) maxVal = sum;
    buckets.push({
      label: `${start}-${end}`,
      start,
      end,
      count: sum,
      isSoftBand: Boolean(softPity && start >= softPity),
    });
  }

  return (
    <div className="nte-panel overflow-hidden rounded-xl p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-[#f5c451]" />
            <h3 className="font-display text-base font-bold uppercase tracking-wide text-white">
              S-Class Pity Distribution
            </h3>
          </div>
          <p className="mt-0.5 text-xs text-slate-400">
            Pull count when each S-Class dropped (gold-crimson highlights Board Mod 70+ zone)
          </p>
        </div>

        <div className="flex flex-wrap gap-1 rounded-lg border border-white/10 bg-[#090b12] p-1">
          {POOL_ORDER.filter((k) => k !== 'mystery_box').map((key) => {
            const active = selectedPool === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelectedPool(key)}
                className={`rounded px-2.5 py-1 font-mono text-[11px] font-bold uppercase tracking-wider transition ${
                  active
                    ? 'bg-[#f5c451]/18 text-[#fef3c7] ring-1 ring-[#f5c451]/45'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {pools[key]?.definition?.title}
              </button>
            );
          })}
        </div>
      </div>

      {stats.sRankCount === 0 ? (
        <div className="mt-6 flex h-36 items-center justify-center rounded-lg border border-dashed border-white/10 bg-[#090b12]/60 font-mono text-xs text-slate-500">
          Import pulls on {stats.definition.title} to plot your pity curve.
        </div>
      ) : (
        <div
          className="mt-6 grid h-44 items-end gap-2 border-b border-white/10 pt-4 pb-2"
          style={{ gridTemplateColumns: `repeat(${buckets.length}, minmax(0, 1fr))` }}
        >
          {buckets.map((b) => {
            const heightPct = b.count > 0 ? Math.max(12, (b.count / maxVal) * 100) : 3;
            return (
              <div key={b.label} className="flex h-full flex-col items-center justify-end gap-1.5">
                <span className="font-mono text-[11px] font-bold text-slate-200 tabular-nums">
                  {b.count > 0 ? b.count : ''}
                </span>
                <div className="flex w-full flex-1 items-end">
                  <div
                    className={`w-full rounded-t-[3px] transition-all duration-500 ${
                      b.count === 0
                        ? 'bg-white/[0.05]'
                        : b.isSoftBand
                          ? 'bg-gradient-to-t from-rose-500/85 to-[#f5c451] shadow-[0_0_14px_rgba(245,196,81,0.22)]'
                          : 'bg-gradient-to-t from-[#d946ef]/75 via-[#2ee6ff]/85 to-[#67e8f9] shadow-[0_0_14px_rgba(46,230,255,0.18)]'
                    }`}
                    style={{ height: `${heightPct}%` }}
                    title={`Pulls ${b.label}: ${b.count} S-Class`}
                  />
                </div>
                <span className="font-mono text-[10px] text-slate-400">{b.label}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
