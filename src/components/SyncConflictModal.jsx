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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="nte-panel-gold w-full max-w-lg rounded-xl p-6 shadow-2xl shadow-black/70">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-bold uppercase tracking-wide text-white">
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
          <div className="rounded-lg border border-white/10 bg-[#090b12] p-3.5">
            <div className="flex items-center gap-1.5 font-mono text-[11px] font-bold uppercase text-[#2ee6ff]">
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

          <div className="rounded-lg border border-white/10 bg-[#090b12] p-3.5">
            <div className="flex items-center gap-1.5 font-mono text-[11px] font-bold uppercase text-[#f5c451]">
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
            className="nte-cut-btn flex w-full items-center justify-between bg-[#f5c451] px-4 py-3 text-left font-display text-sm font-bold uppercase tracking-wider text-[#08090f] shadow-[0_0_24px_rgba(245,196,81,0.28)] transition hover:bg-[#ffd56b]"
          >
            <span className="flex items-center gap-2">
              <GitMerge className="h-4 w-4" />
              Smart Merge Both (Recommended)
            </span>
            <span className="rounded bg-black/15 px-2 py-0.5 font-mono text-[10px] font-bold">
              ZERO LOSS
            </span>
          </button>

          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={onChooseRemote}
              className="rounded-lg border border-white/12 bg-white/[0.04] px-3 py-2.5 font-mono text-xs font-semibold text-slate-200 transition hover:bg-white/10"
            >
              Use Google Drive ({remoteCount})
            </button>
            <button
              type="button"
              onClick={onChooseLocal}
              className="rounded-lg border border-white/12 bg-white/[0.04] px-3 py-2.5 font-mono text-xs font-semibold text-slate-200 transition hover:bg-white/10"
            >
              Use This Browser ({localCount})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
