import React, { useMemo, useState } from 'react';
import {
  Sparkles,
  Download,
  Dices,
  Coins,
  Layers,
  Users,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { POOL_ORDER, isCharacterItem } from '../lib/catalog.js';
import BannerCard from '../components/BannerCard.jsx';
import PityChart from '../components/PityChart.jsx';
import HistoryTable from '../components/HistoryTable.jsx';
import Link from '../components/Link.jsx';

export default function DashboardPage({
  analysis,
  unsyncedGlobalCount = 0,
  globalSyncStatus = null,
  onSyncUnsyncedGlobal,
}) {
  const { pools, allRecords, totals } = analysis;
  const [charactersOnly, setCharactersOnly] = useState(true);
  const isEmpty = totals.pulls === 0 && totals.bonusRows === 0;

  const recentRows = useMemo(() => {
    const base = charactersOnly
      ? allRecords.filter((r) => isCharacterItem(r.item))
      : allRecords;
    return base.slice(0, 12);
  }, [allRecords, charactersOnly]);

  return (
    <div className="space-y-6">
      {/* Top Hethereau Terminal Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <div className="mb-1 flex items-center gap-2 font-mono text-[11px] font-semibold tracking-widest uppercase text-[#f5c451]">
            <span className="inline-block h-1.5 w-1.5 rotate-45 bg-[#2ee6ff]" />
            Scarborough Fair // Anomaly Pull Telemetry
          </div>
          <h1 className="font-display text-3xl font-bold tracking-wide uppercase text-white sm:text-4xl">
            Pull Counter
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Scarborough Fair &amp; Arc Research pity ledger · Stored 100% locally in your browser
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {unsyncedGlobalCount > 0 && onSyncUnsyncedGlobal && (
            <button
              type="button"
              onClick={onSyncUnsyncedGlobal}
              disabled={globalSyncStatus?.syncing}
              className="nte-cut-btn inline-flex items-center gap-2 bg-[#2ee6ff]/14 px-4 py-2.5 font-mono text-xs font-bold uppercase tracking-wider text-[#67e8f9] ring-1 ring-[#2ee6ff]/45 transition hover:bg-[#2ee6ff]/22 disabled:opacity-50"
              title="Contribute your unsynced anonymized pulls to Hethereau Global Stats"
            >
              <UploadCloud className="h-4 w-4 text-[#2ee6ff]" />
              {globalSyncStatus?.syncing
                ? 'Syncing...'
                : `Sync ${unsyncedGlobalCount.toLocaleString()} to Global`}
            </button>
          )}
          {!isEmpty && (
            <button
              type="button"
              onClick={() => setCharactersOnly((v) => !v)}
              className={`nte-cut-btn inline-flex items-center gap-2 px-4 py-2.5 font-mono text-xs font-bold uppercase tracking-wider transition ring-1 ${
                charactersOnly
                  ? 'bg-[#f5c451]/18 text-[#fef3c7] ring-[#f5c451]/55 shadow-[0_0_20px_rgba(245,196,81,0.14)]'
                  : 'bg-white/[0.04] text-slate-300 ring-white/12 hover:bg-white/[0.08] hover:text-white'
              }`}
              title="Toggle between showing Characters Only vs All Items (skins, gliders, mod parts, dice)"
            >
              <Users className="h-4 w-4 text-[#f5c451]" />
              {charactersOnly ? 'Chars Only: ON' : 'Chars Only: OFF'}
            </button>
          )}
          <Link
            href="/import"
            className="nte-cut-btn inline-flex items-center gap-2 bg-[#f5c451] px-5 py-2.5 font-display text-sm font-bold uppercase tracking-wider text-[#08090f] shadow-[0_0_24px_rgba(245,196,81,0.28)] transition hover:bg-[#ffd56b]"
          >
            <Download className="h-4 w-4" />
            Zero-Install Import
          </Link>
        </div>
      </div>

      {globalSyncStatus?.message && (
        <div
          className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 text-xs ${
            globalSyncStatus.type === 'err'
              ? 'border-rose-500/35 bg-rose-500/10 text-rose-200'
              : 'border-emerald-400/35 bg-emerald-500/10 text-emerald-200'
          }`}
        >
          {globalSyncStatus.type === 'err' ? (
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
          ) : (
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-300" />
          )}
          <span>{globalSyncStatus.message}</span>
        </div>
      )}

      {/* Empty State Callout — Eibon Intake Card */}
      {isEmpty && (
        <div className="nte-panel-gold overflow-hidden rounded-xl p-6">
          <div className="flex flex-col justify-between gap-5 md:flex-row md:items-center">
            <div className="flex items-start gap-4 max-w-2xl">
              <img
                src="/logo.png"
                alt="Hethereau Solid Die"
                className="hidden h-16 w-16 shrink-0 object-contain drop-shadow-[0_0_16px_rgba(245,196,81,0.35)] sm:block"
              />
              <div>
                <div className="inline-flex items-center gap-1.5 rounded border border-[#f5c451]/40 bg-[#f5c451]/12 px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-widest text-[#fde68a]">
                  Zero-Install PC Capture
                </div>
                <h2 className="mt-2 font-display text-xl font-bold uppercase tracking-wide text-white">
                  Import your Neverness to Everness pulls in 30 seconds
                </h2>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-300">
                  Run a single PowerShell command using Windows&apos; built-in{' '}
                  <code className="rounded bg-white/10 px-1.5 py-0.5 text-xs text-[#2ee6ff]">
                    pktmon.exe
                  </code>
                  , flip through your in-game F3 Scarborough Fair history pages, and paste the decoded JSON back here — zero installs, zero drivers.
                </p>
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2.5">
              <Link
                href="/import"
                className="nte-cut-btn bg-[#f5c451] px-5 py-2.5 font-display text-sm font-bold uppercase tracking-wider text-[#08090f] transition hover:bg-[#ffd56b]"
              >
                Start Import &rarr;
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Account Telemetry KPI Strip */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="nte-panel relative overflow-hidden rounded-xl p-4">
          <span className="absolute top-0 bottom-0 left-0 w-[3px] bg-[#f5c451]" />
          <div className="flex items-center justify-between font-mono text-[10px] font-bold uppercase tracking-widest text-slate-400">
            <span>Total Rolls</span>
            <Dices className="h-4 w-4 text-[#f5c451]" />
          </div>
          <div className="mt-2 font-mono text-2xl font-bold text-white tabular-nums">
            {totals.pulls.toLocaleString()}
          </div>
          {totals.bonusRows > 0 && (
            <div className="mt-0.5 font-mono text-[11px] text-emerald-400/80">
              +{totals.bonusRows} board bonus
            </div>
          )}
        </div>

        <div className="nte-panel relative overflow-hidden rounded-xl p-4">
          <span className="absolute top-0 bottom-0 left-0 w-[3px] bg-[#2ee6ff]" />
          <div className="flex items-center justify-between font-mono text-[10px] font-bold uppercase tracking-widest text-slate-400">
            <span>Anulith Spent</span>
            <Coins className="h-4 w-4 text-[#2ee6ff]" />
          </div>
          <div className="mt-2 font-mono text-2xl font-bold text-[#2ee6ff] tabular-nums">
            {totals.anulith.toLocaleString()}
          </div>
          <div className="mt-0.5 font-mono text-[11px] text-slate-500">160 per roll</div>
        </div>

        <div className="nte-panel relative overflow-hidden rounded-xl p-4">
          <span className="absolute top-0 bottom-0 left-0 w-[3px] bg-amber-400" />
          <div className="flex items-center justify-between font-mono text-[10px] font-bold uppercase tracking-widest text-slate-400">
            <span>S-Class Hits</span>
            <Sparkles className="h-4 w-4 text-[#f5c451]" />
          </div>
          <div className="mt-2 font-mono text-2xl font-bold text-[#f5c451] tabular-nums">
            {totals.sRanks}
          </div>
          <div className="mt-0.5 font-mono text-[11px] text-slate-400">
            {totals.pulls > 0
              ? `${((totals.sRanks / totals.pulls) * 100).toFixed(2)}%${
                  totals.sRankExtras > 0 ? ` · +${totals.sRankExtras} S-items` : ''
                }`
              : '—'}
          </div>
        </div>

        <div className="nte-panel relative overflow-hidden rounded-xl p-4">
          <span className="absolute top-0 bottom-0 left-0 w-[3px] bg-[#e046ff]" />
          <div className="flex items-center justify-between font-mono text-[10px] font-bold uppercase tracking-widest text-slate-400">
            <span>A-Class Hits</span>
            <Layers className="h-4 w-4 text-[#e046ff]" />
          </div>
          <div className="mt-2 font-mono text-2xl font-bold text-[#e879f9] tabular-nums">
            {totals.aRanks}
          </div>
          <div className="mt-0.5 font-mono text-[11px] text-slate-400">
            {totals.pulls > 0
              ? `${((totals.aRanks / totals.pulls) * 100).toFixed(2)}% rate`
              : '—'}
          </div>
        </div>
      </div>

      {/* 4 NTE Board Plaques */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {POOL_ORDER.map((poolKey) => (
          <BannerCard
            key={poolKey}
            poolStats={pools[poolKey]}
            charactersOnly={charactersOnly}
            onToggleCharactersOnly={() => setCharactersOnly((v) => !v)}
          />
        ))}
      </div>

      {/* Pity Distribution Telemetry */}
      <PityChart pools={pools} />

      {/* Recent Ledger Entries */}
      {allRecords.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-lg font-bold uppercase tracking-wide text-white">
              {charactersOnly ? 'Recent Agent Pulls' : 'Recent Pulls'}
            </h3>
            <Link
              href="/history"
              className="font-mono text-xs font-semibold uppercase tracking-wider text-[#f5c451] hover:text-[#fde68a]"
            >
              Open Full Ledger ({allRecords.length}) &rarr;
            </Link>
          </div>
          <HistoryTable rows={recentRows} compact />
        </div>
      )}
    </div>
  );
}
