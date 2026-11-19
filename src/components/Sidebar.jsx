import React from 'react';
import {
  LayoutDashboard,
  Download,
  History,
  Settings,
  Dices,
  Menu,
  X,
  UserCircle2,
  Cloud,
  CloudOff,
  RefreshCw,
  CheckCircle2,
} from 'lucide-react';
import Link from './Link.jsx';

const NAV_ITEMS = [
  { href: '/', label: 'Pull Counter', icon: LayoutDashboard },
  { href: '/import', label: 'Zero-Install Import', icon: Download, badge: 'pktmon' },
  { href: '/history', label: 'Pull History', icon: History },
  { href: '/settings', label: 'Profiles & Sync', icon: Settings },
];

export default function Sidebar({
  pathname,
  profiles,
  activeProfileId,
  onSwitchProfile,
  totalPulls,
  driveSync,
  onDriveSyncNow,
  mobileOpen,
  onToggleMobile,
}) {
  const profileList = Object.values(profiles || {});

  function closeMobileIfOpen() {
    if (mobileOpen) onToggleMobile();
  }

  const content = (
    <div className="flex h-full flex-col justify-between bg-[#101423]/95 border-r border-white/8 px-4 py-5 backdrop-blur-xl">
      <div>
        {/* Brand */}
        <div className="flex items-center justify-between px-2 pb-6">
          <Link
            href="/"
            onClick={closeMobileIfOpen}
            className="flex items-center gap-3 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 via-fuchsia-500 to-cyan-400 shadow-lg shadow-violet-500/25">
              <Dices className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="font-display text-lg font-bold tracking-tight text-white">
                Hethereau
              </div>
              <div className="text-[11px] font-medium text-slate-400">
                NTE Pull Tracker
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

        {/* Profile Selector */}
        <div className="mb-5 rounded-xl border border-white/8 bg-[#161c30]/80 p-3">
          <label className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            <UserCircle2 className="h-3.5 w-3.5 text-violet-400" />
            Active Profile
          </label>
          <select
            value={activeProfileId}
            onChange={(e) => onSwitchProfile(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-[#0d111d] px-2.5 py-1.5 text-sm font-medium text-slate-100 outline-none focus:border-violet-400/70"
          >
            {profileList.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.region || 'Global'})
              </option>
            ))}
          </select>
          <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
            <span>Total tracked</span>
            <span className="font-mono font-semibold text-slate-200 tabular-nums">
              {totalPulls.toLocaleString()} pulls
            </span>
          </div>
        </div>

        {/* Real <a> Navigation Links */}
        <nav className="space-y-1">
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
                className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                  active
                    ? 'bg-violet-500/20 text-white shadow-inner shadow-violet-500/10 ring-1 ring-violet-400/30'
                    : 'text-slate-400 hover:bg-white/5 hover:text-slate-100'
                }`}
              >
                <span className="flex items-center gap-3">
                  <Icon className={`h-4 w-4 ${active ? 'text-violet-300' : 'text-slate-500'}`} />
                  {item.label}
                </span>
                {item.badge && (
                  <span className="rounded-md bg-cyan-500/15 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-cyan-300 ring-1 ring-cyan-400/25">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Google Drive Sync Status Card */}
      <div className="space-y-2.5">
        {driveSync?.signedIn ? (
          <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/8 p-3 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 font-semibold text-emerald-300">
                {driveSync.syncing ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                )}
                {driveSync.syncing ? 'Syncing Drive...' : 'Drive Synced'}
              </span>
              <button
                type="button"
                onClick={onDriveSyncNow}
                disabled={driveSync.syncing}
                className="rounded-md bg-white/8 px-2 py-0.5 text-[10px] font-semibold text-slate-200 hover:bg-white/15 disabled:opacity-40"
              >
                Sync
              </button>
            </div>
            {driveSync.email && (
              <div className="mt-1 truncate text-[11px] text-slate-300" title={driveSync.email}>
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
        ) : (
          <Link
            href="/settings"
            onClick={closeMobileIfOpen}
            className="block w-full rounded-xl border border-white/10 bg-[#151b2f]/90 p-3 text-left text-xs transition hover:border-violet-400/40 hover:bg-violet-500/10"
          >
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 font-semibold text-slate-200">
                <Cloud className="h-3.5 w-3.5 text-cyan-400" />
                Google Drive Sync
              </span>
              <span className="inline-flex items-center gap-1 rounded bg-white/8 px-1.5 py-0.5 text-[10px] text-slate-400">
                <CloudOff className="h-2.5 w-2.5" />
                Off
              </span>
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
              Connect Drive AppData to auto-sync pulls across devices.
            </p>
          </Link>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Header */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-white/8 bg-[#0e1220]/90 px-4 py-3 backdrop-blur-lg lg:hidden">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-cyan-400">
            <Dices className="h-4 w-4 text-white" />
          </div>
          <span className="font-display text-base font-bold text-white">
            Hethereau
          </span>
        </Link>
        <button
          type="button"
          onClick={onToggleMobile}
          className="rounded-lg border border-white/10 p-2 text-slate-300 hover:bg-white/5"
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
            className="fixed inset-0 bg-black/70 backdrop-blur-xs"
            onClick={onToggleMobile}
          />
          <div className="relative z-10 w-72 max-w-[85vw]">{content}</div>
        </div>
      )}
    </>
  );
}
