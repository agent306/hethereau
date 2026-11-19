/**
 * Client for Hethereau Global Stats & Staff Telemetry (Cloudflare Worker + SQLite Durable Objects).
 */

const DEFAULT_STATS_API = 'https://hethereau-stats.mohamed-nash-ath.workers.dev';
const CONTRIBUTE_PREF_KEY = 'hethereau_contribute_global_stats_v1';
const CONTRIBUTOR_ID_KEY = 'hethereau_contributor_id_v1';
const CONTRIBUTED_IDS_KEY = 'hethereau_contributed_ids_v1';

export function getContributedRecordIds() {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = window.localStorage.getItem(CONTRIBUTED_IDS_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

export function markContributedRecordIds(ids) {
  if (typeof window === 'undefined' || !ids?.length) return;
  try {
    const set = getContributedRecordIds();
    for (const id of ids) {
      if (id) set.add(String(id));
    }
    // Keep bounded to latest 25,000 IDs to stay well within localStorage quota
    const arr = Array.from(set);
    const trimmed = arr.length > 25000 ? arr.slice(arr.length - 25000) : arr;
    window.localStorage.setItem(CONTRIBUTED_IDS_KEY, JSON.stringify(trimmed));
  } catch {
    // ignore storage quota errors
  }
}

export function getUnsyncedGlobalRecords(records) {
  const contributed = getContributedRecordIds();
  return (records || []).filter(
    (rec) => isEligibleForGlobalStats(rec) && !contributed.has(String(rec.id))
  );
}

export function getStatsApiUrl() {
  const configured =
    typeof import.meta !== 'undefined' && import.meta.env
      ? import.meta.env.VITE_STATS_API_URL
      : '';
  return (configured || DEFAULT_STATS_API).trim().replace(/\/+$/, '');
}

/**
 * Defaults to `true` (ON by default) unless the user explicitly turned it off.
 */
export function getContributePreference() {
  if (typeof window === 'undefined') return true;
  try {
    const val = window.localStorage.getItem(CONTRIBUTE_PREF_KEY);
    if (val === null) return true;
    return val === 'true';
  } catch {
    return true;
  }
}

export function setContributePreference(enabled) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(CONTRIBUTE_PREF_KEY, enabled ? 'true' : 'false');
  } catch {
    // ignore storage quota errors
  }
}

export function getOrCreateContributorId() {
  if (typeof window === 'undefined') return 'anon';
  try {
    const existing = window.localStorage.getItem(CONTRIBUTOR_ID_KEY);
    if (existing && /^[a-f0-9]{16,32}$/.test(existing)) return existing;
    const bytes = new Uint8Array(12);
    window.crypto.getRandomValues(bytes);
    const id = Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    window.localStorage.setItem(CONTRIBUTOR_ID_KEY, id);
    return id;
  } catch {
    return 'anon';
  }
}

async function sha256Hex(text) {
  const buf = await window.crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(String(text))
  );
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function isEligibleForGlobalStats(rec) {
  if (!rec || !rec.id || !rec.item_id || !rec.time) return false;
  const src = String(rec.source || '');
  if (src === 'manual' || src === 'demo') return false;
  const id = String(rec.id);
  if (id.startsWith('manual_') || id.startsWith('demo_')) return false;
  return true;
}

/**
 * Contributes anonymized, hashed pull records to Global Stats.
 * Manual/demo pulls are automatically excluded client-side and rejected server-side.
 */
export async function contributePullRecords(
  records,
  { format = 'nte-gacha-export', region = 'Global', source = 'pktmon_zero_install' } = {}
) {
  const eligible = (records || []).filter(isEligibleForGlobalStats);
  if (eligible.length === 0) {
    return { ok: true, accepted: 0, duplicates: 0, skippedManual: (records || []).length };
  }

  const contributorId = getOrCreateContributorId();
  const safeSource =
    source === 'manual' || source === 'demo' ? 'nte_gacha_export' : source || 'pktmon_zero_install';

  const mapped = await Promise.all(
    eligible.map(async (r) => ({
      poolKey: r.poolKey,
      recordHash: (await sha256Hex(String(r.id))).slice(0, 40),
      time: r.time,
      sourceOrder: typeof r.sourceOrder === 'number' ? r.sourceOrder : 0,
      itemId: String(r.item_id),
      bannerId: String(r.lottery_id || r.banner_id || r.pool_id || ''),
      isBonus: Boolean(r.isBonus),
    }))
  );

  // Chunk into batches of 2500 to stay well within Worker limits
  const CHUNK_SIZE = 2500;
  let totalAccepted = 0;
  let totalDuplicates = 0;

  for (let i = 0; i < mapped.length; i += CHUNK_SIZE) {
    const chunk = mapped.slice(i, i + CHUNK_SIZE);
    const res = await fetch(`${getStatsApiUrl()}/api/stats/contribute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contributorId,
        source: safeSource,
        format,
        region,
        records: chunk,
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data?.error || `Contribution failed (${res.status})`);
    }
    totalAccepted += Number(data.accepted || 0);
    totalDuplicates += Number(data.duplicates || 0);
  }

  markContributedRecordIds(eligible.map((r) => r.id));

  return {
    ok: true,
    accepted: totalAccepted,
    duplicates: totalDuplicates,
    eligible: eligible.length,
  };
}

export async function fetchGlobalStats({ fresh = false } = {}) {
  const qs = fresh ? '?fresh=1' : '';
  const res = await fetch(`${getStatsApiUrl()}/api/stats/global${qs}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || `Failed to load global stats (${res.status})`);
  }
  return data;
}

export async function fetchStaffStats({ googleAccessToken, secret } = {}) {
  const headers = {};
  if (googleAccessToken) {
    headers['X-Google-Access-Token'] = googleAccessToken;
  } else if (secret) {
    headers.Authorization = `Bearer ${secret}`;
  } else {
    throw new Error('Staff authentication required.');
  }

  const res = await fetch(`${getStatsApiUrl()}/api/stats/staff`, { headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data?.error || `Staff auth failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}
