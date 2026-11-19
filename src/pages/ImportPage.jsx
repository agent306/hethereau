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
  Globe2,
} from 'lucide-react';
import { normalizeExternalJson } from '../lib/formats.js';
import { mergePullRecords } from '../lib/pityEngine.js';
import { POOL_DEFINITIONS, POOL_ORDER } from '../lib/catalog.js';
import { navigate } from '../lib/router.js';
import {
  getContributePreference,
  setContributePreference,
} from '../lib/statsApi.js';

const PROD_ORIGIN = 'https://hethereau.pages.dev';

export default function ImportPage({
  existingRecords,
  catalog,
  onCommitImport,
}) {
  const [mode, setMode] = useState('pktmon');
  const [noFilter, setNoFilter] = useState(false);
  const [autoPage, setAutoPage] = useState(false);
  const [contributeGlobal, setContributeGlobal] = useState(getContributePreference);
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
    const res = onCommitImport(preview.records, {
      contributeToGlobal: contributeGlobal,
      format: preview.format,
    });
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
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <div className="mb-1 flex items-center gap-2 font-mono text-[11px] font-semibold tracking-widest uppercase text-[#2ee6ff]">
            <span className="inline-block h-1.5 w-1.5 rotate-45 bg-[#f5c451]" />
            Anomaly Signal Decoder // Local Capture
          </div>
          <h1 className="font-display text-3xl font-bold tracking-wide uppercase text-white">
            Zero-Install PC Import
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Uses built-in Windows{' '}
            <code className="rounded bg-white/10 px-1.5 py-0.5 text-xs text-[#2ee6ff]">
              pktmon.exe
            </code>{' '}
            — no drivers, no .exe downloads, no memory injection.
          </p>
        </div>

        <div className="flex gap-1 rounded-lg border border-white/10 bg-[#090b12] p-1">
          <button
            type="button"
            onClick={() => setMode('pktmon')}
            className={`rounded px-3 py-1.5 font-mono text-xs font-bold uppercase tracking-wider transition ${
              mode === 'pktmon'
                ? 'bg-[#f5c451]/18 text-[#fef3c7] ring-1 ring-[#f5c451]/45'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            PC Zero-Install
          </button>
          <button
            type="button"
            onClick={() => setMode('manual')}
            className={`rounded px-3 py-1.5 font-mono text-xs font-bold uppercase tracking-wider transition ${
              mode === 'manual'
                ? 'bg-[#f5c451]/18 text-[#fef3c7] ring-1 ring-[#f5c451]/45'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Manual Entry
          </button>
        </div>
      </div>

      {statusMsg && (
        <div className="flex items-center gap-2.5 rounded-lg border border-emerald-400/35 bg-emerald-500/12 px-4 py-3 text-sm text-emerald-200">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-300" />
          <span>{statusMsg.text}</span>
        </div>
      )}

      {mode === 'pktmon' ? (
        <div className="space-y-5">
          {/* Step 1 */}
          <div className="nte-panel rounded-xl p-5">
            <div className="flex items-center gap-3">
              <span className="nte-cut-chip flex h-8 shrink-0 items-center justify-center bg-[#f5c451]/18 px-2.5 font-mono text-[11px] font-bold tracking-wider text-[#fde68a] ring-1 ring-[#f5c451]/45">
                STEP 01
              </span>
              <div>
                <h2 className="font-display text-base font-bold uppercase tracking-wide text-white">
                  Run the Zero-Install Script in Windows PowerShell
                </h2>
                <p className="text-xs text-slate-400">
                  Open Start &rarr; search <strong>Windows PowerShell</strong> &rarr; paste &amp; press Enter (accept the Admin prompt for built-in{' '}
                  <code>pktmon.exe</code>).
                </p>
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <div className="flex flex-1 items-center gap-2.5 overflow-x-auto rounded-lg border border-white/10 bg-[#080a10] px-3.5 py-3 font-mono text-xs text-[#2ee6ff]">
                <Terminal className="h-4 w-4 shrink-0 text-[#f5c451]" />
                <code className="whitespace-nowrap">{psCommand}</code>
              </div>
              <button
                type="button"
                onClick={handleCopyCommand}
                className="nte-cut-btn inline-flex shrink-0 items-center justify-center gap-2 bg-[#f5c451] px-4 py-3 font-display text-sm font-bold uppercase tracking-wider text-[#08090f] transition hover:bg-[#ffd56b]"
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? 'Copied!' : 'Copy Command'}
              </button>
            </div>

            <div className="mt-3.5 flex flex-wrap items-start justify-between gap-3 text-xs text-slate-400">
              <div className="space-y-1.5">
                <label className="flex cursor-pointer items-center gap-2 select-none">
                  <input
                    type="checkbox"
                    checked={autoPage}
                    onChange={(e) => setAutoPage(e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-white/20 bg-[#080a10] accent-[#f5c451]"
                  />
                  <span>
                    Use <code className="text-[#f5c451]">-AutoPage</code> (hover{' '}
                    <strong className="text-slate-200">Next &gt;</strong>, press{' '}
                    <kbd className="rounded border border-white/15 bg-white/10 px-1 font-mono text-[10px] text-slate-200">F8</kbd>{' '}
                    to flip,{' '}
                    <kbd className="rounded border border-white/15 bg-white/10 px-1 font-mono text-[10px] text-slate-200">F9</kbd>{' '}
                    to decode; opt-in macro)
                  </span>
                </label>

                <label className="flex cursor-pointer items-center gap-2 select-none">
                  <input
                    type="checkbox"
                    checked={noFilter}
                    onChange={(e) => setNoFilter(e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-white/20 bg-[#080a10] accent-[#2ee6ff]"
                  />
                  <span>
                    Use <code className="text-slate-300">-NoFilter</code> (enable if on VPN / PPPoE and getting 0 records)
                  </span>
                </label>
              </div>

              <a
                href="/import-nte.ps1"
                download="import-nte.ps1"
                className="inline-flex items-center gap-1.5 font-mono text-xs font-semibold text-[#2ee6ff] hover:text-[#67e8f9]"
              >
                <Download className="h-3.5 w-3.5" />
                Inspect / Download import-nte.ps1
              </a>
            </div>
          </div>

          {/* Step 2 */}
          <div className="nte-panel rounded-xl p-5">
            <div className="flex items-center gap-3">
              <span className="nte-cut-chip flex h-8 shrink-0 items-center justify-center bg-[#f5c451]/18 px-2.5 font-mono text-[11px] font-bold tracking-wider text-[#fde68a] ring-1 ring-[#f5c451]/45">
                STEP 02
              </span>
              <h2 className="font-display text-base font-bold uppercase tracking-wide text-white">
                Flip Through In-Game Pull History, Then Decode
              </h2>
            </div>
            <ol className="mt-3 ml-10 list-decimal space-y-1.5 text-sm text-slate-300">
              <li>
                Switch to <strong>Neverness to Everness</strong> and press{' '}
                <kbd className="rounded border border-white/15 bg-white/10 px-1.5 py-0.5 font-mono text-xs text-[#f5c451]">F3</kbd> (Scarborough Fair).
              </li>
              <li>
                Open <strong>Dice Roll Records / History</strong> for each board you want to sync (Limited Board, Standard Board, Arc Research, Mystery Box) and flip through your pages.
              </li>
              <li>
                Press <kbd className="rounded border border-white/15 bg-white/10 px-1.5 py-0.5 font-mono text-xs text-[#f5c451]">Enter</kbd> (or{' '}
                <kbd className="rounded border border-white/15 bg-white/10 px-1.5 py-0.5 font-mono text-xs text-[#f5c451]">F9</kbd> in AutoPage mode). The script stops{' '}
                <code className="text-xs text-[#2ee6ff]">pktmon</code>, cleans temp files, decodes your pulls locally, and copies clean JSON to your clipboard.
              </li>
            </ol>
          </div>

          {/* Step 3 */}
          <div className="nte-panel rounded-xl p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="nte-cut-chip flex h-8 shrink-0 items-center justify-center bg-[#f5c451]/18 px-2.5 font-mono text-[11px] font-bold tracking-wider text-[#fde68a] ring-1 ring-[#f5c451]/45">
                  STEP 03
                </span>
                <div>
                  <h2 className="font-display text-base font-bold uppercase tracking-wide text-white">
                    Paste JSON from Clipboard (or Drop File)
                  </h2>
                  <p className="text-xs text-slate-400">
                    Accepts zero-install pktmon JSON as well as v1 / v2.1 NTE gacha JSON exports.
                  </p>
                </div>
              </div>

              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-white/12 bg-white/[0.04] px-3 py-1.5 font-mono text-xs font-semibold uppercase tracking-wider text-slate-200 transition hover:border-[#2ee6ff]/45 hover:bg-[#2ee6ff]/10">
                <Upload className="h-3.5 w-3.5 text-[#2ee6ff]" />
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
              className={`mt-4 rounded-lg border-2 border-dashed transition ${
                dragActive
                  ? 'border-[#2ee6ff] bg-[#2ee6ff]/10'
                  : 'border-white/12 bg-[#080a10]'
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

            {preview && !preview.ok && (
              <div className="mt-3 flex items-center gap-2 rounded-lg border border-rose-500/35 bg-rose-500/10 px-3.5 py-2.5 text-xs text-rose-200">
                <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
                <span>{preview.error}</span>
              </div>
            )}

            {preview && preview.ok && (
              <div className="mt-4 rounded-lg border border-emerald-400/30 bg-emerald-500/[0.08] p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2 font-display text-sm font-bold uppercase tracking-wide text-emerald-200">
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
                      className="rounded border border-white/10 bg-[#090b12] px-2.5 py-1 text-xs text-slate-300"
                    >
                      {POOL_DEFINITIONS[k]?.title || k}:{' '}
                      <strong className="font-mono text-[#f5c451]">{count}</strong>
                    </span>
                  ))}
                </div>

                {/* Opt-In Global Stats Contribution Toggle (ON by default) */}
                <label className="mt-4 flex cursor-pointer items-start gap-2.5 rounded-lg border border-white/10 bg-[#090b12]/90 px-3.5 py-3 text-xs select-none transition hover:border-[#2ee6ff]/40">
                  <input
                    type="checkbox"
                    checked={contributeGlobal}
                    onChange={(e) => {
                      const next = e.target.checked;
                      setContributeGlobal(next);
                      setContributePreference(next);
                    }}
                    className="mt-0.5 h-4 w-4 shrink-0 rounded accent-[#f5c451]"
                  />
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5 font-semibold text-white">
                      <Globe2 className="h-3.5 w-3.5 text-[#2ee6ff]" />
                      Contribute anonymized pulls to Global Stats
                    </div>
                    <p className="text-[11px] leading-relaxed text-slate-400">
                      Shares only banner, item, timestamp &amp; deduplicated hash so the community can track live drop rates. No account ID, email, or IP is stored. Uncheck to stay 100% local.
                    </p>
                  </div>
                </label>

                <div className="mt-4 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setPasteText('')}
                    className="rounded-lg border border-white/12 px-3.5 py-2 font-mono text-xs font-bold uppercase text-slate-300 hover:bg-white/5"
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    onClick={handleCommit}
                    className="nte-cut-btn bg-[#f5c451] px-5 py-2 font-display text-sm font-bold uppercase tracking-wider text-[#08090f] shadow-[0_0_20px_rgba(245,196,81,0.25)] transition hover:bg-[#ffd56b]"
                  >
                    Import &amp; Merge {preview.added} Pulls
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Safety Callout */}
          <div className="nte-panel flex items-start gap-3 rounded-xl p-4 text-xs text-slate-400">
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
        <form onSubmit={handleAddManual} className="nte-panel space-y-4 rounded-xl p-6">
          <h2 className="font-display text-lg font-bold uppercase tracking-wide text-white">
            Log a Manual Pull
          </h2>
          <p className="text-xs text-slate-400">
            Handy for quick adjustments or pulls made on mobile/PS5.
          </p>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block font-mono text-[11px] font-bold uppercase tracking-wider text-slate-300">
                Board / Pool
              </label>
              <select
                value={manualPool}
                onChange={(e) => setManualPool(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-[#080a10] px-3 py-2.5 text-sm text-white outline-none focus:border-[#f5c451]/70"
              >
                {POOL_ORDER.map((key) => (
                  <option key={key} value={key}>
                    {POOL_DEFINITIONS[key].title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block font-mono text-[11px] font-bold uppercase tracking-wider text-slate-300">
                Reward Item
              </label>
              <select
                value={manualItemId}
                onChange={(e) => setManualItemId(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-[#080a10] px-3 py-2.5 text-sm text-white outline-none focus:border-[#f5c451]/70"
              >
                {selectableItems.map((it) => (
                  <option key={it.id} value={it.id}>
                    [{it.rank}] {it.name} ({it.category})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block font-mono text-[11px] font-bold uppercase tracking-wider text-slate-300">
                Timestamp (UTC)
              </label>
              <input
                type="datetime-local"
                value={manualTime}
                onChange={(e) => setManualTime(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-[#080a10] px-3 py-2.5 text-sm text-white outline-none focus:border-[#f5c451]/70"
              />
            </div>

            {manualPool.startsWith('monopoly_') && (
              <div>
                <label className="mb-1.5 block font-mono text-[11px] font-bold uppercase tracking-wider text-slate-300">
                  Dice Roll (1–6)
                </label>
                <input
                  type="number"
                  min={1}
                  max={6}
                  value={manualRoll}
                  onChange={(e) => setManualRoll(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-[#080a10] px-3 py-2.5 text-sm text-white outline-none focus:border-[#f5c451]/70"
                />
              </div>
            )}
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              className="nte-cut-btn inline-flex items-center gap-2 bg-[#f5c451] px-5 py-2.5 font-display text-sm font-bold uppercase tracking-wider text-[#08090f] transition hover:bg-[#ffd56b]"
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
