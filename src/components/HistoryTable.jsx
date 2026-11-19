import React from 'react';
import { Dices, Gift, Sparkles } from 'lucide-react';
import { POOL_DEFINITIONS } from '../lib/catalog.js';
import ItemAvatar from './ItemAvatar.jsx';

function rankBadge(rank) {
  if (rank === 'S') {
    return 'bg-amber-500/20 text-amber-300 ring-amber-400/40';
  }
  if (rank === 'A') {
    return 'bg-fuchsia-500/20 text-fuchsia-300 ring-fuchsia-400/40';
  }
  return 'bg-sky-500/15 text-sky-300 ring-sky-400/30';
}

export default function HistoryTable({ rows = [], compact = false }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-white/10 bg-[#121728]/50 py-12 text-center text-sm text-slate-400">
        No pulls match your filters.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-white/8 bg-[#121728]/90 shadow-xl shadow-black/20">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-white/8 bg-[#0e1322] text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              <th className="px-4 py-3">Time (UTC)</th>
              <th className="px-4 py-3">Reward</th>
              <th className="px-4 py-3">Rank</th>
              <th className="px-4 py-3">Board / Banner</th>
              {!compact && <th className="px-4 py-3">Roll / Source</th>}
              <th className="px-4 py-3 text-right">Pity</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {rows.map((row) => {
              const poolDef = POOL_DEFINITIONS[row.poolKey];
              const isS = row.item.rarity >= 5;
              const isA = row.item.rarity === 4;
              const isPityS = row.isPityResetS;
              return (
                <tr
                  key={row.id}
                  className={`transition-colors hover:bg-white/4 ${
                    isPityS
                      ? 'bg-amber-500/[0.08]'
                      : isS && !row.isBonus
                        ? 'bg-amber-500/[0.03]'
                        : isA && !row.isBonus
                          ? 'bg-fuchsia-500/[0.03]'
                          : ''
                  }`}
                >
                  <td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs text-slate-400 tabular-nums">
                    {row.time || '—'}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <ItemAvatar item={row.item} size="md" />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span
                            className={`font-medium ${
                              isS
                                ? 'text-amber-200'
                                : isA
                                  ? 'text-fuchsia-200'
                                  : 'text-slate-200'
                            }`}
                          >
                            {row.item.name}
                          </span>
                          {row.count > 1 && (
                            <span className="font-mono text-xs text-slate-400">
                              ×{row.count}
                            </span>
                          )}
                          {row.rateStatus === 'guaranteed' && (
                            <span className="rounded bg-cyan-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-cyan-300">
                              Guaranteed
                            </span>
                          )}
                          {row.rateStatus === 'off_rate' && (
                            <span className="rounded bg-rose-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-rose-300">
                              Off-Rate
                            </span>
                          )}
                        </div>
                        {!compact && row.item.category && (
                          <div className="text-[10px] uppercase tracking-wide text-slate-500">
                            {row.item.category === 'fork' ? 'arc' : row.item.category}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-mono text-xs font-bold ring-1 ${rankBadge(
                        row.item.rank
                      )}`}
                    >
                      {isS && <Sparkles className="h-3 w-3" />}
                      {row.item.rank}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="text-xs font-medium text-slate-200">
                      {row.bannerTitle}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {poolDef?.title || row.pool_id}
                    </div>
                  </td>
                  {!compact && (
                    <td className="px-4 py-2.5">
                      {row.isBonus ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-300 ring-1 ring-emerald-400/25">
                          <Gift className="h-3 w-3" />
                          {row.roll_label || 'Bonus'}
                        </span>
                      ) : row.roll_points ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-white/5 px-2 py-0.5 font-mono text-xs text-slate-300 ring-1 ring-white/10">
                          <Dices className="h-3 w-3 text-violet-400" />
                          {row.roll_points}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-500">
                          {row.record_type === 'fork'
                            ? 'Arc 10-Pull'
                            : row.record_type === 'mystery_box'
                              ? 'Single'
                              : 'Pull'}
                        </span>
                      )}
                    </td>
                  )}
                  <td className="px-4 py-2.5 text-right font-mono text-xs tabular-nums">
                    {row.isBonus ? (
                      <span
                        className="text-slate-500"
                        title="Bonus rewards do not increment pity"
                      >
                        —
                      </span>
                    ) : row.pityAtPull ? (
                      <span
                        className={`font-bold ${
                          isPityS ? 'text-amber-300' : 'text-fuchsia-300'
                        }`}
                      >
                        {row.pityAtPull}
                      </span>
                    ) : (
                      <span className="text-slate-500">#{row.pullIndex}</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
