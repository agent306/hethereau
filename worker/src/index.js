import { PoolStatsDO, StaffTelemetryDO } from "./statsDO.js";
import { CATALOG_ALIASES, CATALOG_BANNERS, CATALOG_ITEMS } from "./catalogWhitelist.js";

export { PoolStatsDO, StaffTelemetryDO };

const VALID_POOLS = [
  "monopoly_limited",
  "monopoly_standard",
  "fork_lottery",
  "mystery_box",
];
const POOL_HARD_PITY = {
  monopoly_limited: 90,
  monopoly_standard: 90,
  fork_lottery: 60,
  mystery_box: null,
};
const ALLOWED_SOURCES = new Set([
  "pktmon_zero_install",
  "nte_gacha_export",
  "golumpa_v1",
  "nte_exporter",
  "imported",
]);
const MAX_BODY_BYTES = 1_500_000; // 1.5 MB hard limit
const MAX_RECORDS_PER_REQ = 3000;
const MIN_VALID_TS_MS = Date.parse("2025-01-01T00:00:00Z");

function isAllowedOrigin(origin) {
  if (!origin) return false;
  if (origin === "https://hethereau.pages.dev") return true;
  if (/^https:\/\/[a-z0-9-]+\.hethereau\.pages\.dev$/i.test(origin)) return true;
  if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)) return true;
  return false;
}

function corsHeaders(request) {
  const origin = request.headers.get("Origin") || "";
  const allowed = isAllowedOrigin(origin) ? origin : "https://hethereau.pages.dev";
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Google-Access-Token",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function jsonResponse(request, data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...corsHeaders(request),
      ...extraHeaders,
    },
  });
}

async function sha256Hex(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(text)));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Constant-time token verification (SHA-256 both values to fixed 32 bytes first).
 */
async function verifyStaffSecret(provided, expected) {
  if (!provided || !expected) return false;
  const enc = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(String(provided))),
    crypto.subtle.digest("SHA-256", enc.encode(String(expected))),
  ]);
  return crypto.subtle.timingSafeEqual(a, b);
}

/**
 * Verifies a Google OAuth access_token directly with Google's tokeninfo endpoint
 * and checks that:
 * 1) `aud` matches Hethereau's exact OAuth Client ID (prevents confused-deputy tokens)
 * 2) `email_verified` is true
 * 3) `email` is in `env.STAFF_EMAILS` (e.g. masigning@gmail.com)
 */
