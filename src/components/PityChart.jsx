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

  // Bucket into 10-pull bands (1-10, 11-20, ..., 81-90)
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
    <div className="rounded-2xl border border-white/8 bg-[#121728]/90 p-5 shadow-xl shadow-black/20">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-violet-400" />
            <h3 className="font-display text-base font-bold text-white">
              S-Class Pity Distribution
            </h3>
          </div>
          <p className="mt-0.5 text-xs text-slate-400">
            Pull count when each S-Class dropped (amber highlights Board Modification 70+ zone)
          </p>
        </div>

        <div className="flex flex-wrap gap-1 rounded-xl bg-[#0c101d] p-1 ring-1 ring-white/8">
          {POOL_ORDER.filter((k) => k !== 'mystery_box').map((key) => {
            const active = selectedPool === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelectedPool(key)}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                  active
                    ? 'bg-violet-500/25 text-white ring-1 ring-violet-400/35'
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
        <div className="mt-6 flex h-36 items-center justify-center rounded-xl border border-dashed border-white/10 text-sm text-slate-500">
          Import pulls on {stats.definition.title} to see your pity curve.
        </div>
      ) : (
        <div className="mt-6 grid h-44 items-end gap-2 pt-4" style={{ gridTemplateColumns: `repeat(${buckets.length}, minmax(0, 1fr))` }}>
          {buckets.map((b) => {
            const heightPct = b.count > 0 ? Math.max(12, (b.count / maxVal) * 100) : 3;
            return (
              <div key={b.label} className="flex h-full flex-col items-center justify-end gap-1.5">
                <span className="font-mono text-[11px] font-semibold text-slate-300 tabular-nums">
                  {b.count > 0 ? b.count : ''}
                </span>
                <div className="flex w-full flex-1 items-end">
                  <div
                    className={`w-full rounded-t-lg transition-all duration-500 ${
                      b.count === 0
                        ? 'bg-white/5'
                        : b.isSoftBand
                          ? 'bg-gradient-to-t from-amber-500/80 to-rose-400/90 shadow-lg shadow-amber-500/20'
                          : 'bg-gradient-to-t from-violet-600/80 to-cyan-400/90 shadow-lg shadow-violet-500/20'
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
