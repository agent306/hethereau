import React from 'react';
import { Sparkles, Flame, ShieldCheck, ArrowUpRight, Users } from 'lucide-react';
import ItemAvatar from './ItemAvatar.jsx';
import Link from './Link.jsx';

function pityPillColor(pity, hardPity) {
  if (!hardPity) return 'bg-amber-500/20 text-amber-200 ring-amber-400/30';
  const ratio = pity / hardPity;
  if (ratio <= 0.45) return 'bg-emerald-500/20 text-emerald-200 ring-emerald-400/35';
  if (ratio <= 0.78) return 'bg-amber-500/20 text-amber-200 ring-amber-400/35';
  return 'bg-rose-500/20 text-rose-200 ring-rose-400/35';
}

export default function BannerCard({
  poolStats,
  charactersOnly = true,
  onToggleCharactersOnly,
}) {
  const {
    definition: def,
    totalPulls,
    bonusRows,
    currencySpent,
    currentSPity,
    currentAPity,
    inSoftPity,
    guaranteedNext,
    sRankCount,
    nonPitySCount,
    avgSPity,
    sRankHistory,
    allSRankHistory,
  } = poolStats;

  const isMonopoly =
    def.key === 'monopoly_limited' || def.key === 'monopoly_standard';
  const displayedSHits =
    isMonopoly && !charactersOnly ? allSRankHistory : sRankHistory;

  const hardPity = def.hardPity;
  const pct = hardPity ? Math.min(100, (currentSPity / hardPity) * 100) : 0;
  const softPct = hardPity && def.softPity ? (def.softPity / hardPity) * 100 : null;

  return (
    <div className="group flex flex-col justify-between rounded-2xl border border-white/8 bg-[#121728]/90 p-5 shadow-xl shadow-black/25 transition-colors hover:border-white/15">
      <div>
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: def.accent, boxShadow: `0 0 12px ${def.accent}` }}
              />
              <h3 className="font-display text-lg font-bold text-white">{def.title}</h3>
            </div>
            <p className="mt-0.5 text-xs text-slate-400">{def.subtitle}</p>
          </div>
          <Link
            href={`/history?pool=${encodeURIComponent(def.key)}`}
            className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/4 px-2.5 py-1 text-xs font-medium text-slate-300 transition hover:border-violet-400/40 hover:bg-violet-500/15 hover:text-white"
          >
            History
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {/* Rule pill */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-md bg-white/5 px-2 py-0.5 text-[11px] font-medium text-slate-300 ring-1 ring-white/8">
            <ShieldCheck className="h-3 w-3 text-cyan-400" />
            {def.guaranteeNote}
          </span>
          {inSoftPity && (
            <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-300 ring-1 ring-amber-400/35">
              <Flame className="h-3 w-3" />
              Board Mod Active (~19.6%)
            </span>
          )}
          {def.key === 'fork_lottery' && guaranteedNext && (
            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-300 ring-1 ring-emerald-400/35">
              Next S Guaranteed UP
            </span>
          )}
        </div>

        {/* Key Metric Counters */}
        <div className="mt-4 grid grid-cols-3 gap-2.5">
          <div className="rounded-xl bg-[#0c101d] p-3 ring-1 ring-white/6">
            <div className="text-[11px] font-medium text-slate-400">
              {isMonopoly ? 'Char S-Pity' : 'S-Rank Pity'}
            </div>
            <div className="mt-1 flex items-baseline gap-1 font-mono tabular-nums">
              <span className="text-2xl font-bold text-amber-300">{currentSPity}</span>
              {hardPity && <span className="text-xs text-slate-500">/ {hardPity}</span>}
            </div>
          </div>

          <div className="rounded-xl bg-[#0c101d] p-3 ring-1 ring-white/6">
            <div className="text-[11px] font-medium text-slate-400">
              {isMonopoly ? '10-Pull Step' : 'A-Rank Pity'}
            </div>
            <div className="mt-1 flex items-baseline gap-1 font-mono tabular-nums">
              <span className="text-2xl font-bold text-fuchsia-300">{currentAPity}</span>
              <span className="text-xs text-slate-500">/ 10</span>
            </div>
          </div>

          <div className="rounded-xl bg-[#0c101d] p-3 ring-1 ring-white/6">
            <div className="text-[11px] font-medium text-slate-400">Total Pulls</div>
            <div className="mt-1 font-mono text-2xl font-bold text-white tabular-nums">
              {totalPulls}
            </div>
          </div>
        </div>

        {/* Pity Progress Bar */}
        {hardPity && (
          <div className="mt-3.5">
            <div className="mb-1 flex items-center justify-between text-[11px] text-slate-400">
              <span>{Math.max(0, hardPity - currentSPity)} pulls to hard pity</span>
              {def.softPity && (
                <span className="text-amber-300/80">Soft pity @ {def.softPity}</span>
              )}
            </div>
            <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-white/8">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${pct}%`,
                  background: inSoftPity
                    ? 'linear-gradient(90deg, #f59e0b, #fb7185)'
                    : `linear-gradient(90deg, ${def.accent}, #22d3ee)`,
                }}
              />
              {softPct && (
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-amber-300/80"
                  style={{ left: `${softPct}%` }}
                  title={`Board Modification soft pity at ${def.softPity}`}
                />
              )}
            </div>
          </div>
        )}

        {/* Secondary Stats Row */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-white/6 pt-3 text-xs text-slate-400">
          <span>
            Avg {isMonopoly ? 'S-Char' : 'S-Rank'}:{' '}
            <strong className="font-mono text-slate-200 tabular-nums">
              {sRankCount > 0 ? avgSPity.toFixed(1) : '—'}
            </strong>
          </span>
          <span>
            {isMonopoly ? 'S-Chars' : 'S-Ranks'}:{' '}
            <strong className="font-mono text-amber-300 tabular-nums">{sRankCount}</strong>
          </span>
          <span>
            Anulith:{' '}
            <strong className="font-mono text-cyan-300 tabular-nums">
              {currencySpent.toLocaleString()}
            </strong>
          </span>
          {bonusRows > 0 && (
            <span className="text-[11px] text-slate-500">+{bonusRows} bonus</span>
          )}
        </div>
      </div>

      {/* S-Class Pulls Strip with Character Portraits */}
      <div className="mt-4 border-t border-white/6 pt-3">
        <div className="mb-2.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            <Sparkles className="h-3.5 w-3.5 text-amber-400" />
            {isMonopoly
              ? charactersOnly
                ? 'S-Class Characters'
                : 'All S-Class Drops'
              : 'S-Class Pulls'}
          </div>

          {isMonopoly && nonPitySCount > 0 && onToggleCharactersOnly && (
            <button
              type="button"
              onClick={onToggleCharactersOnly}
              className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold transition ring-1 ${
                charactersOnly
                  ? 'bg-violet-500/20 text-violet-200 ring-violet-400/35 hover:bg-violet-500/30'
                  : 'bg-white/6 text-slate-300 ring-white/12 hover:bg-white/10'
              }`}
              title={
                charactersOnly
                  ? `Hiding ${nonPitySCount} non-character S-drops (skins, mod parts, Solid Dice). Click to show all.`
                  : 'Showing skins/mod parts/Solid Dice too (they do not reset character pity). Click for Characters Only.'
              }
            >
              <Users className="h-3 w-3" />
              {charactersOnly ? `Chars Only (+${nonPitySCount} hidden)` : 'Showing All S'}
            </button>
          )}
        </div>

        {displayedSHits.length === 0 ? (
          <div className="rounded-lg bg-white/3 px-3 py-2 text-xs text-slate-500">
            {isMonopoly
              ? 'No S-Class characters logged on this board yet.'
              : 'No S-Class pulls logged on this board yet.'}
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {displayedSHits.map((hit) => {
              const isNonPity = isMonopoly && !hit.isPityResetS;
              return (
                <div
                  key={hit.id}
                  className={`inline-flex items-center gap-2 rounded-xl border pl-1.5 pr-2 py-1 text-xs transition ${
                    isNonPity
                      ? 'border-white/8 bg-[#0b0f1b]/80 opacity-80'
                      : 'border-white/12 bg-[#0d111e] shadow-sm shadow-black/30'
                  }`}
                  title={`${hit.item.fullName || hit.item.name} · ${hit.bannerTitle} · ${hit.time}${
                    isNonPity ? ' (Non-character tile drop; does not reset character pity)' : ''
                  }`}
                >
                  <ItemAvatar item={hit.item} size="md" />
                  <span className="max-w-[125px] truncate font-semibold text-slate-100">
                    {hit.item.name}
                  </span>
                  {hit.rateStatus === 'off_rate' && (
                    <span className="rounded bg-rose-500/20 px-1 text-[10px] font-semibold text-rose-300">
                      OFF
                    </span>
                  )}
                  {hit.rateStatus === 'guaranteed' && (
                    <span className="rounded bg-cyan-500/20 px-1 text-[10px] font-semibold text-cyan-300">
                      G
                    </span>
                  )}
                  {isNonPity ? (
                    <span className="rounded bg-white/8 px-1.5 py-0.5 font-mono text-[10px] font-medium text-slate-400">
                      Item
                    </span>
                  ) : (
                    <span
                      className={`rounded-md px-1.5 py-0.5 font-mono text-[11px] font-bold tabular-nums ring-1 ${pityPillColor(
                        hit.pityAtPull,
                        hardPity
                      )}`}
                    >
                      {hit.pityAtPull}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
