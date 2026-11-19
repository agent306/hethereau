import React, { useEffect, useState } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  RefreshCw,
  LogOut,
  Users,
  Database,
  Activity,
  Globe,
  KeyRound,
  AlertTriangle,
} from 'lucide-react';
import { POOL_DEFINITIONS, POOL_ORDER } from '../lib/catalog.js';
import { fetchStaffStats } from '../lib/statsApi.js';
import { requestStaffGoogleToken } from '../lib/googleDriveSync.js';

export default function StaffStatsPage({ activeGoogleToken, activeGoogleEmail }) {
  const [staffToken, setStaffToken] = useState(() => activeGoogleToken || '');
  const [secretInput, setSecretInput] = useState('');
  const [showSecretForm, setShowSecretForm] = useState(false);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function loadWithGoogleToken(token) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchStaffStats({ googleAccessToken: token });
      setStaffToken(token);
      setData(res);
    } catch (err) {
      setError(err.message);
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  async function loadWithSecret(e) {
    e.preventDefault();
    if (!secretInput.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetchStaffStats({ secret: secretInput.trim() });
      setData(res);
    } catch (err) {
      setError(err.message);
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  // Auto-authenticate if already signed into Google Drive as a staff account
  useEffect(() => {
    if (activeGoogleToken && !data && !loading) {
      loadWithGoogleToken(activeGoogleToken);
    }
  }, [activeGoogleToken]);

  async function handleGoogleStaffLogin() {
    setLoading(true);
    setError(null);
    try {
      const { accessToken } = await requestStaffGoogleToken({ prompt: 'select_account' });
      await loadWithGoogleToken(accessToken);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }

  function handleSignOut() {
    setData(null);
    setStaffToken('');
    setSecretInput('');
    setError(null);
  }

  if (!data) {
    return (
      <div className="mx-auto max-w-lg py-10">
        <div className="nte-panel-gold rounded-xl p-6">
          <div className="mb-1 flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-widest text-[#f5c451]">
            <ShieldCheck className="h-3.5 w-3.5 text-[#2ee6ff]" />
            Restricted // Hethereau Operations
          </div>
          <h1 className="font-display text-2xl font-bold uppercase tracking-wide text-white">
            Staff-Only Telemetry
          </h1>
          <p className="mt-1.5 text-sm text-slate-400">
            Sign in with an authorized Hethereau staff Google account to inspect Durable Object shard health, contributor metrics, and blocked abuse logs.
          </p>

          {error && (
            <div className="mt-4 flex items-center gap-2 rounded-lg border border-rose-500/35 bg-rose-500/12 px-3.5 py-2.5 text-xs text-rose-200">
              <ShieldAlert className="h-4 w-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          <div className="mt-5 space-y-3">
            <button
              type="button"
              onClick={handleGoogleStaffLogin}
              disabled={loading}
              className="nte-cut-btn flex w-full items-center justify-center gap-2 bg-[#f5c451] px-5 py-3 font-display text-sm font-bold uppercase tracking-wider text-[#08090f] shadow-[0_0_24px_rgba(245,196,81,0.25)] transition hover:bg-[#ffd56b] disabled:opacity-50"
            >
              <ShieldCheck className="h-4 w-4" />
              {loading
                ? 'Verifying Staff Identity...'
                : activeGoogleEmail
                  ? `Verify Staff Access (${activeGoogleEmail})`
                  : 'Sign in with Staff Google Account'}
            </button>

            <button
              type="button"
              onClick={() => setShowSecretForm((v) => !v)}
              className="flex w-full items-center justify-center gap-1.5 py-1.5 font-mono text-[11px] text-slate-500 hover:text-slate-300"
            >
              <KeyRound className="h-3 w-3" />
              {showSecretForm ? 'Hide API Key Fallback' : 'Or authenticate with Staff Secret'}
            </button>

            {showSecretForm && (
              <form onSubmit={loadWithSecret} className="flex gap-2 pt-1">
                <input
                  type="password"
                  value={secretInput}
                  onChange={(e) => setSecretInput(e.target.value)}
                  placeholder="Enter STAFF_SECRET..."
                  className="flex-1 rounded-lg border border-white/10 bg-[#080a10] px-3 py-2 font-mono text-xs text-white outline-none focus:border-[#f5c451]"
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-lg border border-[#f5c451]/45 bg-[#f5c451]/15 px-4 py-2 font-mono text-xs font-bold uppercase text-[#fde68a] hover:bg-[#f5c451]/25"
                >
                  Unlock
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    );
  }

  const tel = data.telemetry || {};
  const t = tel.totals || {};
  const totalIngested = (t.total_accepted || 0) + (t.total_duplicates || 0);
  const dedupRate =
    totalIngested > 0 ? (((t.total_duplicates || 0) / totalIngested) * 100).toFixed(1) : '0.0';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <div className="mb-1 flex items-center gap-2 font-mono text-[11px] font-semibold tracking-widest uppercase text-emerald-400">
            <ShieldCheck className="h-3.5 w-3.5" />
            Verified Staff: {data.staffIdentity} ({data.authMethod})
          </div>
          <h1 className="font-display text-3xl font-bold tracking-wide uppercase text-white">
            Staff Operations &amp; Abuse Telemetry
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Live SQLite Durable Object shard inspection, contributor analytics &amp; anti-poisoning audit logs
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() =>
              staffToken
                ? loadWithGoogleToken(staffToken)
                : secretInput
                  ? fetchStaffStats({ secret: secretInput }).then(setData)
                  : handleGoogleStaffLogin()
            }
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/12 bg-white/[0.04] px-3.5 py-2 font-mono text-xs font-bold uppercase text-slate-200 hover:border-[#2ee6ff]/45"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-[#2ee6ff] ${loading ? 'animate-spin' : ''}`} />
            Refresh Live
          </button>
          <button
            type="button"
            onClick={handleSignOut}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/12 bg-white/[0.04] px-3.5 py-2 font-mono text-xs font-bold uppercase text-slate-300 hover:border-rose-400/45 hover:text-rose-200"
          >
            <LogOut className="h-3.5 w-3.5" />
            Lock
          </button>
        </div>
      </div>

      {/* Staff KPI Strip */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="nte-panel relative overflow-hidden rounded-xl p-4">
          <span className="absolute top-0 bottom-0 left-0 w-[3px] bg-[#2ee6ff]" />
          <div className="flex items-center justify-between font-mono text-[10px] font-bold uppercase tracking-widest text-slate-400">
            <span>Unique Contributors</span>
            <Users className="h-4 w-4 text-[#2ee6ff]" />
          </div>
          <div className="mt-2 font-mono text-2xl font-bold text-white tabular-nums">
            {(t.unique_contributors || 0).toLocaleString()}
          </div>
          <div className="mt-0.5 font-mono text-[11px] text-slate-400">
            {t.active_24h || 0} active 24h · {t.returning_contributors || 0} returning
          </div>
        </div>

        <div className="nte-panel relative overflow-hidden rounded-xl p-4">
          <span className="absolute top-0 bottom-0 left-0 w-[3px] bg-[#f5c451]" />
          <div className="flex items-center justify-between font-mono text-[10px] font-bold uppercase tracking-widest text-slate-400">
            <span>Accepted Pulls</span>
            <Database className="h-4 w-4 text-[#f5c451]" />
          </div>
          <div className="mt-2 font-mono text-2xl font-bold text-[#f5c451] tabular-nums">
            {(t.total_accepted || 0).toLocaleString()}
          </div>
          <div className="mt-0.5 font-mono text-[11px] text-slate-400">
            {(t.total_submissions || 0).toLocaleString()} submissions
          </div>
        </div>

        <div className="nte-panel relative overflow-hidden rounded-xl p-4">
          <span className="absolute top-0 bottom-0 left-0 w-[3px] bg-emerald-400" />
          <div className="flex items-center justify-between font-mono text-[10px] font-bold uppercase tracking-widest text-slate-400">
            <span>Duplicates Blocked</span>
            <Activity className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="mt-2 font-mono text-2xl font-bold text-emerald-300 tabular-nums">
            {(t.total_duplicates || 0).toLocaleString()}
          </div>
          <div className="mt-0.5 font-mono text-[11px] text-slate-400">
            {dedupRate}% dedup ratio
          </div>
        </div>

        <div className="nte-panel relative overflow-hidden rounded-xl p-4">
          <span className="absolute top-0 bottom-0 left-0 w-[3px] bg-rose-400" />
          <div className="flex items-center justify-between font-mono text-[10px] font-bold uppercase tracking-widest text-slate-400">
            <span>Abuse Quarantined</span>
            <ShieldAlert className="h-4 w-4 text-rose-400" />
          </div>
          <div className="mt-2 font-mono text-2xl font-bold text-rose-300 tabular-nums">
            {(t.blocked_attempts || 0).toLocaleString()}
          </div>
          <div className="mt-0.5 font-mono text-[11px] text-slate-400">
            Rate-limit / anomaly / fake IDs
          </div>
        </div>
      </div>

      {/* Durable Object Shard Health Table */}
      <div className="nte-panel overflow-hidden rounded-xl">
        <div className="border-b border-white/10 bg-[#090b12] px-5 py-3.5">
          <h2 className="font-display text-sm font-bold uppercase tracking-wider text-white">
            SQLite Durable Object Shards (PoolStatsDO)
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white/8 font-mono text-[10px] uppercase tracking-wider text-slate-400">
                <th className="px-4 py-2.5">Shard Key</th>
                <th className="px-4 py-2.5 text-right">Total Pulls</th>
                <th className="px-4 py-2.5 text-right">Seen Hashes</th>
                <th className="px-4 py-2.5 text-right">S-Class (Measured)</th>
                <th className="px-4 py-2.5 text-right">Avg Pity</th>
                <th className="px-4 py-2.5 text-right">S-Rate</th>
                <th className="px-4 py-2.5 text-right">Distinct Items</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06] font-mono">
              {POOL_ORDER.map((k) => {
                const p = data.pools?.[k] || {};
                return (
                  <tr key={k} className="hover:bg-white/[0.03]">
                    <td className="px-4 py-2.5 text-slate-200">
                      <span className="font-sans font-semibold text-white">
                        {POOL_DEFINITIONS[k].title}
                      </span>
                      <div className="text-[10px] text-slate-500">pool:{k}</div>
                    </td>
                    <td className="px-4 py-2.5 text-right text-white">
                      {(p.totalPulls || 0).toLocaleString()}
                    </td>
                    <td className="px-4 py-2.5 text-right text-slate-300">
                      {(p.seenRecordHashes || 0).toLocaleString()}
                    </td>
                    <td className="px-4 py-2.5 text-right text-[#f5c451]">
                      {(p.sRankPityHits || 0).toLocaleString()} ({p.sRankPityMeasured || 0})
                    </td>
                    <td className="px-4 py-2.5 text-right text-slate-200">
                      {p.sRankPityMeasured > 0 ? p.avgSPity.toFixed(1) : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-right text-[#2ee6ff]">
                      {p.totalPulls > 0 ? `${p.sRatePct.toFixed(2)}%` : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-right text-slate-400">
                      {p.distinctItems || 0}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Country + Source Breakdown */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="nte-panel rounded-xl p-5">
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-[#2ee6ff]" />
            <h2 className="font-display text-sm font-bold uppercase tracking-wider text-white">
              Edge Country Breakdown (cf.country)
            </h2>
          </div>
          {!tel.countries?.length ? (
            <p className="mt-4 font-mono text-xs text-slate-500">No submissions yet.</p>
          ) : (
            <div className="mt-3 space-y-2 font-mono text-xs">
              {tel.countries.map((c) => (
                <div
                  key={c.country}
                  className="flex items-center justify-between rounded border border-white/8 bg-[#090b12] px-3 py-2"
                >
                  <span className="font-bold text-white">{c.country}</span>
                  <span className="text-slate-400">
                    {c.submissions} subs ·{' '}
                    <strong className="text-[#f5c451]">
                      {c.accepted_pulls.toLocaleString()} pulls
                    </strong>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="nte-panel rounded-xl p-5">
          <h2 className="font-display text-sm font-bold uppercase tracking-wider text-white">
            Import Source Mix
          </h2>
          {!tel.sources?.length ? (
            <p className="mt-4 font-mono text-xs text-slate-500">No submissions yet.</p>
          ) : (
            <div className="mt-3 space-y-2 font-mono text-xs">
              {tel.sources.map((s) => (
                <div
                  key={s.source}
                  className="flex items-center justify-between rounded border border-white/8 bg-[#090b12] px-3 py-2"
                >
                  <span className="text-[#2ee6ff]">{s.source}</span>
                  <span className="text-slate-400">
                    {s.submissions} subs ·{' '}
                    <strong className="text-white">
                      {s.accepted_pulls.toLocaleString()} pulls
                    </strong>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Blocked / Quarantined Abuse Audit Log */}
      <div className="nte-panel overflow-hidden rounded-xl border-rose-500/20">
        <div className="flex items-center gap-2 border-b border-white/10 bg-rose-500/[0.06] px-5 py-3.5">
          <AlertTriangle className="h-4 w-4 text-rose-400" />
          <h2 className="font-display text-sm font-bold uppercase tracking-wider text-rose-200">
            Blocked &amp; Quarantined Attempts (Latest 40)
          </h2>
        </div>
        {!tel.recentBlocked?.length ? (
          <div className="p-5 font-mono text-xs text-slate-500">
            Zero blocked abuse or anomaly attempts recorded.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead>
                <tr className="border-b border-white/8 text-[10px] uppercase text-slate-400">
                  <th className="px-4 py-2">Time</th>
                  <th className="px-4 py-2">Reason</th>
                  <th className="px-4 py-2">Country</th>
                  <th className="px-4 py-2">Records</th>
                  <th className="px-4 py-2">Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {tel.recentBlocked.map((b) => (
                  <tr key={b.id} className="hover:bg-white/[0.03]">
                    <td className="whitespace-nowrap px-4 py-2 text-slate-400">
                      {new Date(b.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-2 font-bold text-rose-300">{b.reason}</td>
                    <td className="px-4 py-2 text-slate-300">{b.country}</td>
                    <td className="px-4 py-2 text-slate-300">{b.record_count}</td>
                    <td className="px-4 py-2 text-slate-400">{b.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recent Accepted Submissions Feed */}
      <div className="nte-panel overflow-hidden rounded-xl">
        <div className="border-b border-white/10 bg-[#090b12] px-5 py-3.5">
          <h2 className="font-display text-sm font-bold uppercase tracking-wider text-white">
            Recent Accepted Contributions (Latest 50)
          </h2>
        </div>
        {!tel.recentEvents?.length ? (
          <div className="p-5 font-mono text-xs text-slate-500">
            No contributions recorded yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead>
                <tr className="border-b border-white/8 text-[10px] uppercase text-slate-400">
                  <th className="px-4 py-2">Time</th>
                  <th className="px-4 py-2">Contributor</th>
                  <th className="px-4 py-2">Country</th>
                  <th className="px-4 py-2">Source</th>
                  <th className="px-4 py-2 text-right">Accepted</th>
                  <th className="px-4 py-2 text-right">Dupes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {tel.recentEvents.map((e) => (
                  <tr key={e.id} className="hover:bg-white/[0.03]">
                    <td className="whitespace-nowrap px-4 py-2 text-slate-400">
                      {new Date(e.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-2 text-slate-300">
                      {String(e.contributor_hash).slice(0, 10)}
                    </td>
                    <td className="px-4 py-2 text-slate-300">{e.country}</td>
                    <td className="px-4 py-2 text-[#2ee6ff]">{e.source}</td>
                    <td className="px-4 py-2 text-right font-bold text-emerald-300">
                      +{e.accepted_count}
                    </td>
                    <td className="px-4 py-2 text-right text-slate-500">
                      {e.duplicate_count}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
