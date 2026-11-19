import React, { useEffect, useMemo, useState } from 'react';
import { Search, Download, ChevronLeft, ChevronRight, Users } from 'lucide-react';
import {
  POOL_DEFINITIONS,
  POOL_ORDER,
  isCharacterItem,
  isArcItem,
} from '../lib/catalog.js';
import { navigate } from '../lib/router.js';
import HistoryTable from '../components/HistoryTable.jsx';

const PAGE_SIZE = 30;

export default function HistoryPage({ allRecords, initialPool = 'all' }) {
  const [poolFilter, setPoolFilter] = useState(initialPool);
  const [rankFilter, setRankFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [includeBonus, setIncludeBonus] = useState(true);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPoolFilter(initialPool);
    setPage(1);
  }, [initialPool]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allRecords.filter((row) => {
      if (poolFilter !== 'all' && row.poolKey !== poolFilter) return false;
      if (rankFilter !== 'all' && row.item.rank !== rankFilter) return false;
      if (categoryFilter === 'character' && !isCharacterItem(row.item)) return false;
      if (categoryFilter === 'arc' && !isArcItem(row.item)) return false;
      if (
        categoryFilter === 'other' &&
        (isCharacterItem(row.item) || isArcItem(row.item))
      ) {
        return false;
      }
      if (!includeBonus && row.isBonus) return false;
      if (q) {
        const hay = `${row.item.name} ${row.item.fullName || ''} ${row.item.id} ${row.bannerTitle} ${row.roll_label || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [allRecords, poolFilter, rankFilter, categoryFilter, includeBonus, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const charactersOnlyActive = categoryFilter === 'character';

  function exportCsv() {
    const headers = [
      'time',
      'pool',
      'banner',
      'item_id',
      'item_name',
      'category',
      'rank',
      'count',
      'roll_label',
      'is_bonus',
      'pity',
    ];
    const lines = [headers.join(',')];
    for (const r of filtered) {
      const vals = [
        r.time,
        r.poolKey,
        r.bannerTitle,
        r.item.id,
        r.item.name,
        r.item.category || '',
        r.item.rank,
        r.count,
        r.roll_label || r.roll_points || '',
        r.isBonus ? 'true' : 'false',
        r.pityAtPull ?? '',
      ].map((v) => `"${String(v).replace(/"/g, '""')}"`);
      lines.push(vals.join(','));
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nte-pulls-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <div className="mb-1 flex items-center gap-2 font-mono text-[11px] font-semibold tracking-widest uppercase text-[#f5c451]">
            <span className="inline-block h-1.5 w-1.5 rotate-45 bg-[#2ee6ff]" />
            Eibon Records // Archive Search
          </div>
          <h1 className="font-display text-3xl font-bold tracking-wide uppercase text-white">
            Pull Ledger
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Showing <span className="font-mono font-semibold text-[#f5c451]">{filtered.length}</span> of{' '}
            <span className="font-mono text-slate-200">{allRecords.length}</span> records
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setCategoryFilter(charactersOnlyActive ? 'all' : 'character');
              setPage(1);
            }}
            className={`nte-cut-btn inline-flex items-center gap-1.5 px-3.5 py-2 font-mono text-xs font-bold uppercase tracking-wider transition ring-1 ${
              charactersOnlyActive
                ? 'bg-[#f5c451]/18 text-[#fef3c7] ring-[#f5c451]/55'
                : 'bg-white/[0.04] text-slate-300 ring-white/12 hover:bg-white/[0.08] hover:text-white'
            }`}
          >
            <Users className="h-3.5 w-3.5 text-[#f5c451]" />
            Characters Only
          </button>

          <button
            type="button"
            onClick={exportCsv}
            disabled={filtered.length === 0}
            className="nte-cut-btn inline-flex items-center gap-2 border border-white/12 bg-white/[0.05] px-3.5 py-2 font-mono text-xs font-bold uppercase tracking-wider text-slate-200 transition hover:border-[#2ee6ff]/45 hover:bg-[#2ee6ff]/12 hover:text-white disabled:opacity-40"
          >
            <Download className="h-3.5 w-3.5 text-[#2ee6ff]" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="nte-panel flex flex-wrap items-center gap-3 rounded-xl p-3.5">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
            placeholder="Search agent, arc, banner..."
            className="w-full rounded-lg border border-white/10 bg-[#080a10] py-2 pr-3 pl-9 text-sm text-white placeholder-slate-500 outline-none focus:border-[#f5c451]/70"
          />
        </div>

        <select
          value={poolFilter}
          onChange={(e) => {
            const nextPool = e.target.value;
            setPoolFilter(nextPool);
            setPage(1);
            navigate(
              nextPool === 'all'
                ? '/history'
                : `/history?pool=${encodeURIComponent(nextPool)}`,
              { replace: true }
            );
          }}
          className="rounded-lg border border-white/10 bg-[#080a10] px-3 py-2 text-sm text-slate-200 outline-none focus:border-[#f5c451]/70"
        >
          <option value="all">All Boards</option>
          {POOL_ORDER.map((k) => (
            <option key={k} value={k}>
              {POOL_DEFINITIONS[k].title}
            </option>
          ))}
        </select>

        <select
          value={categoryFilter}
          onChange={(e) => {
            setCategoryFilter(e.target.value);
            setPage(1);
          }}
          className="rounded-lg border border-white/10 bg-[#080a10] px-3 py-2 text-sm text-slate-200 outline-none focus:border-[#f5c451]/70"
        >
          <option value="all">All Categories</option>
          <option value="character">Characters Only</option>
          <option value="arc">Arcs Only</option>
          <option value="other">Skins, Mod Parts &amp; Items</option>
        </select>

        <div className="flex gap-1 rounded-lg border border-white/10 bg-[#080a10] p-1">
          {['all', 'S', 'A', 'B'].map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => {
                setRankFilter(r);
                setPage(1);
              }}
              className={`rounded px-2.5 py-1 font-mono text-xs font-bold uppercase transition ${
                rankFilter === r
                  ? r === 'S'
                    ? 'bg-[#f5c451]/20 text-[#fde68a] ring-1 ring-[#f5c451]/50'
                    : r === 'A'
                      ? 'bg-[#e046ff]/20 text-[#f0abfc] ring-1 ring-[#e046ff]/50'
                      : 'bg-[#2ee6ff]/18 text-[#67e8f9] ring-1 ring-[#2ee6ff]/45'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {r === 'all' ? 'All' : r}
            </button>
          ))}
        </div>

        <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-slate-300 select-none">
          <input
            type="checkbox"
            checked={includeBonus}
            onChange={(e) => {
              setIncludeBonus(e.target.checked);
              setPage(1);
            }}
            className="h-3.5 w-3.5 accent-[#f5c451]"
          />
          Show bonus rows
        </label>
      </div>

      <HistoryTable rows={pageRows} />

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between font-mono text-xs text-slate-400">
          <span>
            PAGE <strong className="text-[#f5c451]">{safePage}</strong> /{' '}
            <strong className="text-slate-200">{totalPages}</strong>
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/[0.04] px-3 py-1.5 font-semibold uppercase text-slate-200 hover:border-[#f5c451]/45 hover:bg-[#f5c451]/10 disabled:opacity-40"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Prev
            </button>
            <button
              type="button"
              disabled={safePage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/[0.04] px-3 py-1.5 font-semibold uppercase text-slate-200 hover:border-[#f5c451]/45 hover:bg-[#f5c451]/10 disabled:opacity-40"
            >
              Next
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
