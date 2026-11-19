import React, { useEffect, useMemo, useState } from 'react';
import {
  Calendar,
  Clock,
  Sparkles,
  ExternalLink,
  Newspaper,
  Gift,
  Dices,
  Flame,
  ChevronRight,
} from 'lucide-react';
import {
  BANNER_FEATURED_META,
  OFFICIAL_TIMELINE_EVENTS,
  getBannerSplash,
  getCharacterPoster,
} from '../lib/officialMedia.js';
import { fetchOfficialFeed } from '../lib/statsApi.js';
import ItemAvatar from '../components/ItemAvatar.jsx';

function formatCountdown(targetMs, nowMs) {
  const diff = Math.max(0, targetMs - nowMs);
  if (diff <= 0) return 'Ended';
  const totalSec = Math.floor(diff / 1000);
  const d = Math.floor(totalSec / 86400);
  const h = Math.floor((totalSec % 86400) / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (d > 0) return `${d}d ${h}h ${m}m`;
  return `${h}h ${m}m ${s}s`;
}

function parseOccMs(tsStr) {
  if (!tsStr) return null;
  const iso = String(tsStr).replace(' ', 'T') + '+08:00';
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : null;
}

function formatShortDate(ms) {
  if (!ms) return '—';
  return new Date(ms).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function PosterImg({ src, fallback, alt, className }) {
  const [url, setUrl] = useState(src);
  useEffect(() => {
    setUrl(src);
  }, [src]);
  return (
    <img
      src={url}
      alt={alt}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => {
        if (fallback && url !== fallback) setUrl(fallback);
      }}
      className={className}
    />
  );
}

const CATEGORY_LABELS = {
  banner: 'Limited Board',
  arc: 'Arc Research',
  mystery_box: 'Mystery Box',
  event: 'In-Game Event',
  login: 'Login Event',
  shop: 'Shop Offer',
  community: 'Community',
};

function mergeTimelineEvents(curated, autoEvents, patchVersion) {
  const verNum = Number.parseFloat(patchVersion);
  const autoList = Array.isArray(autoEvents) ? autoEvents : [];

  // When Perfect World publishes a newer patch (e.g. V1.6+), automatically roll the calendar forward
  if (Number.isFinite(verNum) && verNum > 1.5 && autoList.length > 0) {
    return [...autoList].sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
  }

  const result = [...curated];
  const existingKeys = curated.map((e) => e.title.toLowerCase());
  for (const auto of autoList) {
    const low = String(auto.title || '').toLowerCase();
    // Skip duplicates already represented by a richer curated card
    const alreadyCovered = existingKeys.some((k) => {
      if (k === low) return true;
      for (const kw of [
        'elyms',
        'shinku',
        'exe',
        'chaos',
        'offline equations',
        'forsaken path',
        'open roads ahead',
        'circle gifts',
        'city logistics',
        "hunter's crucible",
        'y2k mystique',
      ]) {
        if (k.includes(kw) && low.includes(kw)) return true;
      }
      return false;
    });
    if (!alreadyCovered) {
      result.push(auto);
    }
  }
  return result.sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
}

export default function TimelinePage({ catalog }) {
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [archiveFilter, setArchiveFilter] = useState('all'); // 'all' | 'active' | 'upcoming' | 'past'
  const [selectedEvent, setSelectedEvent] = useState(OFFICIAL_TIMELINE_EVENTS[0]);
  const [officialFeed, setOfficialFeed] = useState(null);

  // Ticking 1s countdown clock for live & upcoming banners
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Load live official news & promotional banners via Cloudflare Worker proxy
  useEffect(() => {
    let mounted = true;
    fetchOfficialFeed()
      .then((res) => {
        if (mounted) setOfficialFeed(res);
      })
      .catch(() => {
        // Non-blocking — calendar & schedule still work offline
      });
    return () => {
      mounted = false;
    };
  }, []);

  // Build structured archive from catalog.occurrences with Debut / Rerun numbering
  const bannerArchive = useMemo(() => {
    const raw = (catalog?.occurrences || []).filter(
      (o) => o.source_id && o.source_id !== 'Lottery_Permanent' && o.active_from
    );
    const seenCounts = {};
    const list = raw.map((o) => {
      seenCounts[o.source_id] = (seenCounts[o.source_id] || 0) + 1;
      const runNumber = seenCounts[o.source_id];
      const meta = BANNER_FEATURED_META[o.source_id] || {};
      const startMs = parseOccMs(o.active_from);
      const endMs = parseOccMs(o.active_until);
      let status = 'past';
      if (startMs && endMs) {
        if (nowMs >= startMs && nowMs <= endMs) status = 'active';
        else if (nowMs < startMs) status = 'upcoming';
      }
      return {
        ...o,
        runNumber,
        status,
        startMs,
        endMs,
        title:
          catalog?.en?.banner_sources?.[o.source_id]?.title ||
          meta.title ||
          o.source_id,
        charId: meta.charId || null,
        charName: meta.charName || '',
        arcBanner: meta.arcBanner || '',
        accent: meta.accent || '#f5c451',
        rateUpA: meta.rateUpA || [],
        cosmetics: meta.cosmetics || [],
      };
    });
    return list.reverse();
  }, [catalog, nowMs]);

  const activeBanners = useMemo(
    () => bannerArchive.filter((b) => b.status === 'active'),
    [bannerArchive]
  );
  const upcomingBanners = useMemo(
    () => bannerArchive.filter((b) => b.status === 'upcoming'),
    [bannerArchive]
  );

  const filteredArchive = useMemo(() => {
    if (archiveFilter === 'all') return bannerArchive;
    return bannerArchive.filter((b) => b.status === archiveFilter);
  }, [bannerArchive, archiveFilter]);

  const livePosters = officialFeed?.officialPosters || null;
  const activePatchVersion = officialFeed?.patchNotes?.version || '1.5';
  const activePatchTitle =
    officialFeed?.patchNotes?.title || 'Version 1.5 [Once Upon a Glitched Call] Patch Notes';
  const activePatchUrl =
    officialFeed?.patchNotes?.url ||
    'https://nte.perfectworld.com/en/article/news/gamenews/20261109/264948.html';

  // Merge curated baseline events with live auto-parsed events from nte.perfectworld.com Patch Notes
  const timelineEvents = useMemo(
    () =>
      mergeTimelineEvents(
        OFFICIAL_TIMELINE_EVENTS,
        officialFeed?.autoEvents || [],
        officialFeed?.patchNotes?.version
      ),
    [officialFeed]
  );

  // If a newer game patch (e.g. V1.6+) arrives before static banner occurrences are updated,
  // auto-populate hero cards from the official Patch Notes banner entries so the section never goes blank.
  const heroBanners = useMemo(() => {
    const known = [...activeBanners, ...upcomingBanners];
    if (known.length > 0) return known;
    return timelineEvents
      .filter((ev) => ev.category === 'banner')
      .map((ev) => {
        const startMs = Date.parse(ev.start);
        const endMs = Date.parse(ev.end);
        const status = nowMs >= startMs && nowMs <= endMs ? 'active' : 'upcoming';
        return {
          occurrence_id: ev.id,
          source_id: ev.sourceId || ev.id,
          version: activePatchVersion,
          runNumber: /rerun/i.test(ev.title) ? 2 : 1,
          status,
          startMs,
          endMs,
          title: ev.title,
          charId: ev.charId || null,
          charName: ev.subtitle || 'Featured Limited S-Class',
          arcBanner: '',
          accent: ev.color || '#f5c451',
          rateUpA: [],
          cosmetics: ['Auto-synced from Official Patch Notes'],
        };
      })
      .filter((b) => Number.isFinite(b.endMs) && nowMs <= b.endMs);
  }, [activeBanners, upcomingBanners, timelineEvents, nowMs, activePatchVersion]);

  const activeSelectedEvent = useMemo(
    () => timelineEvents.find((e) => e.id === selectedEvent?.id) || timelineEvents[0] || null,
    [timelineEvents, selectedEvent]
  );

  // Dynamically span the Gantt calendar across all active/upcoming official events
  const ganttBounds = useMemo(() => {
    const starts = timelineEvents.map((e) => Date.parse(e.start)).filter(Number.isFinite);
    const ends = timelineEvents.map((e) => Date.parse(e.end)).filter(Number.isFinite);
    const minStart = starts.length ? Math.min(...starts) : Date.parse('2026-11-01T00:00:00+08:00');
    const maxEnd = ends.length ? Math.max(...ends) : Date.parse('2026-12-28T00:00:00+08:00');
    // Pad by ~3 days on each side cleanly
    const start = minStart - 3 * 86400 * 1000;
    const end = maxEnd + 4 * 86400 * 1000;
    const span = Math.max(7 * 86400 * 1000, end - start);
    const weeks = [];
    for (let t = start; t < end; t += 7 * 86400 * 1000) {
      weeks.push({
        ms: t,
        pct: ((t - start) / span) * 100,
        label: new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      });
    }
    const nowPct = Math.max(0, Math.min(100, ((nowMs - start) / span) * 100));
    return { start, end, span, weeks, nowPct };
  }, [timelineEvents, nowMs]);

  return (
    <div className="space-y-7">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <div className="mb-1 flex items-center gap-2 font-mono text-[11px] font-semibold tracking-widest uppercase text-[#f5c451]">
            <span className="inline-block h-1.5 w-1.5 rotate-45 bg-[#2ee6ff]" />
            Version {activePatchVersion} // Auto-Synced from Official NTE Channels
          </div>
          <h1 className="font-display text-3xl font-bold tracking-wide uppercase text-white sm:text-4xl">
            Banners &amp; Events Timeline
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Live Scarborough Fair countdowns, official V{activePatchVersion} event calendar, and complete banner history
          </p>
        </div>
        <a
          href={activePatchUrl}
          target="_blank"
          rel="noopener noreferrer"
          title={activePatchTitle}
          className="nte-cut-btn inline-flex items-center gap-2 border border-[#f5c451]/40 bg-[#f5c451]/12 px-4 py-2 font-mono text-xs font-bold uppercase tracking-wider text-[#fde68a] transition hover:bg-[#f5c451]/22"
        >
          <Newspaper className="h-3.5 w-3.5" />
          V{activePatchVersion} Official Patch Notes
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      {/* LIVE NOW & UPCOMING BANNERS HERO GRID */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-display text-lg font-bold uppercase tracking-wide text-white">
            <Flame className="h-4 w-4 text-[#f5c451]" />
            Active &amp; Upcoming Scarborough Fair Boards
          </h2>
          <span className="font-mono text-[11px] text-slate-400">
            Server Schedule: UTC+8
          </span>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {heroBanners.map((b) => {
            const isLive = b.status === 'active';
            const splash = getBannerSplash(b.source_id, livePosters);
            const fallback = b.charId ? `/avatars/${b.charId}.png` : undefined;
            const rateUpAItems = (b.rateUpA || [])
              .map((id) => catalog?.resolveItem(id))
              .filter(Boolean);

            return (
              <div
                key={b.occurrence_id}
                className="nte-panel group relative overflow-hidden rounded-xl border transition hover:border-[#f5c451]/45"
              >
                {/* Top accent bar */}
                <div
                  className="h-[3px] w-full"
                  style={{
                    background: `linear-gradient(90deg, ${b.accent}, rgba(255,255,255,0.12) 75%, transparent)`,
                  }}
                />

                <div className="relative flex min-h-[210px] flex-col justify-between p-5">
                  {/* Right-side official full-art character splash */}
                  <div className="pointer-events-none absolute inset-y-0 right-0 w-[56%] overflow-hidden">
                    <PosterImg
                      src={splash}
                      fallback={fallback}
                      alt={b.charName || b.title}
                      className="h-full w-full object-cover object-top opacity-85 transition duration-500 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-r from-[#0e101a] via-[#0e101a]/70 to-transparent" />
                    <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[#0e101a] to-transparent" />
                  </div>

                  {/* Left content */}
                  <div className="relative z-10 max-w-[66%] space-y-2">
                    <div className="flex flex-wrap items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-wider">
                      {isLive ? (
                        <span className="inline-flex items-center gap-1 rounded bg-emerald-500/20 px-2 py-0.5 text-emerald-300 ring-1 ring-emerald-400/40">
                          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                          LIVE NOW
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded bg-[#a855f7]/20 px-2 py-0.5 text-purple-200 ring-1 ring-purple-400/40">
                          UPCOMING
                        </span>
                      )}
                      <span className="rounded bg-white/10 px-1.5 py-0.5 text-slate-200">
                        V{b.version}
                      </span>
                      <span className="rounded bg-[#f5c451]/16 px-1.5 py-0.5 text-[#fde68a]">
                        {b.runNumber > 1 ? `RERUN #${b.runNumber}` : 'NEW DEBUT'}
                      </span>
                    </div>

                    <div>
                      <h3 className="font-display text-2xl font-bold uppercase tracking-wide text-white drop-shadow">
                        {b.title}
                      </h3>
                      <div className="mt-0.5 flex items-center gap-2 text-xs">
                        <span className="font-semibold text-[#f5c451]">
                          S-Class: {b.charName}
                        </span>
                        {b.arcBanner && (
                          <span className="text-slate-400">· Arc: {b.arcBanner}</span>
                        )}
                      </div>
                    </div>

                    {rateUpAItems.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        <span className="font-mono text-[10px] uppercase text-slate-400">
                          Rate-Up A:
                        </span>
                        {rateUpAItems.map((it) => (
                          <span
                            key={it.id}
                            className="inline-flex items-center gap-1 rounded border border-white/10 bg-[#090b12]/90 pr-2 pl-1 py-0.5 text-[11px] text-slate-200"
                          >
                            <ItemAvatar item={it} size="sm" />
                            {it.name}
                          </span>
                        ))}
                      </div>
                    )}

                    {b.cosmetics?.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-0.5">
                        {b.cosmetics.map((c) => (
                          <span
                            key={c}
                            className="rounded border border-white/8 bg-[#090b12]/80 px-2 py-0.5 font-mono text-[10px] text-slate-300"
                          >
                            {c}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Countdown Footer */}
                  <div className="relative z-10 mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-3 font-mono text-xs">
                    <span className="text-slate-400">
                      {formatShortDate(b.startMs)} &rarr; {formatShortDate(b.endMs)}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1 font-bold tabular-nums ring-1 ${
                        isLive
                          ? 'bg-[#f5c451]/18 text-[#fde68a] ring-[#f5c451]/45'
                          : 'bg-[#2ee6ff]/14 text-[#67e8f9] ring-[#2ee6ff]/40'
                      }`}
                    >
                      <Clock className="h-3.5 w-3.5" />
                      {isLive
                        ? `Ends in ${formatCountdown(b.endMs, nowMs)}`
                        : `Starts in ${formatCountdown(b.startMs, nowMs)}`}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* PAIMON.MOE-STYLE GANTT EVENT CALENDAR */}
      <div className="nte-panel overflow-hidden rounded-xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-[#2ee6ff]" />
              <h2 className="font-display text-lg font-bold uppercase tracking-wide text-white">
                Version {activePatchVersion} Event Timeline
              </h2>
            </div>
            <p className="mt-0.5 text-xs text-slate-400">
              Click any event bar for countdown &amp; reward details · Vertical gold line marks current time
            </p>
          </div>
          <div className="flex flex-wrap gap-2 font-mono text-[10px] uppercase">
            <span className="flex items-center gap-1 text-[#f5c451]">
              <span className="h-2 w-2 rounded-xs bg-[#f5c451]" /> Banners
            </span>
            <span className="flex items-center gap-1 text-[#ec4899]">
              <span className="h-2 w-2 rounded-xs bg-[#ec4899]" /> Mystery Box
            </span>
            <span className="flex items-center gap-1 text-[#2ee6ff]">
              <span className="h-2 w-2 rounded-xs bg-[#2ee6ff]" /> Events
            </span>
            <span className="flex items-center gap-1 text-emerald-300">
              <span className="h-2 w-2 rounded-xs bg-emerald-400" /> Login
            </span>
          </div>
        </div>

        {/* Timeline Grid */}
        <div className="mt-5 overflow-x-auto pb-2">
          <div className="min-w-[680px]">
            {/* Week Header Axis */}
            <div className="relative mb-2 h-7 border-b border-white/10 font-mono text-[10px] text-slate-400">
              {ganttBounds.weeks.map((w) => (
                <div
                  key={w.ms}
                  className="absolute top-0 bottom-0 border-l border-white/8 pl-1.5"
                  style={{ left: `${w.pct}%` }}
                >
                  {w.label}
                </div>
              ))}
            </div>

            {/* Event Bars Container */}
            <div className="relative space-y-2 py-1">
              {/* Vertical NOW indicator */}
              <div
                className="pointer-events-none absolute top-0 bottom-0 z-20 w-[2px] bg-[#f5c451] shadow-[0_0_10px_#f5c451]"
                style={{ left: `${ganttBounds.nowPct}%` }}
              >
                <span className="absolute -top-5 -left-4 rounded bg-[#f5c451] px-1.5 py-0.5 font-mono text-[9px] font-bold text-[#08090f]">
                  NOW
                </span>
              </div>

              {timelineEvents.map((ev) => {
                const sMs = Date.parse(ev.start);
                const eMs = Date.parse(ev.end);
                const leftPct = Math.max(
                  0,
                  ((sMs - ganttBounds.start) / ganttBounds.span) * 100
                );
                const rightPct = Math.min(
                  100,
                  ((eMs - ganttBounds.start) / ganttBounds.span) * 100
                );
                const widthPct = Math.max(4, rightPct - leftPct);
                const isSelected = activeSelectedEvent?.id === ev.id;
                const isLive = nowMs >= sMs && nowMs <= eMs;
                const isUpcoming = nowMs < sMs;

                return (
                  <div key={ev.id} className="relative h-9 rounded bg-white/[0.025]">
                    <button
                      type="button"
                      onClick={() => setSelectedEvent(ev)}
                      style={{
                        left: `${leftPct}%`,
                        width: `${widthPct}%`,
                        backgroundColor: `${ev.color}26`,
                        borderColor: isSelected ? '#ffffff' : `${ev.color}88`,
                      }}
                      className={`absolute top-0.5 bottom-0.5 flex items-center justify-between gap-2 overflow-hidden rounded border px-2.5 text-left transition hover:brightness-125 ${
                        isSelected ? 'ring-1 ring-white/70' : ''
                      }`}
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        {ev.charId && (
                          <img
                            src={`/avatars/${ev.charId}.png`}
                            alt=""
                            className="h-5 w-5 shrink-0 rounded object-cover object-center"
                          />
                        )}
                        <span className="truncate text-xs font-semibold text-white">
                          {ev.title}
                        </span>
                      </span>
                      <span className="hidden shrink-0 font-mono text-[10px] font-bold text-slate-200 sm:inline">
                        {isLive
                          ? formatCountdown(eMs, nowMs)
                          : isUpcoming
                            ? `in ${formatCountdown(sMs, nowMs)}`
                            : 'Ended'}
                      </span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Selected Event Inspector */}
        {activeSelectedEvent && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/10 bg-[#090b12] px-4 py-3">
            <div className="space-y-0.5">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className="rounded px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-[#08090f]"
                  style={{ backgroundColor: activeSelectedEvent.color }}
                >
                  {CATEGORY_LABELS[activeSelectedEvent.category] || activeSelectedEvent.category}
                </span>
                <span className="font-display text-sm font-bold text-white">
                  {activeSelectedEvent.title}
                </span>
              </div>
              <p className="text-xs text-slate-400">{activeSelectedEvent.subtitle}</p>
            </div>
            <div className="flex items-center gap-3 font-mono text-xs">
              <span className="text-slate-400">
                {formatShortDate(Date.parse(activeSelectedEvent.start))} &rarr;{' '}
                {formatShortDate(Date.parse(activeSelectedEvent.end))}
              </span>
              {activeSelectedEvent.url && (
                <a
                  href={activeSelectedEvent.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-semibold text-[#2ee6ff] hover:underline"
                >
                  Details <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          </div>
        )}
      </div>

      {/* LIVE OFFICIAL PROMO BANNERS & NEWS FROM nte.perfectworld.com */}
      {officialFeed && (officialFeed.carousel?.length > 0 || officialFeed.news?.latest?.length > 0) && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Official Promo Carousel Banners */}
          <div className="nte-panel rounded-xl p-5 lg:col-span-2">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-display text-base font-bold uppercase tracking-wide text-white">
                <Gift className="h-4 w-4 text-[#f5c451]" />
                Official Featured Events &amp; Promos
              </h2>
              <span className="font-mono text-[10px] uppercase text-slate-500">
                Live from nte.perfectworld.com
              </span>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {(officialFeed.carousel || []).slice(0, 4).map((slide, idx) => (
                <a
                  key={idx}
                  href={slide.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group relative overflow-hidden rounded-lg border border-white/10 bg-[#090b12] transition hover:border-[#f5c451]/55"
                >
                  <img
                    src={slide.image}
                    alt={slide.title || `NTE Official Event ${idx + 1}`}
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    className="aspect-[16/9] w-full object-cover transition duration-300 group-hover:scale-105"
                  />
                  <div className="absolute right-2 bottom-2 rounded bg-black/75 px-2 py-0.5 font-mono text-[10px] font-bold text-[#f5c451] backdrop-blur-xs">
                    Open &rarr;
                  </div>
                </a>
              ))}
            </div>
          </div>

          {/* Official News & Announcements */}
          <div className="nte-panel rounded-xl p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-display text-base font-bold uppercase tracking-wide text-white">
                <Newspaper className="h-4 w-4 text-[#2ee6ff]" />
                Official News
              </h2>
            </div>
            <div className="space-y-2">
              {[
                ...(officialFeed.news?.gamenews || []).slice(0, 3),
                ...(officialFeed.news?.gameevent || []).slice(0, 3),
              ]
                .sort((a, b) => String(b.time).localeCompare(String(a.time)))
                .slice(0, 6)
                .map((item, idx) => (
                  <a
                    key={idx}
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-start justify-between gap-2 rounded-lg border border-white/8 bg-[#090b12] p-2.5 transition hover:border-[#2ee6ff]/45"
                  >
                    <div className="min-w-0">
                      <div className="line-clamp-2 text-xs font-medium text-slate-200 group-hover:text-white">
                        {item.title}
                      </div>
                      <div className="mt-1 font-mono text-[10px] text-slate-500">
                        {item.time} · {item.channel === 'gameevent' ? 'EVENT' : 'NEWS'}
                      </div>
                    </div>
                    <ChevronRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-500 group-hover:text-[#2ee6ff]" />
                  </a>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* FULL PAST / ACTIVE / UPCOMING BANNER ARCHIVE */}
      <div className="nte-panel rounded-xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Dices className="h-4 w-4 text-[#f5c451]" />
              <h2 className="font-display text-base font-bold uppercase tracking-wide text-white">
                Scarborough Fair Banner Archive (V1.0 – V{activePatchVersion})
              </h2>
            </div>
            <p className="mt-0.5 text-xs text-slate-400">
              Complete history of limited character boards, reruns, and upcoming Phase 2 schedules
            </p>
          </div>

          <div className="flex gap-1 rounded-lg border border-white/10 bg-[#090b12] p-1">
            {['all', 'active', 'upcoming', 'past'].map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setArchiveFilter(tab)}
                className={`rounded px-2.5 py-1 font-mono text-[11px] font-bold uppercase tracking-wider transition ${
                  archiveFilter === tab
                    ? 'bg-[#f5c451]/18 text-[#fde68a] ring-1 ring-[#f5c451]/45'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filteredArchive.map((b) => (
            <div
              key={b.occurrence_id}
              className="group relative overflow-hidden rounded-lg border border-white/10 bg-[#090b12] transition hover:border-white/25"
            >
              <div className="relative h-28 overflow-hidden">
                <PosterImg
                  src={b.charId ? getCharacterPoster(b.charId, livePosters) : getBannerSplash(b.source_id, livePosters)}
                  fallback={b.charId ? `/avatars/${b.charId}.png` : undefined}
                  alt={b.charName || b.title}
                  className="h-full w-full object-cover object-top opacity-75 transition duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#090b12] via-[#090b12]/40 to-transparent" />
                <div className="absolute top-2 left-2 flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase">
                  <span className="rounded bg-black/75 px-1.5 py-0.5 text-slate-200">
                    V{b.version}
                  </span>
                  {b.status === 'active' && (
                    <span className="rounded bg-emerald-500/90 px-1.5 py-0.5 text-[#08090f]">
                      LIVE
                    </span>
                  )}
                  {b.status === 'upcoming' && (
                    <span className="rounded bg-[#a855f7]/90 px-1.5 py-0.5 text-white">
                      UPCOMING
                    </span>
                  )}
                  {b.runNumber > 1 && (
                    <span className="rounded bg-[#f5c451]/90 px-1.5 py-0.5 text-[#08090f]">
                      RERUN #{b.runNumber}
                    </span>
                  )}
                </div>
              </div>
              <div className="p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate font-display text-sm font-bold uppercase text-white">
                      {b.title}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-[#f5c451]">
                      <Sparkles className="h-3 w-3" />
                      {b.charName || b.source_id}
                    </div>
                  </div>
                  {b.charId && (
                    <img
                      src={`/avatars/${b.charId}.png`}
                      alt={b.charName}
                      className="h-9 w-9 shrink-0 rounded-md object-cover object-center ring-1 ring-[#f5c451]/45"
                    />
                  )}
                </div>
                <div className="mt-2 border-t border-white/6 pt-2 font-mono text-[10px] text-slate-400">
                  {formatShortDate(b.startMs)} &rarr; {formatShortDate(b.endMs)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
