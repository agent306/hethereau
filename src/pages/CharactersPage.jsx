import React, { useEffect, useMemo, useState } from 'react';
import { Search, Sparkles, CheckCircle2, Users, Plus, Minus } from 'lucide-react';
import { getCharacterPoster } from '../lib/officialMedia.js';

function CharacterCardImage({ charId, name }) {
  const poster = getCharacterPoster(charId);
  const fallback = `/avatars/${charId}.png`;
  const [src, setSrc] = useState(poster);

  useEffect(() => {
    setSrc(poster);
  }, [poster]);

  return (
    <img
      src={src}
      alt={name}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => {
        if (src !== fallback) setSrc(fallback);
      }}
      className="h-full w-full object-cover object-top transition duration-500 group-hover:scale-105"
    />
  );
}

export default function CharactersPage({
  catalog,
  allRecords = [],
  manualCharacters = {},
  onAdjustManualCharacter,
}) {
  const [rankFilter, setRankFilter] = useState('all'); // 'all' | 'S' | 'A'
  const [ownedFilter, setOwnedFilter] = useState('all'); // 'all' | 'owned' | 'unowned'
  const [query, setQuery] = useState('');

  // Auto-count pulled copies straight from the user's pull history
  const pulledCounts = useMemo(() => {
    const map = {};
    for (const r of allRecords) {
      if (r.item?.category === 'character') {
        const id = String(r.item.id);
        map[id] = (map[id] || 0) + (Number(r.count) || 1);
      }
    }
    return map;
  }, [allRecords]);

  const characters = useMemo(() => {
    if (!catalog) return [];
    const list = [];
    for (const item of catalog.itemsByLower.values()) {
      if (item.category === 'character') {
        const pulled = pulledCounts[item.id] || 0;
        const manual = Math.max(0, Number(manualCharacters?.[item.id] || 0));
        const copies = pulled + manual;
        const awakening = copies > 0 ? Math.min(6, copies - 1) : null;
        list.push({
          ...item,
          pulled,
          manual,
          copies,
          awakening,
          owned: copies > 0,
        });
      }
    }
    return list.sort((a, b) => {
      if (b.rarity !== a.rarity) return b.rarity - a.rarity;
      if (b.owned !== a.owned) return Number(b.owned) - Number(a.owned);
      return a.name.localeCompare(b.name);
    });
  }, [catalog, pulledCounts, manualCharacters]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return characters.filter((c) => {
      if (rankFilter !== 'all' && c.rank !== rankFilter) return false;
      if (ownedFilter === 'owned' && !c.owned) return false;
      if (ownedFilter === 'unowned' && c.owned) return false;
      if (q && !c.name.toLowerCase().includes(q) && !c.id.includes(q)) return false;
      return true;
    });
  }, [characters, rankFilter, ownedFilter, query]);

  const totalOwned = characters.filter((c) => c.owned).length;
  const sOwned = characters.filter((c) => c.rank === 'S' && c.owned).length;
  const sTotal = characters.filter((c) => c.rank === 'S').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <div className="mb-1 flex items-center gap-2 font-mono text-[11px] font-semibold tracking-widest uppercase text-[#f5c451]">
            <span className="inline-block h-1.5 w-1.5 rotate-45 bg-[#2ee6ff]" />
            Eibon Dossier // Playable Characters
          </div>
          <h1 className="font-display text-3xl font-bold tracking-wide uppercase text-white sm:text-4xl">
            Characters
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Official Hethereau character artwork · Auto-synced from pull history + manual Character Selector / Awakening controls
          </p>
        </div>

        <div className="flex items-center gap-3 font-mono text-xs">
          <div className="nte-panel rounded-lg px-3.5 py-2">
            <span className="text-slate-400">COLLECTED </span>
            <strong className="text-white">
              {totalOwned} / {characters.length}
            </strong>
          </div>
          <div className="nte-panel rounded-lg px-3.5 py-2">
            <span className="text-slate-400">S-CLASS </span>
            <strong className="text-[#f5c451]">
              {sOwned} / {sTotal}
            </strong>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="nte-panel flex flex-wrap items-center gap-3 rounded-xl p-3.5">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search character name..."
            className="w-full rounded-lg border border-white/10 bg-[#080a10] py-2 pr-3 pl-9 text-sm text-white placeholder-slate-500 outline-none focus:border-[#f5c451]/70"
          />
        </div>

        <div className="flex gap-1 rounded-lg border border-white/10 bg-[#080a10] p-1">
          {['all', 'S', 'A'].map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRankFilter(r)}
              className={`rounded px-3 py-1 font-mono text-xs font-bold uppercase transition ${
                rankFilter === r
                  ? r === 'S'
                    ? 'bg-[#f5c451]/20 text-[#fde68a] ring-1 ring-[#f5c451]/50'
                    : r === 'A'
                      ? 'bg-[#e046ff]/20 text-[#f0abfc] ring-1 ring-[#e046ff]/50'
                      : 'bg-[#2ee6ff]/18 text-[#67e8f9] ring-1 ring-[#2ee6ff]/45'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {r === 'all' ? 'All Ranks' : `${r}-Class`}
            </button>
          ))}
        </div>

        <div className="flex gap-1 rounded-lg border border-white/10 bg-[#080a10] p-1">
          {[
            { id: 'all', label: 'All' },
            { id: 'owned', label: 'Owned' },
            { id: 'unowned', label: 'Unowned' },
          ].map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => setOwnedFilter(o.id)}
              className={`rounded px-2.5 py-1 font-mono text-xs font-bold uppercase transition ${
                ownedFilter === o.id
                  ? 'bg-[#f5c451]/18 text-[#fde68a] ring-1 ring-[#f5c451]/45'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {/* Hint bar */}
      <div className="flex items-center gap-2.5 rounded-lg border border-white/8 bg-[#0b0d15]/80 px-3.5 py-2 text-xs text-slate-400">
        <Users className="h-3.5 w-3.5 shrink-0 text-[#2ee6ff]" />
        <span>
          Use <strong className="text-slate-200">+</strong> / <strong className="text-slate-200">&minus;</strong> on any character card to add Character Selectors (e.g. 50-roll Strange Encounters Selector), free unlocks, or Mind Shard Awakenings. Changes auto-sync with Google Drive.
        </span>
      </div>

      {/* Poster Card Grid */}
      {filtered.length === 0 ? (
        <div className="nte-panel rounded-xl py-12 text-center font-mono text-xs uppercase text-slate-500">
          No characters match your filters.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
          {filtered.map((ch) => {
            const isS = ch.rank === 'S';
            const copyBreakdown = `${ch.pulled} pulled${
              ch.manual > 0 ? ` + ${ch.manual} manual` : ''
            }`;
            return (
              <div
                key={ch.id}
                className={`nte-panel group flex flex-col overflow-hidden rounded-xl border transition ${
                  ch.owned
                    ? isS
                      ? 'border-[#f5c451]/45 shadow-[0_0_24px_rgba(245,196,81,0.1)]'
                      : 'border-[#e046ff]/40'
                    : 'border-white/8 opacity-80 hover:opacity-100'
                }`}
              >
                <div className="relative aspect-[3/4] overflow-hidden bg-[#090b12]">
                  <CharacterCardImage charId={ch.id} name={ch.name} />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0b0d15] via-transparent to-black/25" />

                  {/* Rarity Pill */}
                  <span
                    className={`absolute top-2.5 left-2.5 inline-flex items-center gap-1 rounded px-2 py-0.5 font-mono text-[10px] font-bold ring-1 ${
                      isS
                        ? 'bg-[#f5c451]/90 text-[#08090f] ring-[#fde68a]'
                        : 'bg-[#e046ff]/85 text-white ring-[#f0abfc]'
                    }`}
                  >
                    {isS && <Sparkles className="h-2.5 w-2.5" />}
                    {ch.rank}
                  </span>

                  {/* Owned / Awakening Badge */}
                  {ch.owned ? (
                    <span
                      className="absolute top-2.5 right-2.5 inline-flex items-center gap-1 rounded bg-emerald-500/90 px-2 py-0.5 font-mono text-[10px] font-bold text-[#08090f]"
                      title={`Awakening ${ch.awakening} (${copyBreakdown})`}
                    >
                      <CheckCircle2 className="h-2.5 w-2.5" />
                      A{ch.awakening}
                    </span>
                  ) : (
                    <span className="absolute top-2.5 right-2.5 rounded bg-black/70 px-2 py-0.5 font-mono text-[9px] font-semibold uppercase text-slate-400">
                      Unowned
                    </span>
                  )}

                  {/* Bottom Nameplate */}
                  <div className="absolute inset-x-0 bottom-0 p-3">
                    <div className="truncate font-display text-base font-bold uppercase tracking-wide text-white drop-shadow">
                      {ch.name}
                    </div>
                    <div className="mt-0.5 flex items-center justify-between font-mono text-[10px] text-slate-400">
                      <span>{isS ? 'S-Class' : 'A-Class'}</span>
                      <span title={copyBreakdown}>
                        {ch.owned ? (
                          <>
                            <span className="text-slate-200">×{ch.copies}</span>
                            {ch.manual > 0 && (
                              <span className="ml-1 text-[#2ee6ff]">(+{ch.manual})</span>
                            )}
                          </>
                        ) : (
                          '0 copies'
                        )}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Manual Initial Unlock / Awakening Control Bar */}
                {onAdjustManualCharacter && (
                  <div className="flex items-center justify-between border-t border-white/8 bg-[#0b0d15] px-2.5 py-2">
                    <span
                      className="font-mono text-[10px] uppercase tracking-wider text-slate-400"
                      title={copyBreakdown}
                    >
                      {ch.owned ? `Awakening ${ch.awakening}` : 'Add Unlock'}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => onAdjustManualCharacter(ch.id, -1)}
                        disabled={ch.manual <= 0}
                        title={
                          ch.manual > 0
                            ? 'Remove 1 manual copy/unlock'
                            : 'No manual copies to remove (pulled copies come from your pull history)'
                        }
                        className="flex h-6 w-6 items-center justify-center rounded border border-white/10 bg-white/[0.04] text-slate-300 transition hover:border-rose-400/50 hover:bg-rose-500/15 hover:text-rose-200 disabled:cursor-not-allowed disabled:opacity-30"
                        aria-label={`Decrease manual Awakening for ${ch.name}`}
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onAdjustManualCharacter(ch.id, 1)}
                        disabled={ch.manual >= 7}
                        title={
                          ch.owned
                            ? `Add +1 manual Awakening / Mind Shard for ${ch.name}`
                            : `Manually unlock ${ch.name} (A0) — e.g. from Character Selector`
                        }
                        className="flex h-6 w-6 items-center justify-center rounded border border-[#f5c451]/35 bg-[#f5c451]/14 text-[#fde68a] transition hover:bg-[#f5c451]/28 disabled:cursor-not-allowed disabled:opacity-30"
                        aria-label={`Add manual unlock or Awakening for ${ch.name}`}
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
