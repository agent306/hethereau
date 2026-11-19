import React from 'react';
import { Cloud, HardDrive, GitMerge, X } from 'lucide-react';
import { countStateRecords } from '../lib/googleDriveSync.js';

export default function SyncConflictModal({
  localState,
  remoteState,
  remoteModifiedTime,
  onChooseMerge,
  onChooseRemote,
  onChooseLocal,
  onClose,
}) {
  const localCount = countStateRecords(localState);
  const remoteCount = countStateRecords(remoteState);
  const localProfiles = Object.keys(localState?.profiles || {}).length;
  const remoteProfiles = Object.keys(remoteState?.profiles || {}).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-white/12 bg-[#121728] p-6 shadow-2xl shadow-black/60">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-bold text-white">
              Sync Conflict Detected
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              Both this browser and your Google Drive have pull data. Choose how to sync:
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-white/5 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-white/10 bg-[#0b0f1c] p-3.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-cyan-300">
              <HardDrive className="h-3.5 w-3.5" />
              This Browser
            </div>
            <div className="mt-2 font-mono text-xl font-bold text-white tabular-nums">
              {localCount.toLocaleString()}
            </div>
            <div className="text-[11px] text-slate-400">
              records across {localProfiles} profile{localProfiles === 1 ? '' : 's'}
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-[#0b0f1c] p-3.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-violet-300">
              <Cloud className="h-3.5 w-3.5" />
              Google Drive
            </div>
            <div className="mt-2 font-mono text-xl font-bold text-white tabular-nums">
              {remoteCount.toLocaleString()}
            </div>
            <div className="text-[11px] text-slate-400">
              {remoteProfiles} profile{remoteProfiles === 1 ? '' : 's'}
              {remoteModifiedTime
                ? ` · ${new Date(remoteModifiedTime).toLocaleDateString()}`
                : ''}
            </div>
          </div>
        </div>

        <div className="mt-5 space-y-2.5">
          <button
            type="button"
            onClick={onChooseMerge}
            className="flex w-full items-center justify-between rounded-xl bg-gradient-to-r from-violet-600 to-cyan-500 px-4 py-3 text-left text-sm font-bold text-white shadow-lg shadow-violet-600/20 transition hover:brightness-110"
          >
            <span className="flex items-center gap-2">
              <GitMerge className="h-4 w-4" />
              Smart Merge Both (Recommended)
            </span>
            <span className="rounded bg-black/25 px-2 py-0.5 text-[11px] font-medium">
              Zero data loss
            </span>
          </button>

          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={onChooseRemote}
              className="rounded-xl border border-white/12 bg-white/5 px-3 py-2.5 text-xs font-semibold text-slate-200 transition hover:bg-white/10"
            >
              Use Google Drive ({remoteCount})
            </button>
            <button
              type="button"
              onClick={onChooseLocal}
              className="rounded-xl border border-white/12 bg-white/5 px-3 py-2.5 text-xs font-semibold text-slate-200 transition hover:bg-white/10"
            >
              Use This Browser ({localCount})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
