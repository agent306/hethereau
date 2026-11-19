import React from 'react';
import {
  LayoutDashboard,
  Download,
  History,
  Calendar,
  Users,
  Globe2,
  Settings,
  ShieldCheck,
  Menu,
  X,
  UserCircle2,
  Cloud,
  CloudOff,
  RefreshCw,
  CheckCircle2,
} from 'lucide-react';
import Link from './Link.jsx';

const STAFF_EMAILS = new Set(['masigning@gmail.com']);

const NAV_ITEMS = [
  { href: '/', code: '01', label: 'Pull Counter', icon: LayoutDashboard },
  { href: '/import', code: '02', label: 'Zero-Install Import', icon: Download, badge: 'PKTMON' },
  { href: '/history', code: '03', label: 'Pull Ledger', icon: History },
  { href: '/timeline', code: '04', label: 'Timeline', icon: Calendar, badge: 'V1.5' },
  { href: '/characters', code: '05', label: 'Characters', icon: Users },
  { href: '/stats', code: '06', label: 'Global Stats', icon: Globe2 },
  { href: '/settings', code: '07', label: 'Profiles & Sync', icon: Settings },
];

export default function Sidebar({
  pathname,
  profiles,
  activeProfileId,
  onSwitchProfile,
  totalPulls,
  driveSync,
  onDriveSyncNow,
  onDriveReconnect,
  mobileOpen,
  onToggleMobile,
}) {
  const profileList = Object.values(profiles || {});

  function closeMobileIfOpen() {
    if (mobileOpen) onToggleMobile();
  }

  const content = (
    <div className="flex h-full flex-col justify-between border-r border-white/10 bg-[#0b0d15]/96 px-4 py-5 backdrop-blur-xl">
      <div>
        {/* Brand Header with Custom Hethereau Solid Die Logo */}
        <div className="flex items-center justify-between border-b border-white/8 px-1 pb-5">
          <Link
            href="/"
            onClick={closeMobileIfOpen}
            className="group flex items-center gap-3 outline-none focus-visible:ring-2 focus-visible:ring-[#f5c451]"
          >
            <div className="relative h-11 w-11 shrink-0 transition group-hover:scale-105">
              <img
                src="/logo.png"
                alt="Hethereau"
                className="h-full w-full object-contain drop-shadow-[0_0_12px_rgba(245,196,81,0.3)]"
              />
            </div>
            <div>
              <div className="font-display text-lg font-bold tracking-wider uppercase text-white">
                Hethereau
              </div>
              <div className="flex items-center gap-1.5 font-mono text-[10px] font-semibold tracking-widest uppercase text-[#f5c451]/85">
                <span className="h-1.5 w-1.5 rotate-45 bg-[#2ee6ff]" />
                NTE Pull Ledger
              </div>
            </div>
          </Link>
          <button
            type="button"
            onClick={onToggleMobile}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-white/5 hover:text-white lg:hidden"
            aria-label="Close navigation"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Eibon Appraiser Profile Badge */}
        <div className="mt-5 mb-5 rounded-lg border border-white/10 bg-[#121522] p-3 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-[#f5c451] via-[#d946ef] to-[#2ee6ff] opacity-70" />
          <label className="mb-1.5 flex items-center justify-between font-mono text-[10px] font-semibold uppercase tracking-widest text-slate-400">
            <span className="flex items-center gap-1.5">
              <UserCircle2 className="h-3.5 w-3.5 text-[#f5c451]" />
              Appraiser ID
            </span>
            <span className="text-[#2ee6ff]">ACTIVE</span>
          </label>
          <select
            value={activeProfileId}
            onChange={(e) => onSwitchProfile(e.target.value)}
            className="w-full rounded-md border border-white/12 bg-[#090b12] px-2.5 py-1.5 text-sm font-medium text-slate-100 outline-none focus:border-[#f5c451]/70"
          >
            {profileList.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.region || 'Global'})
              </option>
            ))}
          </select>
          <div className="mt-2.5 flex items-center justify-between border-t border-white/6 pt-2 text-xs text-slate-400">
            <span className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
              Logged Pulls
            </span>
            <span className="font-mono font-bold text-[#f5c451] tabular-nums">
              {totalPulls.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Navigation Terminal Rail */}
        <nav className="space-y-1.5">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active =
              item.href === '/'
                ? pathname === '/' || pathname === ''
                : pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={closeMobileIfOpen}
                className={`group relative flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                  active
                    ? 'bg-gradient-to-r from-[#f5c451]/16 via-[#f5c451]/6 to-transparent text-white ring-1 ring-[#f5c451]/35'
                    : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-100'
                }`}
              >
                {active && (
                  <span className="absolute top-1.5 bottom-1.5 left-0 w-[3px] rounded-r bg-[#f5c451] shadow-[0_0_10px_#f5c451]" />
                )}
                <span className="flex items-center gap-2.5">
                  <span
                    className={`font-mono text-[10px] font-bold ${
                      active ? 'text-[#f5c451]' : 'text-slate-600 group-hover:text-slate-400'
                    }`}
                  >
                    {item.code}
                  </span>
                  <Icon
                    className={`h-4 w-4 ${
                      active ? 'text-[#f5c451]' : 'text-slate-500 group-hover:text-slate-300'
                    }`}
                  />
                  <span className="font-display tracking-wide">{item.label}</span>
                </span>
                {item.badge && (
                  <span className="nte-cut-chip bg-[#2ee6ff]/15 px-1.5 py-0.5 font-mono text-[9px] font-bold tracking-wider text-[#2ee6ff] ring-1 ring-[#2ee6ff]/30">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Google Drive Sync Module */}
      <div className="space-y-2.5 pt-4">
        {driveSync?.signedIn &&
          STAFF_EMAILS.has(String(driveSync.email || '').toLowerCase()) && (
            <Link
              href="/staff"
              onClick={closeMobileIfOpen}
              className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 font-mono text-[11px] font-bold uppercase tracking-wider transition ${
                pathname === '/staff'
                  ? 'border-emerald-400/50 bg-emerald-500/16 text-emerald-200'
                  : 'border-white/10 bg-[#121522] text-emerald-300/90 hover:border-emerald-400/40 hover:bg-emerald-500/10'
              }`}
            >
              <span className="flex items-center gap-2">
                <ShieldCheck className="h-3.5 w-3.5" />
                Staff Telemetry
              </span>
              <span className="text-[9px] text-emerald-400/80">OPS</span>
            </Link>
          )}
        {driveSync?.signedIn ? (
          <div className="rounded-lg border border-emerald-400/30 bg-emerald-500/[0.07] p-3 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 font-display text-xs font-bold uppercase tracking-wide text-emerald-300">
                {driveSync.syncing ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                )}
                {driveSync.syncing ? 'Syncing Drive' : 'Drive Linked'}
              </span>
              <button
                type="button"
                onClick={onDriveSyncNow}
                disabled={driveSync.syncing}
                className="rounded bg-white/10 px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-slate-200 hover:bg-white/20 disabled:opacity-40"
              >
                Sync
              </button>
            </div>
            {driveSync.email && (
              <div className="mt-1 truncate font-mono text-[11px] text-slate-300" title={driveSync.email}>
                {driveSync.email}
              </div>
            )}
            <div className="mt-0.5 text-[10px] text-slate-400">
              {driveSync.lastSyncAt
                ? `Last synced ${new Date(driveSync.lastSyncAt).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}`
                : 'Auto-syncs every 5s'}
            </div>
          </div>
        ) : driveSync?.needsReconnect ? (
          <div className="rounded-lg border border-[#f5c451]/35 bg-[#f5c451]/[0.07] p-3 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 font-display text-xs font-bold uppercase tracking-wide text-[#fde68a]">
                <Cloud className="h-3.5 w-3.5 text-[#f5c451]" />
                Drive Paused
              </span>
              <button
                type="button"
                onClick={onDriveReconnect}
                disabled={driveSync.syncing}
                className="rounded bg-[#f5c451] px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-[#08090f] hover:bg-[#ffd56b] disabled:opacity-40"
              >
                {driveSync.syncing ? '...' : 'Resume'}
              </button>
            </div>
            {driveSync.email && (
              <div className="mt-1 truncate font-mono text-[11px] text-slate-300" title={driveSync.email}>
                {driveSync.email}
              </div>
            )}
            <div className="mt-0.5 text-[10px] text-slate-400">
              Token expired — click Resume to sync.
            </div>
          </div>
        ) : (
          <Link
            href="/settings"
            onClick={closeMobileIfOpen}
            className="block w-full rounded-lg border border-white/10 bg-[#121522] p-3 text-left text-xs transition hover:border-[#f5c451]/45 hover:bg-[#171a2b]"
          >
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 font-display font-bold uppercase tracking-wide text-slate-200">
                <Cloud className="h-3.5 w-3.5 text-[#2ee6ff]" />
                Drive Sync
              </span>
              <span className="inline-flex items-center gap-1 rounded bg-white/8 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase text-slate-400">
                <CloudOff className="h-2.5 w-2.5" />
                OFF
              </span>
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
              Back up pulls privately to your Google Drive AppData folder.
            </p>
          </Link>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Header */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-white/10 bg-[#0b0d15]/95 px-4 py-3 backdrop-blur-lg lg:hidden">
        <Link href="/" className="flex items-center gap-2.5">
          <img
            src="/logo.png"
            alt="Hethereau"
            className="h-8 w-8 object-contain drop-shadow-[0_0_8px_rgba(245,196,81,0.3)]"
          />
          <div>
            <span className="font-display text-base font-bold tracking-wider uppercase text-white">
              Hethereau
            </span>
          </div>
        </Link>
        <button
          type="button"
          onClick={onToggleMobile}
          className="rounded-lg border border-white/12 bg-white/5 p-2 text-slate-300 hover:bg-white/10"
          aria-label="Open navigation"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      {/* Desktop Fixed Rail */}
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 lg:block">{content}</aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 flex lg:hidden">
          <div
            className="fixed inset-0 bg-black/75 backdrop-blur-xs"
            onClick={onToggleMobile}
          />
          <div className="relative z-10 w-72 max-w-[85vw]">{content}</div>
        </div>
      )}
    </>
  );
}
