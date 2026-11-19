import React from 'react';
import { Sparkles, Flame, ShieldCheck, ArrowUpRight, Users } from 'lucide-react';
import ItemAvatar from './ItemAvatar.jsx';
import Link from './Link.jsx';

function pityPillColor(pity, hardPity) {
  if (!hardPity) return 'bg-[#f5c451]/18 text-[#fde68a] ring-[#f5c451]/45';
  const ratio = pity / hardPity;
  if (ratio <= 0.45) return 'bg-emerald-500/18 text-emerald-300 ring-emerald-400/40';
  if (ratio <= 0.78) return 'bg-[#f5c451]/18 text-[#fde68a] ring-[#f5c451]/45';
  return 'bg-rose-500/20 text-rose-300 ring-rose-400/45';
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
    nextSRankChance,
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
  const stepSlots = 10;

  return (
    <div className="nte-panel group flex flex-col justify-between overflow-hidden rounded-xl transition-all hover:border-white/18">
      {/* Top Scarborough Board Accent Rail */}
      <div
        className="h-[3px] w-full"
        style={{
          background: `linear-gradient(90deg, ${def.accent}, rgba(255,255,255,0.12) 72%, transparent)`,
        }}
      />

      <div className="p-5">
        {/* Board Plaque Header */}
        <div className="nte-stripes -mx-5 -mt-5 mb-4 flex items-start justify-between gap-3 border-b border-white/8 px-5 py-4">
          <div>
            <div className="mb-1 flex items-center gap-2 font-mono text-[10px] font-bold tracking-widest uppercase">
              <span
                className="inline-block h-2 w-2 rotate-45"
                style={{ backgroundColor: def.accent, boxShadow: `0 0 10px ${def.accent}` }}
              />
              <span style={{ color: def.accent }}>{def.code || 'BOARD'}</span>
              <span className="text-slate-600">//</span>
              <span className="text-slate-400">{def.currency}</span>
            </div>
            <h3 className="font-display text-xl font-bold tracking-wide uppercase text-white">
              {def.title}
            </h3>
            <p className="mt-0.5 text-xs text-slate-400">{def.subtitle}</p>
          </div>
          <Link
            href={`/history?pool=${encodeURIComponent(def.key)}`}
            className="nte-cut-chip inline-flex shrink-0 items-center gap-1 border border-white/12 bg-white/[0.04] px-3 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-wider text-slate-200 transition hover:border-[#f5c451]/50 hover:bg-[#f5c451]/15 hover:text-[#fef3c7]"
          >
            Ledger
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {/* Rule Badges */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded border border-white/10 bg-[#0a0c14] px-2.5 py-0.5 font-mono text-[11px] text-slate-300">
            <ShieldCheck className="h-3 w-3 text-[#2ee6ff]" />
            {def.guaranteeNote}
          </span>
          {inSoftPity && (
            <span className="inline-flex items-center gap-1 rounded border border-[#f5c451]/45 bg-[#f5c451]/15 px-2.5 py-0.5 font-mono text-[11px] font-bold text-[#fde68a]">
              <Flame className="h-3 w-3 text-[#f5c451]" />
              BOARD MOD ACTIVE (19.59%)
            </span>
          )}
          {def.key === 'fork_lottery' && guaranteedNext && (
            <span className="inline-flex items-center gap-1 rounded border border-emerald-400/40 bg-emerald-500/15 px-2.5 py-0.5 font-mono text-[11px] font-bold text-emerald-300">
              NEXT S GUARANTEED UP
            </span>
          )}
        </div>

        {/* Telemetry Counters */}
        <div className="mt-4 grid grid-cols-3 gap-2.5">
          <div className="relative overflow-hidden rounded-lg border border-white/8 bg-[#090b12] p-3">
            <span
              className="absolute top-0 left-0 h-full w-[2px]"
              style={{ backgroundColor: '#f5c451' }}
            />
            <div className="font-mono text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              {isMonopoly ? 'Char S-Pity' : 'S-Rank Pity'}
            </div>
            <div className="mt-1 flex items-baseline gap-1 font-mono tabular-nums">
              <span className="text-2xl font-bold text-[#f5c451]">{currentSPity}</span>
              {hardPity && <span className="text-xs text-slate-500">/ {hardPity}</span>}
            </div>
          </div>

          <div className="relative overflow-hidden rounded-lg border border-white/8 bg-[#090b12] p-3">
            <span className="absolute top-0 left-0 h-full w-[2px] bg-[#e046ff]" />
            <div className="font-mono text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              {isMonopoly ? '10-Pull Step' : 'A-Rank Pity'}
            </div>
            <div className="mt-1 flex items-baseline gap-1 font-mono tabular-nums">
              <span className="text-2xl font-bold text-[#e879f9]">{currentAPity}</span>
              <span className="text-xs text-slate-500">/ 10</span>
            </div>
            {/* Mini 10-step tile pips */}
            <div className="mt-1.5 flex gap-0.5">
              {Array.from({ length: stepSlots }).map((_, idx) => (
                <span
                  key={idx}
                  className={`h-1 flex-1 rounded-[1px] ${
                    idx < currentAPity ? 'bg-[#e046ff]' : 'bg-white/10'
                  }`}
                />
              ))}
            </div>
          </div>

          <div className="relative overflow-hidden rounded-lg border border-white/8 bg-[#090b12] p-3">
            <span className="absolute top-0 left-0 h-full w-[2px] bg-[#2ee6ff]" />
            <div className="font-mono text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Total Rolls
            </div>
            <div className="mt-1 font-mono text-2xl font-bold text-white tabular-nums">
              {totalPulls}
            </div>
          </div>
        </div>

        {/* Segmented Board-Tile Pity Track */}
        {hardPity && (
          <div className="mt-4">
            <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2 font-mono text-[11px] text-slate-400">
              <span>{Math.max(0, hardPity - currentSPity)} pulls to hard pity</span>
              <div className="flex items-center gap-2">
                {nextSRankChance && (
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wider ring-1 ${
                      nextSRankChance.tier === 'hard'
                        ? 'bg-emerald-500/20 text-emerald-300 ring-emerald-400/45'
                        : nextSRankChance.tier === 'soft'
                          ? 'bg-[#f5c451]/20 text-[#fde68a] ring-[#f5c451]/55'
                          : 'bg-[#2ee6ff]/12 text-[#67e8f9] ring-[#2ee6ff]/35'
                    }`}
                    title={
                      isMonopoly
                        ? `Next roll (#${currentSPity + 1}) S-Class Character chance: ${nextSRankChance.label} (Base 0.99% · Board Mod @ 70: 19.59% · Hard Pity @ 90: 100%)`
                        : `Next roll (#${currentSPity + 1}) S-Class Arc chance: ${nextSRankChance.label} (Base 3.0% · Hard Pity @ 60: 100%)`
                    }
                  >
                    NEXT: {nextSRankChance.label}
                  </span>
                )}
                {def.softPity && (
                  <span className="font-semibold text-[#f5c451]">
                    SOFT PITY @ {def.softPity}
                  </span>
                )}
              </div>
            </div>
            <div className="relative h-3 w-full overflow-hidden rounded-sm border border-white/10 bg-[#080a10]">
              <div
                className="h-full transition-all duration-500"
                style={{
                  width: `${pct}%`,
                  background: inSoftPity
                    ? 'linear-gradient(90deg, #f5c451, #fb7185)'
                    : `linear-gradient(90deg, ${def.accent}, #2ee6ff)`,
                }}
              />
              {/* 10-pull tile segment dividers */}
              <div
                className="pointer-events-none absolute inset-0"
                style={{
                  backgroundImage: `repeating-linear-gradient(90deg, transparent, transparent calc(${(10 / hardPity) * 100}% - 1px), rgba(8, 10, 16, 0.75) calc(${(10 / hardPity) * 100}% - 1px), rgba(8, 10, 16, 0.75) ${(10 / hardPity) * 100}%)`,
                }}
              />
              {softPct && (
                <div
                  className="absolute top-0 bottom-0 w-[2px] bg-[#f5c451] shadow-[0_0_8px_#f5c451]"
                  style={{ left: `${softPct}%` }}
                  title={`Board Modification soft pity at ${def.softPity}`}
                />
              )}
            </div>
          </div>
        )}

        {/* Secondary Telemetry Row */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-white/8 pt-3 text-xs text-slate-400">
          <span>
            Avg {isMonopoly ? 'S-Char' : 'S-Rank'}:{' '}
            <strong className="font-mono text-white tabular-nums">
              {sRankCount > 0 ? avgSPity.toFixed(1) : '—'}
            </strong>
          </span>
          <span>
            {isMonopoly ? 'S-Chars' : 'S-Ranks'}:{' '}
            <strong className="font-mono text-[#f5c451] tabular-nums">{sRankCount}</strong>
          </span>
          <span>
            Anulith:{' '}
            <strong className="font-mono text-[#2ee6ff] tabular-nums">
              {currencySpent.toLocaleString()}
            </strong>
          </span>
          {bonusRows > 0 && (
            <span className="font-mono text-[11px] text-emerald-400/80">
              +{bonusRows} bonus
            </span>
          )}
        </div>
      </div>

      {/* S-Class Agent Dossier Strip */}
      <div className="border-t border-white/8 bg-[#0b0d15]/70 px-5 py-3.5">
        <div className="mb-2.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-widest text-slate-400">
            <Sparkles className="h-3.5 w-3.5 text-[#f5c451]" />
            {isMonopoly
              ? charactersOnly
                ? 'S-Class Agents'
                : 'All S-Class Drops'
              : 'S-Class Pulls'}
          </div>

          {isMonopoly && nonPitySCount > 0 && onToggleCharactersOnly && (
            <button
              type="button"
              onClick={onToggleCharactersOnly}
              className={`inline-flex items-center gap-1 rounded px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider transition ring-1 ${
                charactersOnly
                  ? 'bg-[#f5c451]/16 text-[#fde68a] ring-[#f5c451]/45 hover:bg-[#f5c451]/24'
                  : 'bg-white/6 text-slate-300 ring-white/12 hover:bg-white/10'
              }`}
              title={
                charactersOnly
                  ? `Hiding ${nonPitySCount} non-character S-drops (skins, mod parts, Solid Dice). Click to show all.`
                  : 'Showing skins/mod parts/Solid Dice too (they do not reset character pity). Click for Characters Only.'
              }
            >
              <Users className="h-3 w-3" />
              {charactersOnly ? `Chars Only (+${nonPitySCount} hidden)` : 'All S Drops'}
            </button>
          )}
        </div>

        {displayedSHits.length === 0 ? (
          <div className="rounded-md border border-dashed border-white/8 bg-white/[0.02] px-3 py-2 text-xs text-slate-500">
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
                  className={`inline-flex items-center gap-2 rounded-lg border pl-1.5 pr-2 py-1 text-xs transition ${
                    isNonPity
                      ? 'border-white/8 bg-[#0b0d14]/80 opacity-75'
                      : 'border-[#f5c451]/28 bg-[#121522] shadow-sm shadow-black/40 hover:border-[#f5c451]/55'
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
                    <span className="rounded bg-rose-500/20 px-1 font-mono text-[10px] font-bold text-rose-300">
                      OFF
                    </span>
                  )}
                  {hit.rateStatus === 'guaranteed' && (
                    <span className="rounded bg-[#2ee6ff]/20 px-1 font-mono text-[10px] font-bold text-[#2ee6ff]">
                      G
                    </span>
                  )}
                  {isNonPity ? (
                    <span className="rounded bg-white/8 px-1.5 py-0.5 font-mono text-[10px] font-medium text-slate-400">
                      Item
                    </span>
                  ) : (
                    <span
                      className={`rounded px-1.5 py-0.5 font-mono text-[11px] font-bold tabular-nums ring-1 ${pityPillColor(
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
