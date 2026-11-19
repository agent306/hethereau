import React from 'react';
import { Dices, Gift, Sparkles } from 'lucide-react';
import { POOL_DEFINITIONS } from '../lib/catalog.js';
import ItemAvatar from './ItemAvatar.jsx';

function rankBadge(rank) {
  if (rank === 'S') {
    return 'bg-[#f5c451]/20 text-[#fde68a] ring-[#f5c451]/50';
  }
  if (rank === 'A') {
    return 'bg-[#e046ff]/18 text-[#f0abfc] ring-[#e046ff]/45';
  }
  return 'bg-[#2ee6ff]/12 text-[#67e8f9] ring-[#2ee6ff]/30';
}

export default function HistoryTable({ rows = [], compact = false }) {
  if (rows.length === 0) {
    return (
      <div className="nte-panel rounded-xl border-dashed py-12 text-center font-mono text-xs uppercase tracking-wider text-slate-500">
        No pulls match your filters.
      </div>
    );
  }

  return (
    <div className="nte-panel overflow-hidden rounded-xl">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-white/10 bg-[#090b12] font-mono text-[10px] font-bold uppercase tracking-widest text-slate-400">
              <th className="px-4 py-3">Time (UTC)</th>
              <th className="px-4 py-3">Reward</th>
              <th className="px-4 py-3">Rank</th>
              <th className="px-4 py-3">Board / Banner</th>
              {!compact && <th className="px-4 py-3">Roll / Source</th>}
              <th className="px-4 py-3 text-right">Pity</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.06]">
            {rows.map((row) => {
              const poolDef = POOL_DEFINITIONS[row.poolKey];
              const isS = row.item.rarity >= 5;
              const isA = row.item.rarity === 4;
              const isPityS = row.isPityResetS;
              return (
                <tr
                  key={row.id}
                  className={`transition-colors hover:bg-white/[0.04] ${
                    isPityS
                      ? 'bg-[#f5c451]/[0.08]'
                      : isS && !row.isBonus
                        ? 'bg-[#f5c451]/[0.03]'
                        : isA && !row.isBonus
                          ? 'bg-[#e046ff]/[0.03]'
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
                            className={`font-semibold ${
                              isS
                                ? 'text-[#fde68a]'
                                : isA
                                  ? 'text-[#f0abfc]'
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
                            <span className="rounded bg-[#2ee6ff]/18 px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase text-[#2ee6ff]">
                              Guaranteed
                            </span>
                          )}
                          {row.rateStatus === 'off_rate' && (
                            <span className="rounded bg-rose-500/20 px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase text-rose-300">
                              Off-Rate
                            </span>
                          )}
                        </div>
                        {!compact && row.item.category && (
                          <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
                            {row.item.category === 'fork' ? 'arc' : row.item.category}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`inline-flex items-center gap-1 rounded px-2 py-0.5 font-mono text-xs font-bold ring-1 ${rankBadge(
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
                    <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
                      {poolDef?.title || row.pool_id}
                    </div>
                  </td>
                  {!compact && (
                    <td className="px-4 py-2.5">
                      {row.isBonus ? (
                        <span className="inline-flex items-center gap-1 rounded bg-emerald-500/15 px-2 py-0.5 font-mono text-[11px] font-semibold text-emerald-300 ring-1 ring-emerald-400/30">
                          <Gift className="h-3 w-3" />
                          {row.roll_label || 'Bonus'}
                        </span>
                      ) : row.roll_points ? (
                        <span className="inline-flex items-center gap-1 rounded bg-white/[0.05] px-2 py-0.5 font-mono text-xs text-slate-200 ring-1 ring-white/10">
                          <Dices className="h-3 w-3 text-[#f5c451]" />
                          {row.roll_points}
                        </span>
                      ) : (
                        <span className="font-mono text-[11px] text-slate-500">
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
                          isPityS ? 'text-[#f5c451]' : 'text-[#e879f9]'
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
