import React, { useEffect, useMemo, useState } from 'react';
import {
  Globe2,
  RefreshCw,
  Sparkles,
  Users,
  Dices,
  Layers,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  BarChart3,
  ShieldCheck,
} from 'lucide-react';
import { POOL_DEFINITIONS, POOL_ORDER } from '../lib/catalog.js';
import {
  contributePullRecords,
  fetchGlobalStats,
  getUnsyncedGlobalRecords,
} from '../lib/statsApi.js';
import ItemAvatar from '../components/ItemAvatar.jsx';
import { BANNER_FEATURED_META } from '../lib/officialMedia.js';

export default function GlobalStatsPage({
  catalog,
  activeProfile,
  globalSyncVersion = 0,
  onGlobalSynced,
}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedPool, setSelectedPool] = useState('monopoly_limited');
  const [charsOnly, setCharsOnly] = useState(true);
  const [contributing, setContributing] = useState(false);
  const [contribMsg, setContribMsg] = useState(null);

  const unsyncedCount = useMemo(
    () => getUnsyncedGlobalRecords(activeProfile?.records || []).length,
    [activeProfile, globalSyncVersion]
  );

  async function loadStats(fresh = false) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchGlobalStats({ fresh });
      setData(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadStats(false);
  }, []);

  async function handleContributeExisting() {
    if (!activeProfile?.records?.length) return;
    setContributing(true);
    setContribMsg(null);
    try {
      const res = await contributePullRecords(activeProfile.records, {
        format: 'existing_profile',
        region: activeProfile.region || 'Global',
        source: 'pktmon_zero_install',
      });
      setContribMsg({
        type: 'ok',
        text:
          res.accepted > 0
            ? `Synced +${res.accepted.toLocaleString()} new anonymized pulls to Global Stats (${res.duplicates.toLocaleString()} already counted).`
            : `All ${res.duplicates.toLocaleString()} of your pulls are already synced to Global Stats.`,
      });
      if (onGlobalSynced) onGlobalSynced();
      await loadStats(true);
    } catch (err) {
      setContribMsg({ type: 'err', text: err.message });
    } finally {
      setContributing(false);
    }
  }

  const poolDef = POOL_DEFINITIONS[selectedPool];
  const poolStats = data?.pools?.[selectedPool] || null;
  const hardPity = poolDef?.hardPity || 90;
  const softPity = poolDef?.softPity || null;

  // Build 5-pull histogram buckets for sharper visualization of the 70+ Board Mod spike
  const buckets = useMemo(() => {
    const hist = poolStats?.histogram || {};
    const step = hardPity <= 60 ? 5 : 5;
    const count = Math.ceil(hardPity / step);
    const arr = [];
    let maxVal = 1;
    for (let i = 0; i < count; i++) {
      const start = i * step + 1;
      const end = Math.min(hardPity, (i + 1) * step);
      let sum = 0;
      for (let p = start; p <= end; p++) {
        sum += Number(hist[p] || hist[String(p)] || 0);
      }
      if (sum > maxVal) maxVal = sum;
      arr.push({
        label: `${start}-${end}`,
        shortLabel: `${start}`,
        start,
        end,
        count: sum,
        isSoft: Boolean(softPity && start >= softPity),
      });
    }
    return { arr, maxVal };
  }, [poolStats, hardPity, softPity]);

  const totals = data?.totals || {
    totalPulls: 0,
    sRankPityHits: 0,
    aRankHits: 0,
    sRatePct: 0,
    contributors: 0,
  };

  const measuredTotal =
    (poolStats?.earlyHits || 0) +
    (poolStats?.softPityHits || 0) +
    (poolStats?.hardPityHits || 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <div className="mb-1 flex items-center gap-2 font-mono text-[11px] font-semibold tracking-widest uppercase text-[#2ee6ff]">
            <span className="inline-block h-1.5 w-1.5 rotate-45 bg-[#f5c451]" />
            Hethereau Network // Community Aggregate
          </div>
          <h1 className="font-display text-3xl font-bold tracking-wide uppercase text-white sm:text-4xl">
            Global Stats
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Anonymized, server-validated community pull rates &amp; pity curves across Hethereau players
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {unsyncedCount > 0 && (
            <button
              type="button"
              onClick={handleContributeExisting}
              disabled={contributing}
              className="nte-cut-btn inline-flex items-center gap-2 bg-[#f5c451] px-4 py-2.5 font-display text-xs font-bold uppercase tracking-wider text-[#08090f] shadow-[0_0_20px_rgba(245,196,81,0.22)] transition hover:bg-[#ffd56b] disabled:opacity-50"
            >
              <UploadCloud className="h-4 w-4" />
              {contributing
                ? 'Syncing...'
                : `Sync ${unsyncedCount.toLocaleString()} Unsynced to Global`}
            </button>
          )}
          <button
            type="button"
            onClick={() => loadStats(true)}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-white/12 bg-white/[0.04] px-3.5 py-2.5 font-mono text-xs font-bold uppercase tracking-wider text-slate-200 transition hover:border-[#2ee6ff]/45 hover:bg-[#2ee6ff]/10 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-[#2ee6ff] ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {contribMsg && (
        <div
          className={`flex items-center gap-2 rounded-lg border px-4 py-3 text-sm ${
            contribMsg.type === 'ok'
              ? 'border-emerald-400/35 bg-emerald-500/12 text-emerald-200'
              : 'border-rose-400/35 bg-rose-500/12 text-rose-200'
          }`}
        >
          {contribMsg.type === 'ok' ? (
            <CheckCircle2 className="h-4 w-4 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0" />
          )}
          <span>{contribMsg.text}</span>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-rose-500/35 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Community KPI Strip */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="nte-panel relative overflow-hidden rounded-xl p-4">
          <span className="absolute top-0 bottom-0 left-0 w-[3px] bg-[#f5c451]" />
          <div className="flex items-center justify-between font-mono text-[10px] font-bold uppercase tracking-widest text-slate-400">
            <span>Community Rolls</span>
            <Dices className="h-4 w-4 text-[#f5c451]" />
          </div>
          <div className="mt-2 font-mono text-2xl font-bold text-white tabular-nums">
            {totals.totalPulls.toLocaleString()}
          </div>
          <div className="mt-0.5 font-mono text-[11px] text-slate-500">
            Verified exports only
          </div>
        </div>

        <div className="nte-panel relative overflow-hidden rounded-xl p-4">
          <span className="absolute top-0 bottom-0 left-0 w-[3px] bg-amber-400" />
          <div className="flex items-center justify-between font-mono text-[10px] font-bold uppercase tracking-widest text-slate-400">
            <span>S-Class Hits</span>
            <Sparkles className="h-4 w-4 text-[#f5c451]" />
          </div>
          <div className="mt-2 font-mono text-2xl font-bold text-[#f5c451] tabular-nums">
            {totals.sRankPityHits.toLocaleString()}
          </div>
          <div className="mt-0.5 font-mono text-[11px] text-slate-400">
            {totals.totalPulls > 0 ? `${totals.sRatePct.toFixed(2)}% observed rate` : '—'}
          </div>
        </div>

        <div className="nte-panel relative overflow-hidden rounded-xl p-4">
          <span className="absolute top-0 bottom-0 left-0 w-[3px] bg-[#e046ff]" />
          <div className="flex items-center justify-between font-mono text-[10px] font-bold uppercase tracking-widest text-slate-400">
            <span>A-Class Hits</span>
            <Layers className="h-4 w-4 text-[#e046ff]" />
          </div>
          <div className="mt-2 font-mono text-2xl font-bold text-[#e879f9] tabular-nums">
            {totals.aRankHits.toLocaleString()}
          </div>
          <div className="mt-0.5 font-mono text-[11px] text-slate-400">
            {totals.totalPulls > 0
              ? `${((totals.aRankHits / totals.totalPulls) * 100).toFixed(2)}% rate`
              : '—'}
          </div>
        </div>

        <div className="nte-panel relative overflow-hidden rounded-xl p-4">
          <span className="absolute top-0 bottom-0 left-0 w-[3px] bg-[#2ee6ff]" />
          <div className="flex items-center justify-between font-mono text-[10px] font-bold uppercase tracking-widest text-slate-400">
            <span>Contributors</span>
            <Users className="h-4 w-4 text-[#2ee6ff]" />
          </div>
          <div className="mt-2 font-mono text-2xl font-bold text-[#2ee6ff] tabular-nums">
            {totals.contributors.toLocaleString()}
          </div>
          <div className="mt-0.5 font-mono text-[11px] text-slate-500">
            Deduplicated globally
          </div>
        </div>
      </div>

      {/* Board Selector Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5 rounded-lg border border-white/10 bg-[#090b12] p-1">
          {POOL_ORDER.map((key) => {
            const def = POOL_DEFINITIONS[key];
            const active = selectedPool === key;
            const pCount = data?.pools?.[key]?.totalPulls || 0;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelectedPool(key)}
                className={`rounded px-3 py-1.5 font-mono text-xs font-bold uppercase tracking-wider transition ${
                  active
                    ? 'bg-[#f5c451]/18 text-[#fef3c7] ring-1 ring-[#f5c451]/50'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {def.title}
                <span className="ml-1.5 text-[10px] opacity-70">
                  ({pCount.toLocaleString()})
                </span>
              </button>
            );
          })}
        </div>

        {data?.updatedAt > 0 && (
          <div className="flex items-center gap-1.5 font-mono text-[11px] text-slate-500">
            <Globe2 className="h-3.5 w-3.5 text-[#2ee6ff]" />
            Last contribution: {new Date(data.updatedAt).toLocaleString()}
          </div>
        )}
      </div>

      {/* Selected Board Deep Stats */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Community Pity Distribution Curve */}
        <div className="nte-panel rounded-xl p-5 lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-[#f5c451]" />
                <h2 className="font-display text-base font-bold uppercase tracking-wide text-white">
                  {poolDef.title} — Community Pity Curve
                </h2>
              </div>
              <p className="mt-0.5 text-xs text-slate-400">
                Measured S-Class pity distribution (gold-crimson highlights Board Mod 70+ zone)
              </p>
            </div>
            <div className="flex items-center gap-3 font-mono text-xs">
              <span className="text-slate-400">
                Avg Pity:{' '}
                <strong className="text-[#f5c451]">
                  {poolStats?.sRankPityMeasured > 0 ? poolStats.avgSPity.toFixed(1) : '—'}
                </strong>
              </span>
              <span className="text-slate-400">
                S-Rate:{' '}
                <strong className="text-[#2ee6ff]">
                  {poolStats?.totalPulls > 0 ? `${poolStats.sRatePct.toFixed(2)}%` : '—'}
                </strong>
              </span>
            </div>
          </div>

          {!poolStats || poolStats.sRankPityMeasured === 0 ? (
            <div className="mt-6 flex h-44 items-center justify-center rounded-lg border border-dashed border-white/10 bg-[#090b12]/60 font-mono text-xs text-slate-500">
              {loading
                ? 'Loading global Durable Object telemetry...'
                : `No measured S-Class pity curves contributed on ${poolDef.title} yet.`}
            </div>
          ) : (
            <div
              className="mt-6 grid h-48 items-end gap-1 border-b border-white/10 pt-4 pb-2"
              style={{
                gridTemplateColumns: `repeat(${buckets.arr.length}, minmax(0, 1fr))`,
              }}
            >
              {buckets.arr.map((b) => {
                const heightPct =
                  b.count > 0 ? Math.max(10, (b.count / buckets.maxVal) * 100) : 3;
                return (
                  <div
                    key={b.label}
                    className="flex h-full flex-col items-center justify-end gap-1"
                  >
                    <span className="font-mono text-[9px] font-bold text-slate-300 tabular-nums">
                      {b.count > 0 ? b.count : ''}
                    </span>
                    <div className="flex w-full flex-1 items-end">
                      <div
                        className={`w-full rounded-t-[2px] transition-all duration-500 ${
                          b.count === 0
                            ? 'bg-white/[0.04]'
                            : b.isSoft
                              ? 'bg-gradient-to-t from-rose-500/85 to-[#f5c451]'
                              : 'bg-gradient-to-t from-[#d946ef]/75 to-[#2ee6ff]'
                        }`}
                        style={{ height: `${heightPct}%` }}
                        title={`Pulls ${b.label}: ${b.count} S-Class hits`}
                      />
                    </div>
                    <span className="font-mono text-[9px] text-slate-500">
                      {b.shortLabel}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Early vs Soft vs Hard Pity Split */}
          {measuredTotal > 0 && (
            <div className="mt-4 grid grid-cols-3 gap-2.5 font-mono text-xs">
              <div className="rounded-lg border border-white/8 bg-[#090b12] p-2.5">
                <div className="text-[10px] uppercase text-slate-400">
                  Early (1–{softPity ? softPity - 1 : hardPity - 1})
                </div>
                <div className="mt-1 font-bold text-emerald-300">
                  {((poolStats.earlyHits / measuredTotal) * 100).toFixed(1)}%
                  <span className="ml-1.5 text-[10px] text-slate-500">
                    ({poolStats.earlyHits})
                  </span>
                </div>
              </div>
              <div className="rounded-lg border border-white/8 bg-[#090b12] p-2.5">
                <div className="text-[10px] uppercase text-slate-400">
                  {softPity ? `Board Mod (${softPity}–${hardPity - 1})` : 'Soft Band'}
                </div>
                <div className="mt-1 font-bold text-[#f5c451]">
                  {((poolStats.softPityHits / measuredTotal) * 100).toFixed(1)}%
                  <span className="ml-1.5 text-[10px] text-slate-500">
                    ({poolStats.softPityHits})
                  </span>
                </div>
              </div>
              <div className="rounded-lg border border-white/8 bg-[#090b12] p-2.5">
                <div className="text-[10px] uppercase text-slate-400">
                  Hard Pity ({hardPity})
                </div>
                <div className="mt-1 font-bold text-rose-300">
                  {((poolStats.hardPityHits / measuredTotal) * 100).toFixed(1)}%
                  <span className="ml-1.5 text-[10px] text-slate-500">
                    ({poolStats.hardPityHits})
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Banner Breakdown */}
        <div className="nte-panel rounded-xl p-5">
          <h2 className="font-display text-base font-bold uppercase tracking-wide text-white">
            Banner Volume
          </h2>
          <p className="mt-0.5 text-xs text-slate-400">
            Pulls logged per active/past {poolDef.title.toLowerCase()} banner
          </p>

          {!poolStats?.banners?.length ? (
            <div className="mt-5 rounded-lg border border-dashed border-white/10 bg-[#090b12]/60 p-6 text-center font-mono text-xs text-slate-500">
              No banner data yet.
            </div>
          ) : (
            <div className="mt-4 space-y-2.5">
              {poolStats.banners.map((b) => {
                const rate =
                  b.total_pulls > 0 ? ((b.s_hits / b.total_pulls) * 100).toFixed(2) : '0.00';
                const meta = BANNER_FEATURED_META[b.banner_id];
                const featuredItem = meta?.charId ? catalog?.resolveItem(meta.charId) : null;
                return (
                  <div
                    key={b.banner_id}
                    className="flex items-center gap-3 rounded-lg border border-white/8 bg-[#090b12] px-3 py-2.5"
                  >
                    {featuredItem && <ItemAvatar item={featuredItem} size="md" />}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-xs font-semibold text-white">
                          {b.banner_title}
                          {meta?.charName && (
                            <span className="ml-1.5 font-normal text-slate-400">
                              ({meta.charName})
                            </span>
                          )}
                        </span>
                        <span className="font-mono text-xs font-bold text-[#f5c451] tabular-nums">
                          {b.total_pulls.toLocaleString()}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center justify-between font-mono text-[10px] text-slate-400">
                        <span>{b.s_hits.toLocaleString()} S-Class hits</span>
                        <span className="text-[#2ee6ff]">{rate}% rate</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Top Pulled S-Class Characters / Items */}
      <div className="nte-panel rounded-xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-base font-bold uppercase tracking-wide text-white">
              Most Pulled S-Class on {poolDef.title}
            </h2>
            <p className="mt-0.5 text-xs text-slate-400">
              Verified catalog drops aggregated from opted-in community exports
            </p>
          </div>
          <div className="flex items-center gap-2">
            {(selectedPool === 'monopoly_limited' ||
              selectedPool === 'monopoly_standard') && (
              <button
                type="button"
                onClick={() => setCharsOnly((v) => !v)}
                className={`inline-flex items-center gap-1 rounded px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-wider transition ring-1 ${
                  charsOnly
                    ? 'bg-[#f5c451]/18 text-[#fde68a] ring-[#f5c451]/50'
                    : 'bg-white/[0.04] text-slate-300 ring-white/12 hover:bg-white/10'
                }`}
              >
                <Users className="h-3 w-3" />
                {charsOnly ? 'Characters Only' : 'All S Drops'}
              </button>
            )}
            <span className="inline-flex items-center gap-1 rounded border border-emerald-400/30 bg-emerald-500/10 px-2.5 py-1 font-mono text-[10px] font-bold uppercase text-emerald-300">
              <ShieldCheck className="h-3.5 w-3.5" />
              Anti-Spam Verified
            </span>
          </div>
        </div>

        {(() => {
          const isMonopoly =
            selectedPool === 'monopoly_limited' ||
            selectedPool === 'monopoly_standard';
          const itemsToShow = (poolStats?.topSItems || []).filter((row) =>
            isMonopoly && charsOnly ? row.category === 'character' || row.is_pity_s : true
          );
          if (itemsToShow.length === 0) {
            return (
              <div className="mt-4 rounded-lg border border-dashed border-white/10 bg-[#090b12]/60 p-6 text-center font-mono text-xs text-slate-500">
                No S-Class items recorded on this board yet.
              </div>
            );
          }
          return (
            <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {itemsToShow.map((row) => {
                const resolved = catalog?.resolveItem(row.item_id, row.item_name, 5) || {
                  id: row.item_id,
                  name: row.item_name,
                  rarity: 5,
                  rank: 'S',
                  category: row.category,
                };
                return (
                  <div
                    key={row.item_id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-white/8 bg-[#090b12] px-3 py-2.5"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <ItemAvatar item={resolved} size="md" />
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-white">
                          {resolved.name}
                        </div>
                        <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
                          {row.is_pity_s ? 'Pity S-Class' : row.category}
                        </div>
                      </div>
                    </div>
                    <span className="rounded bg-[#f5c451]/16 px-2 py-0.5 font-mono text-xs font-bold text-[#fde68a] ring-1 ring-[#f5c451]/40 tabular-nums">
                      {row.count.toLocaleString()}
                    </span>
                  </div>
                );
              })}
            </div>
          );
        })()}
      </div>
    </div>
  );
}
