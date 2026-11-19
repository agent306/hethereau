import React, { useMemo, useState } from 'react';
import {
  Sparkles,
  Download,
  Dices,
  Coins,
  Layers,
  Users,
} from 'lucide-react';
import { POOL_ORDER, isCharacterItem } from '../lib/catalog.js';
import BannerCard from '../components/BannerCard.jsx';
import PityChart from '../components/PityChart.jsx';
import HistoryTable from '../components/HistoryTable.jsx';
import Link from '../components/Link.jsx';

export default function DashboardPage({ analysis }) {
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
      {/* Top Hero Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-white">
            Pull Counter
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Scarborough Fair &amp; Arc Research pity tracking · 100% local in your browser
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {!isEmpty && (
            <button
              type="button"
              onClick={() => setCharactersOnly((v) => !v)}
              className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition ring-1 ${
                charactersOnly
                  ? 'bg-violet-500/20 text-violet-100 ring-violet-400/45 shadow-md shadow-violet-500/10'
                  : 'bg-white/5 text-slate-300 ring-white/12 hover:bg-white/10 hover:text-white'
              }`}
              title="Toggle between showing Characters Only vs All Items (skins, gliders, mod parts, dice)"
            >
              <Users className="h-4 w-4 text-violet-300" />
              {charactersOnly ? 'Characters Only: ON' : 'Characters Only: OFF'}
            </button>
          )}
          <Link
            href="/import"
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-cyan-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-600/25 transition hover:brightness-110"
          >
            <Download className="h-4 w-4" />
            Zero-Install Import
          </Link>
        </div>
      </div>

      {/* Empty State Callout */}
      {isEmpty && (
        <div className="rounded-2xl border border-violet-500/25 bg-gradient-to-br from-violet-500/12 via-[#121728] to-cyan-500/10 p-6">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div className="max-w-xl">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-violet-500/20 px-2.5 py-0.5 text-xs font-semibold text-violet-200 ring-1 ring-violet-400/30">
                Zero-Install PC Capture
              </div>
              <h2 className="mt-2 font-display text-xl font-bold text-white">
                Import your Neverness to Everness pulls in 30 seconds
              </h2>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-300">
                Paste a single PowerShell command using Windows&apos; built-in{' '}
                <code className="rounded bg-white/10 px-1.5 py-0.5 text-xs text-cyan-200">
                  pktmon.exe
                </code>
                , flip through your in-game F3 history pages, and paste the decoded JSON right back here — zero installs, zero drivers.
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2.5">
              <Link
                href="/import"
                className="rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-slate-100"
              >
                Start Import →
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Account KPI Strip */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-2xl border border-white/8 bg-[#121728]/85 p-4">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
            <Dices className="h-4 w-4 text-violet-400" />
            Total Pulls
          </div>
          <div className="mt-2 font-mono text-2xl font-bold text-white tabular-nums">
            {totals.pulls.toLocaleString()}
          </div>
          {totals.bonusRows > 0 && (
            <div className="mt-0.5 text-[11px] text-slate-500">
              +{totals.bonusRows} board bonus rewards
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-white/8 bg-[#121728]/85 p-4">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
            <Coins className="h-4 w-4 text-cyan-400" />
            Anulith Spent
          </div>
          <div className="mt-2 font-mono text-2xl font-bold text-cyan-200 tabular-nums">
            {totals.anulith.toLocaleString()}
          </div>
          <div className="mt-0.5 text-[11px] text-slate-500">160 per pull</div>
        </div>

        <div className="rounded-2xl border border-white/8 bg-[#121728]/85 p-4">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
            <Sparkles className="h-4 w-4 text-amber-400" />
            S-Class Chars / Arcs
          </div>
          <div className="mt-2 font-mono text-2xl font-bold text-amber-300 tabular-nums">
            {totals.sRanks}
          </div>
          <div className="mt-0.5 text-[11px] text-slate-500">
            {totals.pulls > 0
              ? `${((totals.sRanks / totals.pulls) * 100).toFixed(2)}% rate${
                  totals.sRankExtras > 0 ? ` · +${totals.sRankExtras} S-items` : ''
                }`
              : '—'}
          </div>
        </div>

        <div className="rounded-2xl border border-white/8 bg-[#121728]/85 p-4">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
            <Layers className="h-4 w-4 text-fuchsia-400" />
            A-Class Chars / Arcs
          </div>
          <div className="mt-2 font-mono text-2xl font-bold text-fuchsia-300 tabular-nums">
            {totals.aRanks}
          </div>
          <div className="mt-0.5 text-[11px] text-slate-500">
            {totals.pulls > 0
              ? `${((totals.aRanks / totals.pulls) * 100).toFixed(2)}% rate`
              : '—'}
          </div>
        </div>
      </div>

      {/* 4 NTE Board Cards */}
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

      {/* Pity Distribution Chart */}
      <PityChart pools={pools} />

      {/* Recent Activity */}
      {allRecords.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-lg font-bold text-white">
              {charactersOnly ? 'Recent Character Pulls' : 'Recent Pulls'}
            </h3>
            <Link
              href="/history"
              className="text-xs font-semibold text-violet-300 hover:text-violet-200"
            >
              View full log ({allRecords.length}) →
            </Link>
          </div>
          <HistoryTable rows={recentRows} compact />
        </div>
      )}
    </div>
  );
}