async function verifyGoogleStaffToken(accessToken, env) {
  if (!accessToken || accessToken.length < 20 || accessToken.length > 4096) {
    return { ok: false, status: 401, error: "Invalid Google token." };
  }
  const staffEmails = new Set(
    String(env.STAFF_EMAILS || "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
  );
  if (staffEmails.size === 0) {
    return { ok: false, status: 503, error: "Staff accounts not configured." };
  }

  let res;
  try {
    res = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(accessToken)}`
    );
  } catch {
    return { ok: false, status: 502, error: "Unable to verify Google token." };
  }
  if (!res.ok) {
    return { ok: false, status: 401, error: "Google session expired or invalid. Sign in again." };
  }

  const info = await res.json();
  const expectedAud = String(env.GOOGLE_CLIENT_ID || "").trim();
  if (expectedAud && info.aud !== expectedAud) {
    return { ok: false, status: 403, error: "Google token was not issued for Hethereau." };
  }
  const verified = info.email_verified === true || info.email_verified === "true";
  const email = String(info.email || "").trim().toLowerCase();
  if (!verified || !email) {
    return { ok: false, status: 403, error: "Verified Google email is required." };
  }
  if (!staffEmails.has(email)) {
    return { ok: false, status: 403, error: `${email} does not have staff access.` };
  }
  return { ok: true, staffIdentity: email, authMethod: "google_oauth" };
}

async function authorizeStaff(request, env) {
  const googleToken = request.headers.get("X-Google-Access-Token")?.trim();
  if (googleToken) {
    return await verifyGoogleStaffToken(googleToken, env);
  }

  const authHeader = request.headers.get("Authorization") || "";
  if (authHeader.startsWith("Google ")) {
    return await verifyGoogleStaffToken(authHeader.slice(7).trim(), env);
  }

  if (authHeader.startsWith("Bearer ")) {
    const expected = env.STAFF_SECRET;
    if (!expected) {
      return { ok: false, status: 401, error: "Sign in with a Staff Google account." };
    }
    const valid = await verifyStaffSecret(authHeader.slice(7).trim(), expected);
    if (!valid) return { ok: false, status: 401, error: "Invalid staff access key." };
    return { ok: true, staffIdentity: "staff-secret", authMethod: "secret" };
  }

  return { ok: false, status: 401, error: "Staff authentication required." };
}

/**
 * Resolves a submitted item strictly against the server-bundled NTE catalog.
 * Rejects fabricated/unknown items and derives authoritative rank, category, and pity reset flag.
 */
function resolveAuthoritativeItem(rawItemId, poolKey, isBonus) {
  const rawId = String(rawItemId || "").trim();
  if (!rawId || rawId.length > 80) return null;
  const canonicalId = CATALOG_ALIASES[rawId] || rawId;
  const entry = CATALOG_ITEMS[canonicalId];
  if (!entry) return null;

  const [name, rarity, rank, category] = entry;
  let isPityResetS = false;
  if (!isBonus && rarity >= 5) {
    if (poolKey === "monopoly_limited" || poolKey === "monopoly_standard") {
      isPityResetS = category === "character";
    } else if (poolKey === "fork_lottery") {
      isPityResetS = category === "fork";
    } else if (poolKey === "mystery_box") {
      isPityResetS = true;
    }
  }

  return {
    itemId: canonicalId,
    itemName: name,
    rarity,
    rank,
    category,
    isPityResetS,
  };
}

function resolveAuthoritativeBanner(rawBannerId, poolKey) {
  const id = String(rawBannerId || "").trim();
  if (id && CATALOG_BANNERS[id]) {
    return { bannerId: id, bannerTitle: CATALOG_BANNERS[id] };
  }
  const fallbackTitles = {
    monopoly_limited: "Limited Board",
    monopoly_standard: "Standard Board",
    fork_lottery: "Arc Research",
    mystery_box: "Mystery Box",
  };
  return {
    bannerId: poolKey,
    bannerTitle: fallbackTitles[poolKey] || poolKey,
  };
}

function parseValidTimestamp(rawTime) {
  const str = String(rawTime || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}$/.test(str)) return null;
  const iso = str.replace(" ", "T") + "Z";
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return null;
  const maxFuture = Date.now() + 36 * 3_600_000; // allow UTC+14 timezone offset slack
  if (ms < MIN_VALID_TS_MS || ms > maxFuture) return null;
  return { normalized: str.replace("T", " "), day: str.slice(0, 10) };
}

/**
 * Recomputes exact pity intervals server-side and checks statistical plausibility
 * to block poisoned, fabricated, or cherry-picked submissions.
 */
function verifyAndEnrichPoolBatch(poolKey, rawPoolRecords) {
  const sorted = [...rawPoolRecords].sort((a, b) => {
    if (a.time !== b.time) return a.time.localeCompare(b.time);
    if (a.sourceOrder !== b.sourceOrder) return b.sourceOrder - a.sourceOrder;
    return a.recordHash.localeCompare(b.recordHash);
  });

  const hardPity = POOL_HARD_PITY[poolKey];
  const nonBonusTotal = sorted.filter((r) => !r.isBonus).length;

  let sPity = 0;
  let seenFirstS = false;
  let sPityHits = 0;
  let bRankCount = 0;
  let maxGap = 0;

  const enriched = sorted.map((rec) => {
    if (rec.isBonus) {
      return { ...rec, verifiedPity: null };
    }
    sPity++;
    if (rec.rank === "B") bRankCount++;

    let verifiedPity = null;
    if (rec.isPityResetS) {
      sPityHits++;
      if (sPity > maxGap) maxGap = sPity;
      // Only trust exact pity distance when bounded by an earlier S-Class hit
      // OR when the batch has >= 20 pulls (prevents 1-page partial imports injecting fake pity=2)
      if (seenFirstS || nonBonusTotal >= 20) {
        verifiedPity = sPity;
      }
      seenFirstS = true;
      sPity = 0;
    } else if (sPity > maxGap) {
      maxGap = sPity;
    }

    return { ...rec, verifiedPity };
  });

  // Anti-poisoning statistical sanity checks (only enforced on batches of >= 25 non-bonus pulls)
  if (nonBonusTotal >= 25) {
    if (hardPity && maxGap > hardPity) {
      return {
        ok: false,
        reason: "impossible_pity_gap",
        detail: `${poolKey}: ${maxGap} consecutive pulls without S-Class exceeds hard pity ${hardPity}`,
      };
    }

    const sRate = sPityHits / nonBonusTotal;
    const maxPlausibleSRate =
      poolKey === "fork_lottery" ? 0.35 : poolKey === "mystery_box" ? 0.45 : 0.25;
    if (sRate > maxPlausibleSRate) {
      return {
        ok: false,
        reason: "anomalous_s_rate",
        detail: `${poolKey}: ${(sRate * 100).toFixed(1)}% S-rate over ${nonBonusTotal} pulls exceeds plausibility threshold`,
      };
    }

    // Legitimate NTE pulls on Monopoly/Arc boards always contain substantial B-rank filler
    if (poolKey !== "mystery_box") {
      const bRate = bRankCount / nonBonusTotal;
      if (bRate < 0.3) {
        return {
          ok: false,
          reason: "missing_b_ranks",
          detail: `${poolKey}: only ${(bRate * 100).toFixed(1)}% B-rank items in ${nonBonusTotal} pulls (looks filtered/fabricated)`,
        };
      }
    }
  }

  return { ok: true, records: enriched };
}

async function handleContribute(request, env, ctx) {
  const origin = request.headers.get("Origin") || "";
  if (!isAllowedOrigin(origin)) {
    return jsonResponse(request, { error: "Origin not permitted for stat contributions." }, 403);
  }

  const contentType = (request.headers.get("Content-Type") || "").toLowerCase();
  if (!contentType.includes("application/json")) {
    return jsonResponse(request, { error: "Expected application/json body." }, 415);
  }

  const contentLength = Number(request.headers.get("Content-Length") || 0);
  if (contentLength > MAX_BODY_BYTES) {
    return jsonResponse(request, { error: "Payload too large (max 1.5 MB)." }, 413);
  }

  const rawText = await request.text();
  if (rawText.length > MAX_BODY_BYTES) {
    return jsonResponse(request, { error: "Payload too large (max 1.5 MB)." }, 413);
  }

  let body;
  try {
    body = JSON.parse(rawText);
  } catch {
    return jsonResponse(request, { error: "Invalid JSON body." }, 400);
  }

  const source = String(body?.source || "").trim();
  if (!ALLOWED_SOURCES.has(source)) {
    return jsonResponse(
      request,
      { error: "Only verified game exports (not manual or demo pulls) can contribute to Global Stats." },
      400
    );
  }

  if (!Array.isArray(body?.records) || body.records.length === 0) {
    return jsonResponse(request, { error: "No records provided." }, 400);
  }
  if (body.records.length > MAX_RECORDS_PER_REQ) {
    return jsonResponse(
      request,
      { error: `Too many records in a single batch (max ${MAX_RECORDS_PER_REQ}).` },
      400
    );
  }

  const country = request.cf?.country || "XX";
  const contributorHash = /^[a-fA-F0-9_-]{8,32}$/.test(String(body.contributorId || ""))
    ? String(body.contributorId)
    : "anon";

  // Irreversible daily salted IP hash (raw IP is NEVER persisted)
  const ipRaw = request.headers.get("CF-Connecting-IP") || "unknown";
  const dayUtc = new Date().toISOString().slice(0, 10);
  const ipSalt = env.IP_HASH_SALT || env.STAFF_SECRET || "hethereau-default-salt";
  const ipHash = (await sha256Hex(`${ipSalt}|${dayUtc}|${ipRaw}`)).slice(0, 20);

  const staffStub = env.STAFF_TELEMETRY_DO.getByName("staff:global");

  // 1) Enforce per-IP & per-contributor rate limits BEFORE validating or writing to pool DOs
  const rl = await staffStub.checkRateLimit(ipHash, contributorHash, body.records.length);
  if (!rl.allowed) {
    ctx.waitUntil(
      staffStub.recordBlockedAttempt({
        reason: rl.reason,
        detail: `Rate limit hit (${body.records.length} records)`,
        contributorHash,
        country,
        recordCount: body.records.length,
      })
    );
    return jsonResponse(
      request,
      { error: "Rate limit exceeded. Please try again later." },
      429,
      { "Retry-After": String(rl.retryAfterSec || 600) }
    );
  }

  // 2) Strictly validate every record against the server-side NTE catalog
  const byPoolRaw = {};
  let unknownItems = 0;
  let invalidRecords = 0;

  for (const r of body.records) {
    if (!r || typeof r !== "object") {
      invalidRecords++;
      continue;
    }
    const poolKey = String(r.poolKey || "");
    if (!VALID_POOLS.includes(poolKey)) {
      invalidRecords++;
      continue;
    }

    const rawHash = String(r.recordHash || "").trim();
    if (!/^[a-fA-F0-9]{16,64}$/.test(rawHash)) {
      invalidRecords++;
      continue;
    }

    const ts = parseValidTimestamp(r.time);
    if (!ts) {
      invalidRecords++;
      continue;
    }

    const isBonus = Boolean(r.isBonus);
    const authItem = resolveAuthoritativeItem(r.itemId, poolKey, isBonus);
    if (!authItem) {
      unknownItems++;
      continue;
    }

    const banner = resolveAuthoritativeBanner(r.bannerId, poolKey);
    const sourceOrder =
      typeof r.sourceOrder === "number" && Number.isFinite(r.sourceOrder)
        ? Math.floor(r.sourceOrder)
        : 0;

    // Namespace record hash by poolKey server-side so cross-pool collisions cannot occur
    const namespacedHash = (await sha256Hex(`${poolKey}|${rawHash}`)).slice(0, 40);

    if (!byPoolRaw[poolKey]) byPoolRaw[poolKey] = [];
    byPoolRaw[poolKey].push({
      poolKey,
      recordHash: namespacedHash,
      time: ts.normalized,
      day: ts.day,
      sourceOrder,
      itemId: authItem.itemId,
      itemName: authItem.itemName,
      category: authItem.category,
      rank: authItem.rank,
      bannerId: banner.bannerId,
      bannerTitle: banner.bannerTitle,
      isBonus,
      isPityResetS: authItem.isPityResetS,
    });
  }

  const totalInput = body.records.length;
  // Reject if a high fraction of submitted items are fake/unrecognized
  if (unknownItems > 0 && unknownItems / totalInput > 0.25) {
    ctx.waitUntil(
      staffStub.recordBlockedAttempt({
        reason: "unknown_catalog_items",
        detail: `${unknownItems}/${totalInput} items not in NTE catalog`,
        contributorHash,
        country,
        recordCount: totalInput,
      })
    );
    return jsonResponse(
      request,
      { error: "Batch rejected: too many unrecognized item IDs." },
      400
    );
  }

  const poolEntries = Object.entries(byPoolRaw);
  if (poolEntries.length === 0) {
    return jsonResponse(request, { error: "No valid NTE pull records found." }, 400);
  }

  // 3) Server-side pity recomputation & statistical poisoning checks per pool
  const verifiedPools = [];
  for (const [poolKey, recs] of poolEntries) {
    const check = verifyAndEnrichPoolBatch(poolKey, recs);
    if (!check.ok) {
      ctx.waitUntil(
        staffStub.recordBlockedAttempt({
          reason: check.reason,
          detail: check.detail,
          contributorHash,
          country,
          recordCount: recs.length,
        })
      );
      return jsonResponse(
        request,
        { error: `Batch quarantined by integrity check (${check.reason}).` },
        422
      );
    }
    verifiedPools.push([poolKey, check.records]);
  }

  // 4) Fan out atomically to each pool's Durable Object shard in parallel
  const shardResults = await Promise.all(
    verifiedPools.map(async ([poolKey, recs]) => {
      const stub = env.POOL_STATS_DO.getByName(`pool:${poolKey}`);
      return await stub.ingestBatch(poolKey, recs);
    })
  );

  let totalAccepted = 0;
  let totalDuplicates = 0;
  const poolBreakdown = {};
  for (const r of shardResults) {
    totalAccepted += r.accepted;
    totalDuplicates += r.duplicates;
    poolBreakdown[r.poolKey] = {
      accepted: r.accepted,
      duplicates: r.duplicates,
    };
  }

  // 5) Record operational staff telemetry in background via ctx.waitUntil
  ctx.waitUntil(
    staffStub.recordSubmission({
      contributorHash,
      ipHash,
      source,
      format: String(body.format || "unknown").slice(0, 40),
      region: String(body.region || "Global").slice(0, 20),
      country,
      submittedCount: totalInput - invalidRecords - unknownItems,
      acceptedCount: totalAccepted,
      duplicateCount: totalDuplicates,
      pools: poolBreakdown,
    })
  );

  if (totalAccepted > 0) {
    const cacheUrl = new URL("/api/stats/global", request.url).toString();
    ctx.waitUntil(caches.default.delete(new Request(cacheUrl)));
  }

  return jsonResponse(request, {
    ok: true,
    accepted: totalAccepted,
    duplicates: totalDuplicates,
    skippedUnknown: unknownItems,
    pools: poolBreakdown,
  });
}

async function handleGlobalStats(request, env, ctx) {
  const url = new URL(request.url);
  const bypassCache = url.searchParams.get("fresh") === "1";
  const cacheKey = new Request(new URL("/api/stats/global", request.url).toString());

  if (!bypassCache) {
    const cached = await caches.default.match(cacheKey);
    if (cached) {
      const data = await cached.text();
      return new Response(data, {
        status: 200,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "public, max-age=30",
          "X-Stats-Cache": "HIT",
          ...corsHeaders(request),
        },
      });
    }
  }

  const [poolSummaries, contributors] = await Promise.all([
    Promise.all(
      VALID_POOLS.map(async (poolKey) => {
        const stub = env.POOL_STATS_DO.getByName(`pool:${poolKey}`);
        const summary = await stub.getPublicSummary();
        return [poolKey, summary];
      })
    ),
    env.STAFF_TELEMETRY_DO.getByName("staff:global").getPublicContributorCount(),
  ]);

  const pools = Object.fromEntries(poolSummaries);

  let totalPulls = 0;
  let totalBonusRows = 0;
  let totalSPityHits = 0;
  let totalSAllHits = 0;
  let totalAHits = 0;
  let latestUpdatedAt = 0;

  for (const summary of Object.values(pools)) {
    totalPulls += summary.totalPulls;
    totalBonusRows += summary.bonusRows;
    totalSPityHits += summary.sRankPityHits;
    totalSAllHits += summary.sRankAllHits;
    totalAHits += summary.aRankHits;
    if (summary.updatedAt > latestUpdatedAt) latestUpdatedAt = summary.updatedAt;
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    updatedAt: latestUpdatedAt,
    totals: {
      totalPulls,
      totalBonusRows,
      sRankPityHits: totalSPityHits,
      sRankAllHits: totalSAllHits,
      aRankHits: totalAHits,
      sRatePct: totalPulls > 0 ? Number(((totalSPityHits / totalPulls) * 100).toFixed(3)) : 0,
      contributors,
    },
    pools,
  };

  const jsonBody = JSON.stringify(payload);
  ctx.waitUntil(
    caches.default.put(
      cacheKey,
      new Response(jsonBody, {
        status: 200,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "public, max-age=30",
        },
      })
    )
  );

  return new Response(jsonBody, {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=30",
      "X-Stats-Cache": "MISS",
      ...corsHeaders(request),
    },
  });
}

async function handleStaffStats(request, env) {
  const auth = await authorizeStaff(request, env);
  if (!auth.ok) {
    return jsonResponse(request, { error: auth.error }, auth.status);
  }

  const [poolEntries, telemetry] = await Promise.all([
    Promise.all(
      VALID_POOLS.map(async (poolKey) => {
        const stub = env.POOL_STATS_DO.getByName(`pool:${poolKey}`);
        const detail = await stub.getStaffDetail();
        return [poolKey, detail];
      })
    ),
    env.STAFF_TELEMETRY_DO.getByName("staff:global").getStaffOverview(),
  ]);

  return jsonResponse(
    request,
    {
      generatedAt: new Date().toISOString(),
      staffIdentity: auth.staffIdentity,
      authMethod: auth.authMethod,
      telemetry,
      pools: Object.fromEntries(poolEntries),
    },
    200,
    { "Cache-Control": "no-store" }
  );
}

function parseOfficialPatchDate(str, baseYear, fallbackHour, fallbackMin) {
  const MONTHS = {
    jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
    jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
  };
  const m = String(str || "").match(
    /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+(\d{1,2})(?:,?\s*(\d{4}))?(?:[^\d]*?(\d{1,2}):(\d{2}))?/i
  );
  if (!m) return null;
  const monthNum = MONTHS[m[1].slice(0, 3).toLowerCase()];
  if (!monthNum) return null;
  const dayNum = Number(m[2]);
  const yr = m[3] ? Number(m[3]) : baseYear;
  const hh = m[4] !== undefined ? Number(m[4]) : fallbackHour;
  const mm = m[5] !== undefined ? Number(m[5]) : fallbackMin;
  return {
    year: yr,
    month: monthNum,
    day: dayNum,
    hh,
    mm,
    explicitYear: Boolean(m[3]),
    toIso(overrideYear) {
      const y = overrideYear ?? this.year;
      return `${y}-${String(this.month).padStart(2, "0")}-${String(this.day).padStart(2, "0")}T${String(this.hh).padStart(2, "0")}:${String(this.mm).padStart(2, "0")}:00+08:00`;
    },
  };
}

function classifyOfficialEvent(title) {
  const t = title.toLowerCase();
  if (/limited\s+s-class\s+character|limited\s+board/.test(t)) {
    return { category: "banner", color: t.includes("rerun") ? "#fb7185" : "#f5c451" };
  }
  if (/limited\s+s-class\s+arc|arc\s+research/.test(t)) {
    return { category: "arc", color: "#c084fc" };
  }
  if (/mystery\s+box/.test(t)) {
    return { category: "mystery_box", color: "#ec4899" };
  }
  if (/login\s+event|check-in/.test(t)) {
    return { category: "login", color: "#34d399" };
  }
  if (/outfit|shop|discount|bounty\s+guide/.test(t)) {
    return { category: "shop", color: "#a855f7" };
  }
  return { category: "event", color: "#2ee6ff" };
}

function parseOfficialPatchNotesHtml(html, patchUrl, publishedDate) {
  const baseYear = Number(String(publishedDate || "").slice(0, 4)) || new Date().getUTCFullYear();
  const text = String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, "\n")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\r/g, "");
  const lines = text
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

  const events = [];
  const seenTitles = new Set();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!/^(Availability|Duration|Discount Period)\s*:/i.test(line)) continue;
    const range = line.replace(/^(Availability|Duration|Discount Period)\s*:\s*/i, "");
    const parts = range.split(/\s*[–—-]\s*/);
    if (parts.length < 2) continue;

    const startObj = parseOfficialPatchDate(parts[0], baseYear, 11, 0);
    const endObj = parseOfficialPatchDate(parts[1], baseYear, 5, 59);
    if (!startObj || !endObj) continue;

    // Handle Dec -> Jan year rollover cleanly when end year is omitted
    let endYear = endObj.year;
    if (!endObj.explicitYear && endObj.month < startObj.month) {
      endYear = startObj.year + 1;
    }

    let title = "";
    for (let back = 1; back <= 3 && i - back >= 0; back++) {
      const prev = lines[i - back];
      if (/^[●•\d]/.test(prev) || /Event|Board|Character|Arc|Outfit|Mystery Box|Guide/i.test(prev)) {
        title = prev.replace(/^[●•\d.\s]+/, "").trim();
        break;
      }
    }
    if (!title || title.length > 100) continue;
    const normKey = title.toLowerCase();
    if (seenTitles.has(normKey)) continue;
    seenTitles.add(normKey);

    // Grab optional short description from the next line if it starts with Details:/Board Details:
    let subtitle = "";
    const nextLine = lines[i + 1] || "";
    if (/^(Details|Board Details)\s*:/i.test(nextLine)) {
      subtitle = nextLine.replace(/^(Details|Board Details)\s*:\s*/i, "").slice(0, 160);
    }

    const { category, color } = classifyOfficialEvent(title);
    events.push({
      id: `auto_${events.length}_${normKey.replace(/[^a-z0-9]+/g, "_").slice(0, 32)}`,
      title,
      subtitle: subtitle || `Official event from ${publishedDate || "latest"} Patch Notes`,
      category,
      color,
      start: startObj.toIso(startObj.year),
      end: endObj.toIso(endYear),
      url: patchUrl,
      autoDiscovered: true,
    });
  }

  return events;
}

const OFFICIAL_FEED_TTL_MS = 30 * 60 * 1000;
const OFFICIAL_FEED_MIN_REFRESH_MS = 60 * 1000;
let memOfficialFeed = { payload: null, updatedAt: 0 };

async function fetchFreshOfficialFeed() {
  function extractBalancedObject(src, keyToken) {
    const idx = src.indexOf(keyToken);
    if (idx < 0) return null;
    const start = src.indexOf("{", idx);
    if (start < 0) return null;
    let depth = 0;
    let inStr = false;
    let esc = false;
    for (let i = start; i < src.length; i++) {
      const ch = src[i];
      if (inStr) {
        if (esc) esc = false;
        else if (ch === "\\") esc = true;
        else if (ch === '"') inStr = false;
      } else {
        if (ch === '"') inStr = true;
        else if (ch === "{") depth++;
        else if (ch === "}") {
          depth--;
          if (depth === 0) {
            return src.slice(start, i + 1);
          }
        }
      }
    }
    return null;
  }

  function stripTrailingCommas(jsonLike) {
    let s = jsonLike;
    while (/,\s*[}\]]/.test(s)) {
      s = s.replace(/,(\s*[}\]])/g, "$1");
    }
    return s;
  }

  const normalizeNews = (arr) =>
    (Array.isArray(arr) ? arr : []).slice(0, 10).map((it) => ({
      title: String(it.title || "").trim(),
      url: String(it.url || "").startsWith("http")
        ? String(it.url)
        : `https://nte.perfectworld.com${it.url || ""}`,
      time: String(it.time || ""),
      channel: String(it.channelName || "news"),
    }));

  let newsUrl = "https://nte.perfectworld.com/include/newsData20260112.js";
  let swiperUrl =
    "https://www.perfectworld.com/public/commonData/gamesData/gameSwiper/nte-gameSwiper.js";
  let officialPosters = {};
  let news = { latest: [], gamenews: [], gameevent: [], gamebroad: [] };
  let carousel = [];
  let patchNotes = null;
  let autoEvents = [];

  const ua = { "User-Agent": "Hethereau-Tracker/1.0" };

  // 1) Auto-discover live feed scripts & official character posters from nte.perfectworld.com/en/main.html
  const mainRes = await fetch("https://nte.perfectworld.com/en/main.html", { headers: ua });
  if (mainRes.ok) {
    const mainHtml = await mainRes.text();
    const foundNews = mainHtml.match(
      /https?:\/\/nte\.perfectworld\.com\/include\/newsData[^"'\s]+\.js/i
    );
    if (foundNews?.[0]) newsUrl = foundNews[0];

    const foundSwiper = mainHtml.match(
      /https?:\/\/[^"'\s]+nte-gameSwiper[^"'\s]*\.js/i
    );
    if (foundSwiper?.[0]) swiperUrl = foundSwiper[0];

    const posterMatches = mainHtml.matchAll(
      /https?:\/\/nte\.perfectworld\.com\/public\/m\/images\/[^"'\s]+\/role-poster-([a-z0-9_-]+)\.png/gi
    );
    for (const m of posterMatches) {
      officialPosters[m[1].toLowerCase()] = m[0];
    }
  }

  // 2) Fetch official newsData + promo carousel in parallel
  const [newsRes, swiperRes] = await Promise.all([
    fetch(newsUrl, { headers: ua }),
    fetch(swiperUrl, { headers: ua }),
  ]);

  if (newsRes.ok) {
    const txt = await newsRes.text();
    const enRaw = extractBalancedObject(txt, '"en"');
    if (enRaw) {
      const enObj = JSON.parse(stripTrailingCommas(enRaw));
      news = {
        latest: normalizeNews(enObj.news),
        gamenews: normalizeNews(enObj.gamenews),
        gameevent: normalizeNews(enObj.gameevent),
        gamebroad: normalizeNews(enObj.gamebroad),
      };
    }
  }

  if (swiperRes.ok) {
    const swTxt = await swiperRes.text();
    const clean = stripTrailingCommas(
      swTxt.replace(/^\s*var\s+nte_data_data\s*=\s*/, "").replace(/;\s*$/, "")
    );
    const swObj = JSON.parse(clean);
    const list = Array.isArray(swObj.lb1_en) ? swObj.lb1_en : [];
    carousel = list
      .filter((x) => x && x.bigpic)
      .map((x) => ({
        image: String(x.bigpic),
        link: String(x.link || x.mlink || "https://nte.perfectworld.com/en/main.html"),
        title: String(x.title || ""),
      }));
  }

  // 3) Auto-fetch & parse the latest official Patch Notes for dynamic version events & dates
  const latestPatch = (news.gamenews || []).find((n) =>
    /patch\s*notes|version\s+\d+\.\d+|ver\.\s*\d+\.\d+/i.test(n.title)
  );
  if (latestPatch?.url) {
    const verMatch = latestPatch.title.match(/(?:Version|Ver\.)\s*(\d+\.\d+)/i);
    patchNotes = {
      version: verMatch ? verMatch[1] : "",
      title: latestPatch.title,
      url: latestPatch.url,
      time: latestPatch.time,
    };
    const patchRes = await fetch(latestPatch.url, { headers: ua });
    if (patchRes.ok) {
      const patchHtml = await patchRes.text();
      autoEvents = parseOfficialPatchNotesHtml(
        patchHtml,
        latestPatch.url,
        latestPatch.time
      );
    }
  }

  const hasContent =
    Object.keys(officialPosters).length > 0 ||
    news.gamenews.length > 0 ||
    carousel.length > 0;

  return {
    hasContent,
    payload: JSON.stringify({
      fetchedAt: new Date().toISOString(),
      refreshIntervalMinutes: 30,
      source: "nte.perfectworld.com",
      patchNotes,
      officialPosters,
      autoEvents,
      news,
      carousel,
    }),
  };
}

async function refreshOfficialFeedSnapshot(env) {
  const staffStub = env.STAFF_TELEMETRY_DO.getByName("staff:global");
  try {
    const fresh = await fetchFreshOfficialFeed();
    if (fresh.hasContent) {
      const now = Date.now();
      memOfficialFeed = { payload: fresh.payload, updatedAt: now };
      await staffStub.setOfficialFeedCache(fresh.payload);
      return { payload: fresh.payload, cacheStatus: "REFRESH" };
    }
  } catch (err) {
    console.error(JSON.stringify({ level: "warn", scope: "official_feed", error: String(err) }));
  }

  // Fallback to last known good snapshot from Durable Object SQLite if Perfect World is briefly unreachable
  const existing = await staffStub.getOfficialFeedCache();
  if (existing?.payload) {
    memOfficialFeed = { payload: existing.payload, updatedAt: existing.updatedAt };
    return { payload: existing.payload, cacheStatus: "STALE-FALLBACK" };
  }

  return {
    payload: JSON.stringify({
      fetchedAt: new Date().toISOString(),
      refreshIntervalMinutes: 30,
      source: "nte.perfectworld.com",
      patchNotes: null,
      officialPosters: {},
      autoEvents: [],
      news: { latest: [], gamenews: [], gameevent: [], gamebroad: [] },
      carousel: [],
    }),
    cacheStatus: "EMPTY",
  };
}

async function handleOfficialFeed(request, env, ctx) {
  const url = new URL(request.url);
  const wantFresh = url.searchParams.get("fresh") === "1";
  const now = Date.now();

  // 1) Fast path: warm isolate memory cache (works reliably on both workers.dev and custom domains)
  if (
    memOfficialFeed.payload &&
    now - memOfficialFeed.updatedAt < OFFICIAL_FEED_TTL_MS &&
    (!wantFresh || now - memOfficialFeed.updatedAt < OFFICIAL_FEED_MIN_REFRESH_MS)
  ) {
    return new Response(memOfficialFeed.payload, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "public, max-age=1800",
        "X-Feed-Cache": "MEM-HIT",
        ...corsHeaders(request),
      },
    });
  }

  // 2) Persistent Durable Object SQLite snapshot (survives cold starts & upstream outages)
  const staffStub = env.STAFF_TELEMETRY_DO.getByName("staff:global");
  const stored = await staffStub.getOfficialFeedCache();
  if (
    stored?.payload &&
    now - stored.updatedAt < OFFICIAL_FEED_TTL_MS &&
    (!wantFresh || now - stored.updatedAt < OFFICIAL_FEED_MIN_REFRESH_MS)
  ) {
    memOfficialFeed = { payload: stored.payload, updatedAt: stored.updatedAt };
    return new Response(stored.payload, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "public, max-age=1800",
        "X-Feed-Cache": "DO-HIT",
        ...corsHeaders(request),
      },
    });
  }

  // 3) Refresh live from official nte.perfectworld.com channels
  const refreshed = await refreshOfficialFeedSnapshot(env);
  return new Response(refreshed.payload, {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=1800",
      "X-Feed-Cache": refreshed.cacheStatus,
      ...corsHeaders(request),
    },
  });
}

export default {
  async scheduled(_controller, env, ctx) {
    ctx.waitUntil(refreshOfficialFeedSnapshot(env));
  },

  async fetch(request, env, ctx) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(request) });
    }

    const url = new URL(request.url);
    try {
      if (request.method === "GET" && url.pathname === "/api/health") {
        return jsonResponse(request, { ok: true, service: "hethereau-stats" });
      }
      if (request.method === "GET" && url.pathname === "/api/official/feed") {
        return await handleOfficialFeed(request, env, ctx);
      }
      if (request.method === "GET" && url.pathname === "/api/stats/global") {
        return await handleGlobalStats(request, env, ctx);
      }
      if (request.method === "POST" && url.pathname === "/api/stats/contribute") {
        return await handleContribute(request, env, ctx);
      }
      if (request.method === "GET" && url.pathname === "/api/stats/staff") {
        return await handleStaffStats(request, env);
      }
      return jsonResponse(request, { error: "Not found" }, 404);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      console.error(
        JSON.stringify({
          level: "error",
          path: url.pathname,
          method: request.method,
          error: msg,
        })
      );
      return jsonResponse(request, { error: "Internal server error" }, 500);
    }
  },
};
