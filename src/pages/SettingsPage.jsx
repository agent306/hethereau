import React, { useState } from 'react';
import {
  UserPlus,
  Trash2,
  Download,
  Upload,
  AlertCircle,
  CheckCircle2,
  Cloud,
  RefreshCw,
  LogOut,
} from 'lucide-react';
import { buildBackupJson, parseBackupJson } from '../lib/storage.js';
import { isDriveSyncConfigured } from '../lib/googleDriveSync.js';

export default function SettingsPage({
  appState,
  driveSync,
  onDriveConnect,
  onDriveSyncNow,
  onDriveDisconnect,
  onAddProfile,
  onDeleteProfile,
  onClearActivePulls,
  onRestoreState,
}) {
  const [newName, setNewName] = useState('');
  const [newRegion, setNewRegion] = useState('Global');
  const [feedback, setFeedback] = useState(null);

  const driveReady = isDriveSyncConfigured();
  const profiles = Object.values(appState.profiles);
  const activeProfile = appState.profiles[appState.activeProfileId];

  async function handleConnectDrive() {
    setFeedback(null);
    try {
      await onDriveConnect();
    } catch {
      // Error is displayed inside the Google Drive Sync card via driveSync.error
    }
  }

  function handleCreateProfile(e) {
    e.preventDefault();
    const trimmed = newName.trim();
    if (!trimmed) return;
    onAddProfile(trimmed, newRegion);
    setNewName('');
    setFeedback({ type: 'ok', text: `Created profile "${trimmed}".` });
  }

  function handleDownloadBackup() {
    const json = buildBackupJson(appState);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hethereau-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setFeedback({ type: 'ok', text: 'Full backup JSON downloaded.' });
  }

  function handleRestoreFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const nextState = parseBackupJson(String(reader.result || ''));
        onRestoreState(nextState);
        setFeedback({ type: 'ok', text: 'Backup restored successfully!' });
      } catch (err) {
        setFeedback({ type: 'err', text: err.message });
      }
    };
    reader.readAsText(file);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="border-b border-white/10 pb-5">
        <div className="mb-1 flex items-center gap-2 font-mono text-[11px] font-semibold tracking-widest uppercase text-[#f5c451]">
          <span className="inline-block h-1.5 w-1.5 rotate-45 bg-[#2ee6ff]" />
          Appraiser Config // Cloud &amp; Local Storage
        </div>
        <h1 className="font-display text-3xl font-bold tracking-wide uppercase text-white">
          Profiles &amp; Cloud Sync
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Sync your pulls automatically to Google Drive or manage local backups.
        </p>
      </div>

      {feedback && (
        <div
          className={`flex items-center gap-2 rounded-lg border px-4 py-3 text-sm ${
            feedback.type === 'ok'
              ? 'border-emerald-400/35 bg-emerald-500/12 text-emerald-200'
              : 'border-rose-400/35 bg-rose-500/12 text-rose-200'
          }`}
        >
          {feedback.type === 'ok' ? (
            <CheckCircle2 className="h-4 w-4 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* Google Drive Sync Card */}
      <div className="nte-panel-gold rounded-xl p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#2ee6ff]/35 bg-[#2ee6ff]/12">
              <Cloud className="h-5 w-5 text-[#2ee6ff]" />
            </div>
            <div>
              <h2 className="font-display text-lg font-bold uppercase tracking-wide text-white">
                Google Drive Sync
              </h2>
              <p className="text-xs text-slate-400">
                Auto-saves your pull history to your own private Google Drive app data folder.
              </p>
            </div>
          </div>

          {driveSync.signedIn && (
            <span className="inline-flex items-center gap-1.5 rounded bg-emerald-500/15 px-3 py-1 font-mono text-[11px] font-bold uppercase text-emerald-300 ring-1 ring-emerald-400/35">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Connected
            </span>
          )}
        </div>

        {driveSync.error && (
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-rose-500/35 bg-rose-500/10 px-3.5 py-2.5 text-xs text-rose-200">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
            <span>{driveSync.error}</span>
          </div>
        )}

        {driveSync.signedIn ? (
          <div className="mt-4 space-y-3 rounded-lg border border-white/10 bg-[#090b12]/90 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <div>
                <div className="font-semibold text-white">
                  {driveSync.email || 'Google Account Connected'}
                </div>
                <div className="mt-0.5 text-xs text-slate-400">
                  {driveSync.syncing
                    ? 'Syncing changes to Google Drive...'
                    : driveSync.lastSyncAt
                      ? `Last synced: ${new Date(driveSync.lastSyncAt).toLocaleString()}`
                      : 'Auto-syncs 5 seconds after every import or edit'}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onDriveSyncNow}
                  disabled={driveSync.syncing}
                  className="nte-cut-btn inline-flex items-center gap-1.5 bg-[#f5c451] px-3.5 py-2 font-mono text-xs font-bold uppercase text-[#08090f] transition hover:bg-[#ffd56b] disabled:opacity-50"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${driveSync.syncing ? 'animate-spin' : ''}`} />
                  Sync Now
                </button>
                <button
                  type="button"
                  onClick={onDriveDisconnect}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-white/12 bg-white/[0.04] px-3.5 py-2 font-mono text-xs font-bold uppercase text-slate-300 transition hover:border-rose-400/40 hover:bg-rose-500/15 hover:text-rose-200"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Disconnect
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleConnectDrive}
              disabled={!driveReady || driveSync.syncing}
              className="nte-cut-btn inline-flex items-center gap-2 bg-[#f5c451] px-5 py-2.5 font-display text-sm font-bold uppercase tracking-wider text-[#08090f] shadow-[0_0_24px_rgba(245,196,81,0.26)] transition hover:bg-[#ffd56b] disabled:cursor-not-allowed disabled:opacity-45"
            >
              <Cloud className="h-4 w-4" />
              {driveSync.syncing ? 'Connecting...' : 'Sign in with Google Drive'}
            </button>

            {!driveReady && (
              <span className="text-xs text-slate-400">
                Cloud sync is not enabled on this deployment yet.
              </span>
            )}
          </div>
        )}
      </div>

      {/* Multi-Profile Manager */}
      <div className="nte-panel rounded-xl p-5">
        <h2 className="font-display text-base font-bold uppercase tracking-wide text-white">
          Appraiser Profiles
        </h2>
        <div className="mt-3 space-y-2">
          {profiles.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between rounded-lg border border-white/8 bg-[#090b12] px-4 py-3"
            >
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold text-white">
                  {p.name}
                  <span className="rounded bg-white/8 px-1.5 py-0.5 font-mono text-[10px] font-medium uppercase text-slate-300">
                    {p.region || 'Global'}
                  </span>
                  {p.id === appState.activeProfileId && (
                    <span className="rounded bg-[#f5c451]/18 px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase text-[#fde68a] ring-1 ring-[#f5c451]/40">
                      Active
                    </span>
                  )}
                </div>
                <div className="mt-0.5 font-mono text-xs text-slate-400">
                  {p.records.length} records stored
                </div>
              </div>

              {profiles.length > 1 && (
                <button
                  type="button"
                  onClick={() => onDeleteProfile(p.id)}
                  className="rounded-lg p-2 text-slate-400 hover:bg-rose-500/15 hover:text-rose-300"
                  title="Delete profile"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </div>

        <form onSubmit={handleCreateProfile} className="mt-4 flex flex-wrap gap-2">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="New profile name (e.g. Alt EU)"
            className="min-w-[180px] flex-1 rounded-lg border border-white/10 bg-[#080a10] px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-[#f5c451]/70"
          />
          <select
            value={newRegion}
            onChange={(e) => setNewRegion(e.target.value)}
            className="rounded-lg border border-white/10 bg-[#080a10] px-3 py-2 text-sm text-slate-200 outline-none focus:border-[#f5c451]/70"
          >
            <option value="Global">Global</option>
            <option value="EU">EU</option>
            <option value="NA">NA</option>
            <option value="Asia">Asia</option>
            <option value="CN">CN</option>
          </select>
          <button
            type="submit"
            className="nte-cut-btn inline-flex items-center gap-1.5 bg-[#f5c451] px-4 py-2 font-display text-sm font-bold uppercase tracking-wider text-[#08090f] hover:bg-[#ffd56b]"
          >
            <UserPlus className="h-4 w-4" />
            Add Profile
          </button>
        </form>
      </div>

      {/* Local JSON Backup & Restore */}
      <div className="nte-panel rounded-xl p-5">
        <h2 className="font-display text-base font-bold uppercase tracking-wide text-white">
          Manual JSON Backup &amp; Restore
        </h2>
        <p className="mt-1 text-xs text-slate-400">
          Offline backup of your browser&apos;s IndexedDB data.
        </p>

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleDownloadBackup}
            className="inline-flex items-center gap-2 rounded-lg border border-white/12 bg-white/[0.04] px-4 py-2.5 font-mono text-xs font-bold uppercase tracking-wider text-white transition hover:border-[#2ee6ff]/45 hover:bg-[#2ee6ff]/10"
          >
            <Download className="h-4 w-4 text-[#2ee6ff]" />
            Download Backup JSON
          </button>

          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-white/12 bg-white/[0.04] px-4 py-2.5 font-mono text-xs font-bold uppercase tracking-wider text-white transition hover:border-[#f5c451]/45 hover:bg-[#f5c451]/10">
            <Upload className="h-4 w-4 text-[#f5c451]" />
            Restore Backup JSON
            <input
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={(e) => handleRestoreFile(e.target.files?.[0])}
            />
          </label>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="rounded-xl border border-rose-500/25 bg-rose-500/[0.04] p-5">
        <h2 className="font-display text-base font-bold uppercase tracking-wide text-rose-200">
          Clear Active Profile Pulls
        </h2>
        <p className="mt-1 text-xs text-slate-400">
          Removes all {activeProfile?.records?.length || 0} stored pull records from{' '}
          <strong>{activeProfile?.name}</strong>.
        </p>
        <button
          type="button"
          onClick={() => {
            onClearActivePulls();
            setFeedback({ type: 'ok', text: `Cleared pulls for ${activeProfile?.name}.` });
          }}
          className="mt-3 inline-flex items-center gap-2 rounded-lg border border-rose-500/35 bg-rose-500/15 px-4 py-2 font-mono text-xs font-bold uppercase text-rose-200 transition hover:bg-rose-500/25"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Clear {activeProfile?.name}
        </button>
      </div>
    </div>
  );
}
