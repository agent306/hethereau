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
    } catch (err) {
      setFeedback({ type: 'err', text: err.message });
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
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight text-white">
          Profiles &amp; Cloud Sync
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Sync your pulls automatically to Google Drive or manage local backups.
        </p>
      </div>

      {feedback && (
        <div
          className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-sm ${
            feedback.type === 'ok'
              ? 'border-emerald-400/30 bg-emerald-500/12 text-emerald-200'
              : 'border-rose-400/30 bg-rose-500/12 text-rose-200'
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

      {/* Google Drive Sync Card (1-click Paimon.moe UX -- owner configures VITE_GOOGLE_CLIENT_ID once) */}
      <div className="rounded-2xl border border-violet-500/25 bg-gradient-to-br from-violet-500/10 via-[#121728] to-cyan-500/6 p-5 shadow-xl shadow-black/25">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/20 ring-1 ring-violet-400/35">
              <Cloud className="h-5 w-5 text-cyan-300" />
            </div>
            <div>
              <h2 className="font-display text-lg font-bold text-white">
                Google Drive Sync
              </h2>
              <p className="text-xs text-slate-400">
                Auto-saves your pull history to your own private Google Drive app data folder.
              </p>
            </div>
          </div>

          {driveSync.signedIn && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-300 ring-1 ring-emerald-400/30">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Connected
            </span>
          )}
        </div>

        {driveSync.error && (
          <div className="mt-3 flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3.5 py-2.5 text-xs text-rose-200">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
            <span>{driveSync.error}</span>
          </div>
        )}

        {driveSync.signedIn ? (
          <div className="mt-4 space-y-3 rounded-xl border border-white/10 bg-[#0b0f1c]/90 p-4">
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
                  className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-violet-500 disabled:opacity-50"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${driveSync.syncing ? 'animate-spin' : ''}`} />
                  Sync Now
                </button>
                <button
                  type="button"
                  onClick={onDriveDisconnect}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-white/12 bg-white/5 px-3.5 py-2 text-xs font-semibold text-slate-300 transition hover:bg-rose-500/15 hover:text-rose-200"
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
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-cyan-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-violet-600/25 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45"
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
      <div className="rounded-2xl border border-white/10 bg-[#121728]/90 p-5">
        <h2 className="font-display text-base font-bold text-white">Profiles</h2>
        <div className="mt-3 space-y-2">
          {profiles.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between rounded-xl border border-white/8 bg-[#0b0f1c] px-4 py-3"
            >
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold text-white">
                  {p.name}
                  <span className="rounded bg-white/8 px-1.5 py-0.5 text-[10px] font-medium text-slate-300">
                    {p.region || 'Global'}
                  </span>
                  {p.id === appState.activeProfileId && (
                    <span className="rounded bg-violet-500/25 px-1.5 py-0.5 text-[10px] font-semibold text-violet-200">
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
            className="min-w-[180px] flex-1 rounded-xl border border-white/10 bg-[#0a0e1a] px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-violet-400"
          />
          <select
            value={newRegion}
            onChange={(e) => setNewRegion(e.target.value)}
            className="rounded-xl border border-white/10 bg-[#0a0e1a] px-3 py-2 text-sm text-slate-200 outline-none"
          >
            <option value="Global">Global</option>
            <option value="EU">EU</option>
            <option value="NA">NA</option>
            <option value="Asia">Asia</option>
            <option value="CN">CN</option>
          </select>
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500"
          >
            <UserPlus className="h-4 w-4" />
            Add Profile
          </button>
        </form>
      </div>

      {/* Local JSON Backup & Restore */}
      <div className="rounded-2xl border border-white/10 bg-[#121728]/90 p-5">
        <h2 className="font-display text-base font-bold text-white">
          Manual JSON Backup &amp; Restore
        </h2>
        <p className="mt-1 text-xs text-slate-400">
          Offline backup of your browser&apos;s IndexedDB data.
        </p>

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleDownloadBackup}
            className="inline-flex items-center gap-2 rounded-xl bg-white/8 px-4 py-2.5 text-sm font-semibold text-white ring-1 ring-white/10 transition hover:bg-white/14"
          >
            <Download className="h-4 w-4 text-cyan-300" />
            Download Backup JSON
          </button>

          <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-white/8 px-4 py-2.5 text-sm font-semibold text-white ring-1 ring-white/10 transition hover:bg-white/14">
            <Upload className="h-4 w-4 text-violet-300" />
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
      <div className="rounded-2xl border border-rose-500/20 bg-rose-500/[0.04] p-5">
        <h2 className="font-display text-base font-bold text-rose-200">
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
          className="mt-3 inline-flex items-center gap-2 rounded-xl border border-rose-500/35 bg-rose-500/15 px-4 py-2 text-xs font-semibold text-rose-200 transition hover:bg-rose-500/25"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Clear {activeProfile?.name}
        </button>
      </div>

      <p className="text-center text-xs text-slate-500">
        Hethereau is an unofficial fan tool and is not affiliated with Hotta Studio or Perfect World Games.
      </p>
    </div>
  );
}
