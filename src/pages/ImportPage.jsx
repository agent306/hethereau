import React, { useMemo, useState } from 'react';
import {
  Terminal,
  Copy,
  Check,
  Upload,
  FileJson,
  ShieldCheck,
  AlertTriangle,
  PlusCircle,
  Download,
  CheckCircle2,
} from 'lucide-react';
import { normalizeExternalJson } from '../lib/formats.js';
import { mergePullRecords } from '../lib/pityEngine.js';
import { POOL_DEFINITIONS, POOL_ORDER } from '../lib/catalog.js';
import { navigate } from '../lib/router.js';

const PROD_ORIGIN = 'https://hethereau.pages.dev';

export default function ImportPage({
  existingRecords,
  catalog,
  onCommitImport,
}) {
  const [mode, setMode] = useState('pktmon'); // 'pktmon' | 'manual'
  const [noFilter, setNoFilter] = useState(false);
  const [autoPage, setAutoPage] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [statusMsg, setStatusMsg] = useState(null);

  const [manualPool, setManualPool] = useState('monopoly_limited');
  const [manualItemId, setManualItemId] = useState('1010');
  const [manualRoll, setManualRoll] = useState('4');
  const [manualTime, setManualTime] = useState(() =>
    new Date().toISOString().slice(0, 16)
  );

  // Always point to the live origin (or production hethereau.pages.dev if SSR/localhost fallback)
  const origin =
    typeof window !== 'undefined' &&
    window.location.origin &&
    !window.location.hostname.includes('127.0.0.1') &&
    !window.location.hostname.includes('localhost')
      ? window.location.origin
      : PROD_ORIGIN;
  const scriptUrl = `${origin}/import-nte.ps1`;
  const extraFlags = [
    autoPage ? '-AutoPage' : '',
    noFilter ? '-NoFilter' : '',
  ]
    .filter(Boolean)
    .join(' ');
  const psCommand = `& ([scriptblock]::Create((irm '${scriptUrl}'))) -SourceUrl '${scriptUrl}'${
    extraFlags ? ' ' + extraFlags : ''
  }`;

  const preview = useMemo(() => {
    if (!pasteText.trim()) return null;
    try {
      const normalized = normalizeExternalJson(pasteText);
      const mergePreview = mergePullRecords(existingRecords, normalized.records);
      const byPool = {};
      for (const r of normalized.records) {
        byPool[r.poolKey] = (byPool[r.poolKey] || 0) + 1;
      }
      return {
        ok: true,
        format: normalized.format,
        total: normalized.records.length,
        added: mergePreview.added,
        duplicates: mergePreview.duplicates,
        records: normalized.records,
        byPool,
      };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }, [pasteText, existingRecords]);

  const selectableItems = useMemo(
    () => (catalog ? catalog.listSelectableItems() : []),
    [catalog]
  );

  function handleCopyCommand() {
    navigator.clipboard?.writeText(psCommand);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleFileRead(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setPasteText(String(reader.result || ''));
      setStatusMsg(null);
    };
    reader.readAsText(file);
  }

  function handleCommit() {
    if (!preview || !preview.ok) return;
    const res = onCommitImport(preview.records);
    setPasteText('');
    setStatusMsg({
      type: 'success',
      text: `Imported ${res.added} new records (${res.duplicates} already tracked).`,
    });
    navigate('/');
  }

  function handleAddManual(e) {
    e.preventDefault();
    const poolMap = {
      monopoly_limited: { pool_id: 'CardPool_Character', record_type: 'monopoly' },
      monopoly_standard: { pool_id: 'CardPool_NewRole', record_type: 'monopoly' },
      fork_lottery: { pool_id: 'Arc_MiracleBox', record_type: 'fork' },
      mystery_box: { pool_id: 'Gashapon_MysteryBox', record_type: 'mystery_box' },
    };
    const meta = poolMap[manualPool];
    const cleanTime = manualTime.replace('T', ' ') + ':00';
    const item = catalog?.resolveItem(manualItemId);
    const rec = {
      id: `manual_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      sourceOrder: 0,
      record_type: meta.record_type,
      time: cleanTime,
      pool_id: meta.pool_id,
      poolKey: manualPool,
      lottery_id: manualPool === 'monopoly_standard' ? 'Lottery_Permanent' : null,
      item_id: manualItemId,
      item_name_hint: item?.name || manualItemId,
      rarity_hint: item?.rarity ?? 3,
      count: 1,
      roll_points:
        meta.record_type === 'monopoly' && Number(manualRoll) > 0
          ? Number(manualRoll)
          : null,
      roll_label:
        meta.record_type === 'monopoly' && Number(manualRoll) > 0
          ? String(manualRoll)
          : null,
      isBonus: false,
      source: 'manual',
    };
    onCommitImport([rec]);
    setStatusMsg({
      type: 'success',
      text: `Logged 1 pull: ${item?.name || manualItemId} on ${POOL_DEFINITIONS[manualPool].title}.`,
    });
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-white">
            Zero-Install PC Import
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Uses built-in Windows{' '}
            <code className="rounded bg-white/10 px-1.5 py-0.5 text-xs text-cyan-200">
              pktmon.exe
            </code>{' '}
            — no drivers, no .exe downloads, no memory injection.
          </p>
        </div>

        <div className="flex gap-1 rounded-xl bg-[#121728] p-1 ring-1 ring-white/10">
          <button
            type="button"
            onClick={() => setMode('pktmon')}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              mode === 'pktmon'
                ? 'bg-violet-500/25 text-white ring-1 ring-violet-400/35'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            PC Zero-Install (pktmon)
          </button>
          <button
            type="button"
            onClick={() => setMode('manual')}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              mode === 'manual'
                ? 'bg-violet-500/25 text-white ring-1 ring-violet-400/35'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Manual Entry
          </button>
        </div>
      </div>

      {statusMsg && (
        <div className="flex items-center gap-2.5 rounded-xl border border-emerald-400/30 bg-emerald-500/12 px-4 py-3 text-sm text-emerald-200">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-300" />
          <span>{statusMsg.text}</span>
        </div>
      )}

      {mode === 'pktmon' ? (
        <div className="space-y-5">
          {/* Step 1: One-liner PowerShell Box */}
          <div className="rounded-2xl border border-white/10 bg-[#121728]/90 p-5 shadow-xl shadow-black/25">
            <div className="flex items-center gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-500/25 font-mono text-xs font-bold text-violet-200 ring-1 ring-violet-400/40">
                1
              </span>
              <div>
                <h2 className="font-display text-base font-bold text-white">
                  Run the Zero-Install Script in Windows PowerShell
                </h2>
                <p className="text-xs text-slate-400">
                  Open Start → search <strong>Windows PowerShell</strong> → paste &amp; press Enter (accept the Admin prompt for built-in{' '}
                  <code>pktmon.exe</code>).
                </p>
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <div className="flex flex-1 items-center gap-2.5 overflow-x-auto rounded-xl border border-white/10 bg-[#090d18] px-3.5 py-3 font-mono text-xs text-cyan-200">
                <Terminal className="h-4 w-4 shrink-0 text-violet-400" />
                <code className="whitespace-nowrap">{psCommand}</code>
              </div>
              <button
                type="button"
                onClick={handleCopyCommand}
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-violet-500"
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? 'Copied!' : 'Copy Command'}
              </button>
            </div>

            <div className="mt-3 flex flex-wrap items-start justify-between gap-3 text-xs text-slate-400">
              <div className="space-y-1.5">
                <label className="flex cursor-pointer items-center gap-2 select-none">
                  <input
                    type="checkbox"
                    checked={autoPage}
                    onChange={(e) => setAutoPage(e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-white/20 bg-[#0b0e17] accent-amber-500"
                  />
                  <span>
                    Use <code className="text-amber-200">-AutoPage</code> (hover{' '}
                    <strong className="text-slate-200">Next &gt;</strong>, press{' '}
                    <kbd className="rounded bg-white/10 px-1 font-mono text-[10px] text-slate-200">F8</kbd>{' '}
                    to flip,{' '}
                    <kbd className="rounded bg-white/10 px-1 font-mono text-[10px] text-slate-200">F9</kbd>{' '}
                    to decode; opt-in macro)
                  </span>
                </label>

                <label className="flex cursor-pointer items-center gap-2 select-none">
                  <input
                    type="checkbox"
                    checked={noFilter}
                    onChange={(e) => setNoFilter(e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-white/20 bg-[#0b0e17] accent-violet-500"
                  />
                  <span>
                    Use <code className="text-slate-300">-NoFilter</code> (enable if on VPN / PPPoE and getting 0 records)
                  </span>
                </label>
              </div>

              <a
                href="/import-nte.ps1"
                download="import-nte.ps1"
                className="inline-flex items-center gap-1.5 font-medium text-cyan-300 hover:text-cyan-200"
              >
                <Download className="h-3.5 w-3.5" />
                Inspect / Download import-nte.ps1
              </a>
            </div>
          </div>

          {/* Step 2: In-Game Action */}
          <div className="rounded-2xl border border-white/10 bg-[#121728]/90 p-5">
            <div className="flex items-center gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-500/25 font-mono text-xs font-bold text-violet-200 ring-1 ring-violet-400/40">
                2
              </span>
              <h2 className="font-display text-base font-bold text-white">
                Flip Through In-Game Pull History, Then Decode
              </h2>
            </div>
            <ol className="mt-3 ml-10 list-decimal space-y-1.5 text-sm text-slate-300">
              <li>
                Switch to <strong>Neverness to Everness</strong> and press <kbd className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-xs">F3</kbd> (Scarborough Fair).
              </li>
              <li>
                Open <strong>Dice Roll Records / History</strong> for each board you want to sync (Limited Board, Standard Board, Arc Research, Mystery Box) and flip through your pages.
              </li>
              <li>
                Press <kbd className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-xs">Enter</kbd> (or <kbd className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-xs">F9</kbd> in AutoPage mode). The script stops <code className="text-xs text-cyan-200">pktmon</code>, cleans temp files, decodes your pulls locally, and copies clean JSON to your clipboard.
              </li>
            </ol>
          </div>

          {/* Step 3: Paste / Drop JSON */}
          <div className="rounded-2xl border border-white/10 bg-[#121728]/90 p-5 shadow-xl shadow-black/25">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-500/25 font-mono text-xs font-bold text-violet-200 ring-1 ring-violet-400/40">
                  3
                </span>
                <div>
                  <h2 className="font-display text-base font-bold text-white">
                    Paste JSON from Clipboard (or Drop File)
                  </h2>
                  <p className="text-xs text-slate-400">
                    Accepts zero-install pktmon JSON as well as v1 / v2.1 NTE gacha JSON exports.
                  </p>
                </div>
              </div>

              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-white/12 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-white/10">
                <Upload className="h-3.5 w-3.5 text-cyan-300" />
                Upload JSON
                <input
                  type="file"
                  accept=".json,application/json"
                  className="hidden"
                  onChange={(e) => handleFileRead(e.target.files?.[0])}
                />
              </label>
            </div>

            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragActive(false);
                handleFileRead(e.dataTransfer.files?.[0]);
              }}
              className={`mt-4 rounded-xl border-2 border-dashed transition ${
                dragActive
                  ? 'border-cyan-400 bg-cyan-500/10'
                  : 'border-white/10 bg-[#090d18]'
              }`}
            >
              <textarea
                rows={6}
                value={pasteText}
                onChange={(e) => {
                  setPasteText(e.target.value);
                  setStatusMsg(null);
                }}
                placeholder="Press Ctrl+V here to paste your decoded JSON (or drag & drop a .json file)..."
                className="w-full resize-y bg-transparent p-3.5 font-mono text-xs text-slate-200 placeholder-slate-500 outline-none"
              />
            </div>

            {/* Live Parse Preview */}
            {preview && !preview.ok && (
              <div className="mt-3 flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3.5 py-2.5 text-xs text-rose-200">
                <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
                <span>{preview.error}</span>
              </div>
            )}

            {preview && preview.ok && (
              <div className="mt-4 rounded-xl border border-emerald-400/25 bg-emerald-500/8 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-emerald-200">
                    <FileJson className="h-4 w-4 text-emerald-300" />
                    Detected: {preview.format}
                  </div>
                  <div className="flex items-center gap-3 font-mono text-xs tabular-nums">
                    <span className="rounded bg-emerald-500/20 px-2 py-0.5 font-bold text-emerald-200">
                      +{preview.added} new
                    </span>
                    <span className="rounded bg-white/8 px-2 py-0.5 text-slate-300">
                      {preview.duplicates} duplicates skipped
                    </span>
                  </div>
                </div>

                <div className="mt-2.5 flex flex-wrap gap-2">
                  {Object.entries(preview.byPool).map(([k, count]) => (
                    <span
                      key={k}
                      className="rounded-lg bg-[#0d111e] px-2.5 py-1 text-xs text-slate-300 ring-1 ring-white/10"
                    >
                      {POOL_DEFINITIONS[k]?.title || k}:{' '}
                      <strong className="font-mono text-white">{count}</strong>
                    </span>
                  ))}
                </div>

                <div className="mt-4 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setPasteText('')}
                    className="rounded-xl border border-white/10 px-3.5 py-2 text-xs font-semibold text-slate-300 hover:bg-white/5"
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    onClick={handleCommit}
                    className="rounded-xl bg-gradient-to-r from-violet-600 to-cyan-500 px-5 py-2 text-sm font-bold text-white shadow-lg shadow-violet-600/25 transition hover:brightness-110"
                  >
                    Import &amp; Merge {preview.added} Pulls
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Safety Callout */}
          <div className="flex items-start gap-3 rounded-2xl border border-white/8 bg-[#101526]/80 p-4 text-xs text-slate-400">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
            <div className="space-y-1 leading-relaxed">
              <strong className="text-slate-200">Privacy &amp; Safety Notes:</strong> The script
              only invokes Microsoft&apos;s built-in <code>pktmon.exe</code> (read-only), decodes
              gacha history blocks locally, and never exports tokens, cookies, IPs, or raw packets.
              Temporary capture files in <code>%TEMP%</code> are deleted automatically on exit.
            </div>
          </div>
        </div>
      ) : (
        /* Manual Entry Mode */
        <form
          onSubmit={handleAddManual}
          className="space-y-4 rounded-2xl border border-white/10 bg-[#121728]/90 p-6"
        >
          <h2 className="font-display text-lg font-bold text-white">Log a Manual Pull</h2>
          <p className="text-xs text-slate-400">
            Handy for quick adjustments or pulls made on mobile/PS5.
          </p>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-300">
                Board / Pool
              </label>
              <select
                value={manualPool}
                onChange={(e) => setManualPool(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-[#0a0e1a] px-3 py-2.5 text-sm text-white outline-none focus:border-violet-400"
              >
                {POOL_ORDER.map((key) => (
                  <option key={key} value={key}>
                    {POOL_DEFINITIONS[key].title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-300">
                Reward Item
              </label>
              <select
                value={manualItemId}
                onChange={(e) => setManualItemId(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-[#0a0e1a] px-3 py-2.5 text-sm text-white outline-none focus:border-violet-400"
              >
                {selectableItems.map((it) => (
                  <option key={it.id} value={it.id}>
                    [{it.rank}] {it.name} ({it.category})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-300">
                Timestamp (UTC)
              </label>
              <input
                type="datetime-local"
                value={manualTime}
                onChange={(e) => setManualTime(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-[#0a0e1a] px-3 py-2.5 text-sm text-white outline-none focus:border-violet-400"
              />
            </div>

            {manualPool.startsWith('monopoly_') && (
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-300">
                  Dice Roll (1–6)
                </label>
                <input
                  type="number"
                  min={1}
                  max={6}
                  value={manualRoll}
                  onChange={(e) => setManualRoll(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-[#0a0e1a] px-3 py-2.5 text-sm text-white outline-none focus:border-violet-400"
                />
              </div>
            )}
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-500"
            >
              <PlusCircle className="h-4 w-4" />
              Add Pull
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
