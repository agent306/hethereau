import { DurableObject } from "cloudflare:workers";
import { CATALOG_BANNERS, CATALOG_ITEMS } from "./catalogWhitelist.js";

/**
 * PoolStatsDO — One SQLite-backed Durable Object per NTE banner pool
 * (`pool:monopoly_limited`, `pool:monopoly_standard`, `pool:fork_lottery`, `pool:mystery_box`).
 *
 * Stores deduplicated, server-validated anonymized pull aggregates atomically in SQLite.
 * Never stores user emails, UIDs, raw tokens, or IP addresses.
 */
export class PoolStatsDO extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      this.ctx.storage.sql.exec(`
        CREATE TABLE IF NOT EXISTS seen_records (
          record_hash TEXT PRIMARY KEY,
          first_seen_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS pool_totals (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          total_pulls INTEGER NOT NULL DEFAULT 0,
          bonus_rows INTEGER NOT NULL DEFAULT 0,
          s_rank_pity_hits INTEGER NOT NULL DEFAULT 0,
          s_rank_pity_measured INTEGER NOT NULL DEFAULT 0,
          s_rank_all_hits INTEGER NOT NULL DEFAULT 0,
          a_rank_hits INTEGER NOT NULL DEFAULT 0,
          b_rank_hits INTEGER NOT NULL DEFAULT 0,
          pity_sum INTEGER NOT NULL DEFAULT 0,
          early_hits INTEGER NOT NULL DEFAULT 0,
          soft_pity_hits INTEGER NOT NULL DEFAULT 0,
          hard_pity_hits INTEGER NOT NULL DEFAULT 0,
          updated_at INTEGER NOT NULL DEFAULT 0
        );

        INSERT OR IGNORE INTO pool_totals (id) VALUES (1);

        CREATE TABLE IF NOT EXISTS pity_histogram (
          pity INTEGER PRIMARY KEY,
          count INTEGER NOT NULL DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS item_counts (
          item_id TEXT PRIMARY KEY,
          item_name TEXT NOT NULL,
          category TEXT NOT NULL,
          rank TEXT NOT NULL,
          count INTEGER NOT NULL DEFAULT 0,
          is_pity_s INTEGER NOT NULL DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS banner_counts (
          banner_id TEXT PRIMARY KEY,
          banner_title TEXT NOT NULL,
          total_pulls INTEGER NOT NULL DEFAULT 0,
          s_hits INTEGER NOT NULL DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS daily_counts (
          day TEXT PRIMARY KEY,
          pulls INTEGER NOT NULL DEFAULT 0,
          s_hits INTEGER NOT NULL DEFAULT 0
        );
      `);
    });
  }

  /**
   * Atomically ingests a batch of server-validated records for this pool.
   * Deduplicates globally by `recordHash` so re-imports never double-count.
   */
  async ingestBatch(poolKey, records) {
    const now = Date.now();
    const isMonopoly =
      poolKey === "monopoly_limited" || poolKey === "monopoly_standard";
    const softPityStart = isMonopoly ? 70 : null;
    const hardPityMark = isMonopoly ? 90 : poolKey === "fork_lottery" ? 60 : null;

    let accepted = 0;
    let duplicates = 0;

    this.ctx.storage.transactionSync(() => {
      let deltaPulls = 0;
      let deltaBonus = 0;
      let deltaSPityHits = 0;
      let deltaSPityMeasured = 0;
      let deltaSAllHits = 0;
      let deltaAHits = 0;
      let deltaBHits = 0;
      let deltaPitySum = 0;
      let deltaEarly = 0;
      let deltaSoft = 0;
      let deltaHard = 0;

      for (const rec of records) {
        const res = this.ctx.storage.sql.exec(
          "INSERT OR IGNORE INTO seen_records (record_hash, first_seen_at) VALUES (?, ?)",
          rec.recordHash,
          now
        );
        if (res.rowsWritten === 0) {
          duplicates++;
          continue;
        }
        accepted++;

        if (rec.isBonus) {
          deltaBonus++;
        } else {
          deltaPulls++;
          if (rec.rank === "S") {
            deltaSAllHits++;
          } else if (rec.rank === "A") {
            deltaAHits++;
          } else {
            deltaBHits++;
          }

          if (rec.isPityResetS) {
            deltaSPityHits++;
            if (
              typeof rec.verifiedPity === "number" &&
              rec.verifiedPity >= 1 &&
              rec.verifiedPity <= (hardPityMark || 90)
            ) {
              const p = Math.floor(rec.verifiedPity);
              deltaSPityMeasured++;
              deltaPitySum += p;
              if (hardPityMark && p >= hardPityMark) {
                deltaHard++;
              } else if (softPityStart && p >= softPityStart) {
                deltaSoft++;
              } else {
                deltaEarly++;
              }
              this.ctx.storage.sql.exec(
                `INSERT INTO pity_histogram (pity, count) VALUES (?, 1)
                 ON CONFLICT(pity) DO UPDATE SET count = count + 1`,
                p
              );
            }
          }

          if (rec.bannerId) {
            this.ctx.storage.sql.exec(
              `INSERT INTO banner_counts (banner_id, banner_title, total_pulls, s_hits)
               VALUES (?, ?, 1, ?)
               ON CONFLICT(banner_id) DO UPDATE SET
                 banner_title = excluded.banner_title,
                 total_pulls = total_pulls + 1,
                 s_hits = s_hits + excluded.s_hits`,
              rec.bannerId,
              rec.bannerTitle || rec.bannerId,
              rec.isPityResetS ? 1 : 0
            );
          }

          if (rec.day) {
            this.ctx.storage.sql.exec(
              `INSERT INTO daily_counts (day, pulls, s_hits)
               VALUES (?, 1, ?)
               ON CONFLICT(day) DO UPDATE SET
                 pulls = pulls + 1,
                 s_hits = s_hits + excluded.s_hits`,
              rec.day,
              rec.isPityResetS ? 1 : 0
            );
          }
        }

        if (rec.itemId) {
          this.ctx.storage.sql.exec(
            `INSERT INTO item_counts (item_id, item_name, category, rank, count, is_pity_s)
             VALUES (?, ?, ?, ?, 1, ?)
             ON CONFLICT(item_id) DO UPDATE SET
               item_name = excluded.item_name,
               category = excluded.category,
               rank = excluded.rank,
               count = count + 1,
               is_pity_s = MAX(is_pity_s, excluded.is_pity_s)`,
            rec.itemId,
            rec.itemName || rec.itemId,
            rec.category || "item",
            rec.rank || "B",
            rec.isPityResetS ? 1 : 0
          );
        }
      }

      if (accepted > 0) {
        this.ctx.storage.sql.exec(
          `UPDATE pool_totals SET
            total_pulls = total_pulls + ?,
            bonus_rows = bonus_rows + ?,
            s_rank_pity_hits = s_rank_pity_hits + ?,
            s_rank_pity_measured = s_rank_pity_measured + ?,
            s_rank_all_hits = s_rank_all_hits + ?,
            a_rank_hits = a_rank_hits + ?,
            b_rank_hits = b_rank_hits + ?,
            pity_sum = pity_sum + ?,
            early_hits = early_hits + ?,
            soft_pity_hits = soft_pity_hits + ?,
            hard_pity_hits = hard_pity_hits + ?,
            updated_at = ?
          WHERE id = 1`,
          deltaPulls,
          deltaBonus,
          deltaSPityHits,
          deltaSPityMeasured,
          deltaSAllHits,
          deltaAHits,
          deltaBHits,
          deltaPitySum,
          deltaEarly,
          deltaSoft,
          deltaHard,
          now
        );
      }
    });

    return { poolKey, accepted, duplicates };
  }

  async getPublicSummary() {
    const totals = this.ctx.storage.sql
      .exec("SELECT * FROM pool_totals WHERE id = 1")
      .one();

    const histRows = this.ctx.storage.sql
      .exec("SELECT pity, count FROM pity_histogram ORDER BY pity ASC")
      .toArray();

    const topSItems = this.ctx.storage.sql
      .exec(
        `SELECT item_id, item_name, category, rank, count, is_pity_s
         FROM item_counts
         WHERE rank = 'S'
         ORDER BY is_pity_s DESC, count DESC
         LIMIT 24`
      )
      .toArray()
      .map((row) => ({
        ...row,
        item_name:
          CATALOG_ITEMS[row.item_id]?.[0] ||
          (row.item_name === "[object Object]" ? row.item_id : row.item_name),
      }));

    const topAItems = this.ctx.storage.sql
      .exec(
        `SELECT item_id, item_name, category, rank, count
         FROM item_counts
         WHERE rank = 'A'
         ORDER BY count DESC
         LIMIT 16`
      )
      .toArray()
      .map((row) => ({
        ...row,
        item_name:
          CATALOG_ITEMS[row.item_id]?.[0] ||
          (row.item_name === "[object Object]" ? row.item_id : row.item_name),
      }));

    const banners = this.ctx.storage.sql
      .exec(
        `SELECT banner_id, banner_title, total_pulls, s_hits
         FROM banner_counts
         ORDER BY total_pulls DESC
         LIMIT 16`
      )
      .toArray()
      .map((row) => ({
        ...row,
        banner_title:
          CATALOG_BANNERS[row.banner_id] ||
          (row.banner_title === "[object Object]" ? row.banner_id : row.banner_title),
      }));

    const histogram = {};
    for (const r of histRows) {
      histogram[r.pity] = r.count;
    }

    const totalPulls = totals.total_pulls || 0;
    const sPityHits = totals.s_rank_pity_hits || 0;
    const sPityMeasured = totals.s_rank_pity_measured || 0;
    const avgSPity = sPityMeasured > 0 ? totals.pity_sum / sPityMeasured : 0;
    const sRatePct = totalPulls > 0 ? (sPityHits / totalPulls) * 100 : 0;

    return {
      totalPulls,
      bonusRows: totals.bonus_rows || 0,
      sRankPityHits: sPityHits,
      sRankPityMeasured: sPityMeasured,
      sRankAllHits: totals.s_rank_all_hits || 0,
      aRankHits: totals.a_rank_hits || 0,
      bRankHits: totals.b_rank_hits || 0,
      avgSPity: Number(avgSPity.toFixed(2)),
      sRatePct: Number(sRatePct.toFixed(3)),
      earlyHits: totals.early_hits || 0,
      softPityHits: totals.soft_pity_hits || 0,
      hardPityHits: totals.hard_pity_hits || 0,
      updatedAt: totals.updated_at || 0,
      histogram,
      topSItems,
      topAItems,
      banners,
    };
  }

  async getStaffDetail() {
    const summary = await this.getPublicSummary();
    const seenCount = this.ctx.storage.sql
      .exec("SELECT COUNT(*) AS cnt FROM seen_records")
      .one().cnt;
    const distinctItems = this.ctx.storage.sql
      .exec("SELECT COUNT(*) AS cnt FROM item_counts")
      .one().cnt;
    const daily = this.ctx.storage.sql
      .exec(
        `SELECT day, pulls, s_hits
         FROM daily_counts
         ORDER BY day DESC
         LIMIT 30`
      )
      .toArray()
      .reverse();

    return {
      ...summary,
      seenRecordHashes: seenCount,
      distinctItems,
      daily,
    };
  }
}

/**
 * StaffTelemetryDO — Operational, Rate-Limiting & Abuse-Defense Telemetry Store.
 *
 * Security notes:
 * - Rate limits use irreversible daily-rotating salted IP hashes (NEVER stores raw IPs).
 * - Tracks unique contributors, deduplication ratio, country breakdown (cf.country),
 *   source mix, recent accepted submissions, AND blocked/quarantined abuse attempts.
 * - Strictly gated behind verified Google Staff OAuth (masigning@gmail.com) or STAFF_SECRET.
 */
export class StaffTelemetryDO extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      this.ctx.storage.sql.exec(`
        CREATE TABLE IF NOT EXISTS rate_limits (
          bucket_key TEXT PRIMARY KEY,
          req_count INTEGER NOT NULL DEFAULT 0,
          pull_count INTEGER NOT NULL DEFAULT 0,
          expires_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS contributors (
          contributor_hash TEXT PRIMARY KEY,
          first_seen_at INTEGER NOT NULL,
          last_seen_at INTEGER NOT NULL,
          submissions INTEGER NOT NULL DEFAULT 0,
          total_accepted INTEGER NOT NULL DEFAULT 0,
          total_duplicates INTEGER NOT NULL DEFAULT 0,
          last_source TEXT NOT NULL DEFAULT 'unknown',
          last_region TEXT NOT NULL DEFAULT 'Global',
          last_country TEXT NOT NULL DEFAULT 'XX'
        );

        CREATE TABLE IF NOT EXISTS submission_events (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          created_at INTEGER NOT NULL,
          contributor_hash TEXT NOT NULL,
          source TEXT NOT NULL,
          format TEXT NOT NULL,
          region TEXT NOT NULL,
          country TEXT NOT NULL,
          submitted_count INTEGER NOT NULL,
          accepted_count INTEGER NOT NULL,
          duplicate_count INTEGER NOT NULL,
          pools_json TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS blocked_events (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          created_at INTEGER NOT NULL,
          reason TEXT NOT NULL,
          detail TEXT NOT NULL,
          contributor_hash TEXT NOT NULL,
          country TEXT NOT NULL,
          record_count INTEGER NOT NULL DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS daily_telemetry (
          day TEXT PRIMARY KEY,
          submissions INTEGER NOT NULL DEFAULT 0,
          accepted_pulls INTEGER NOT NULL DEFAULT 0,
          duplicate_pulls INTEGER NOT NULL DEFAULT 0,
          blocked_attempts INTEGER NOT NULL DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS country_counts (
          country TEXT PRIMARY KEY,
          submissions INTEGER NOT NULL DEFAULT 0,
          accepted_pulls INTEGER NOT NULL DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS source_counts (
          source TEXT PRIMARY KEY,
          submissions INTEGER NOT NULL DEFAULT 0,
          accepted_pulls INTEGER NOT NULL DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS official_feed_cache (
          cache_key TEXT PRIMARY KEY,
          payload TEXT NOT NULL,
          updated_at INTEGER NOT NULL
        );
      `);
    });
  }

  /**
   * Atomically checks & increments hourly + daily rate limits for a salted IP hash
   * and contributor hash before any Durable Object write occurs.
   */
  async checkRateLimit(ipHash, contributorHash, requestedPulls) {
    const now = Date.now();
    const hourWindow = Math.floor(now / 3_600_000);
    const dayWindow = new Date(now).toISOString().slice(0, 10);

    const ipHourKey = `iph:${ipHash}:${hourWindow}`;
    const ipDayKey = `ipd:${ipHash}:${dayWindow}`;
    const contribDayKey = `cd:${contributorHash}:${dayWindow}`;

    const MAX_REQ_PER_HOUR = 12;
    const MAX_REQ_PER_DAY = 40;
    const MAX_PULLS_PER_DAY = 6000;

    let allowed = true;
    let retryAfterSec = 0;
    let reason = "";

    this.ctx.storage.transactionSync(() => {
      // Prune expired buckets opportunistically
      this.ctx.storage.sql.exec("DELETE FROM rate_limits WHERE expires_at < ?", now);

      const getBucket = (key) => {
        const rows = this.ctx.storage.sql
          .exec("SELECT req_count, pull_count FROM rate_limits WHERE bucket_key = ?", key)
          .toArray();
        return rows[0] || { req_count: 0, pull_count: 0 };
      };

      const ipHour = getBucket(ipHourKey);
      const ipDay = getBucket(ipDayKey);
      const cDay = getBucket(contribDayKey);

      if (ipHour.req_count >= MAX_REQ_PER_HOUR) {
        allowed = false;
        retryAfterSec = Math.ceil(((hourWindow + 1) * 3_600_000 - now) / 1000);
        reason = "hourly_request_limit";
        return;
      }
      if (ipDay.req_count >= MAX_REQ_PER_DAY) {
        allowed = false;
        retryAfterSec = 3600;
        reason = "daily_request_limit";
        return;
      }
      if (ipDay.pull_count + requestedPulls > MAX_PULLS_PER_DAY) {
        allowed = false;
        retryAfterSec = 3600;
        reason = "daily_ip_pull_quota";
        return;
      }
      if (contributorHash !== "anon" && cDay.pull_count + requestedPulls > MAX_PULLS_PER_DAY) {
        allowed = false;
        retryAfterSec = 3600;
        reason = "daily_contributor_pull_quota";
        return;
      }

      const bump = (key, ttlMs) => {
        this.ctx.storage.sql.exec(
          `INSERT INTO rate_limits (bucket_key, req_count, pull_count, expires_at)
           VALUES (?, 1, 0, ?)
           ON CONFLICT(bucket_key) DO UPDATE SET req_count = req_count + 1`,
          key,
          now + ttlMs
        );
      };

      bump(ipHourKey, 2 * 3_600_000);
      bump(ipDayKey, 26 * 3_600_000);
      if (contributorHash !== "anon") {
        bump(contribDayKey, 26 * 3_600_000);
      }
    });

    return { allowed, retryAfterSec, reason };
  }

  async recordBlockedAttempt(meta) {
    const now = Date.now();
    const day = new Date(now).toISOString().slice(0, 10);
    const reason = String(meta.reason || "rejected").slice(0, 48);
    const detail = String(meta.detail || "").slice(0, 200);
    const contributorHash = String(meta.contributorHash || "anon").slice(0, 32);
    const country = String(meta.country || "XX").slice(0, 8);
    const recordCount = Number(meta.recordCount || 0);

    this.ctx.storage.transactionSync(() => {
      this.ctx.storage.sql.exec(
        `INSERT INTO blocked_events (created_at, reason, detail, contributor_hash, country, record_count)
         VALUES (?, ?, ?, ?, ?, ?)`,
        now,
        reason,
        detail,
        contributorHash,
        country,
        recordCount
      );
      this.ctx.storage.sql.exec(
        `DELETE FROM blocked_events
         WHERE id NOT IN (SELECT id FROM blocked_events ORDER BY id DESC LIMIT 100)`
      );
      this.ctx.storage.sql.exec(
        `INSERT INTO daily_telemetry (day, submissions, accepted_pulls, duplicate_pulls, blocked_attempts)
         VALUES (?, 0, 0, 0, 1)
         ON CONFLICT(day) DO UPDATE SET blocked_attempts = blocked_attempts + 1`,
        day
      );
    });
    return { ok: true };
  }

  async recordSubmission(meta) {
    const now = Date.now();
    const day = new Date(now).toISOString().slice(0, 10);
    const contributorHash = String(meta.contributorHash || "anon").slice(0, 32);
    const ipHash = String(meta.ipHash || "").slice(0, 32);
    const source = String(meta.source || "unknown").slice(0, 40);
    const format = String(meta.format || "unknown").slice(0, 40);
    const region = String(meta.region || "Global").slice(0, 20);
    const country = String(meta.country || "XX").slice(0, 8);
    const submittedCount = Number(meta.submittedCount || 0);
    const acceptedCount = Number(meta.acceptedCount || 0);
    const duplicateCount = Number(meta.duplicateCount || 0);
    const poolsJson = JSON.stringify(meta.pools || {});

    this.ctx.storage.transactionSync(() => {
      // Credit only genuinely accepted pulls against daily pull quotas
      if (acceptedCount > 0) {
        if (ipHash) {
          this.ctx.storage.sql.exec(
            `UPDATE rate_limits SET pull_count = pull_count + ? WHERE bucket_key = ?`,
            acceptedCount,
            `ipd:${ipHash}:${day}`
          );
        }
        if (contributorHash !== "anon") {
          this.ctx.storage.sql.exec(
            `UPDATE rate_limits SET pull_count = pull_count + ? WHERE bucket_key = ?`,
            acceptedCount,
            `cd:${contributorHash}:${day}`
          );
        }
      }

      this.ctx.storage.sql.exec(
        `INSERT INTO contributors (
           contributor_hash, first_seen_at, last_seen_at, submissions,
           total_accepted, total_duplicates, last_source, last_region, last_country
         ) VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?)
         ON CONFLICT(contributor_hash) DO UPDATE SET
           last_seen_at = excluded.last_seen_at,
           submissions = submissions + 1,
           total_accepted = total_accepted + excluded.total_accepted,
           total_duplicates = total_duplicates + excluded.total_duplicates,
           last_source = excluded.last_source,
           last_region = excluded.last_region,
           last_country = excluded.last_country`,
        contributorHash,
        now,
        now,
        acceptedCount,
        duplicateCount,
        source,
        region,
        country
      );

      this.ctx.storage.sql.exec(
        `INSERT INTO submission_events (
           created_at, contributor_hash, source, format, region, country,
           submitted_count, accepted_count, duplicate_count, pools_json
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        now,
        contributorHash,
        source,
        format,
        region,
        country,
        submittedCount,
        acceptedCount,
        duplicateCount,
        poolsJson
      );

      this.ctx.storage.sql.exec(
        `DELETE FROM submission_events
         WHERE id NOT IN (SELECT id FROM submission_events ORDER BY id DESC LIMIT 200)`
      );

      this.ctx.storage.sql.exec(
        `INSERT INTO daily_telemetry (day, submissions, accepted_pulls, duplicate_pulls, blocked_attempts)
         VALUES (?, 1, ?, ?, 0)
         ON CONFLICT(day) DO UPDATE SET
           submissions = submissions + 1,
           accepted_pulls = accepted_pulls + excluded.accepted_pulls,
           duplicate_pulls = duplicate_pulls + excluded.duplicate_pulls`,
        day,
        acceptedCount,
        duplicateCount
      );

      this.ctx.storage.sql.exec(
        `INSERT INTO country_counts (country, submissions, accepted_pulls)
         VALUES (?, 1, ?)
         ON CONFLICT(country) DO UPDATE SET
           submissions = submissions + 1,
           accepted_pulls = accepted_pulls + excluded.accepted_pulls`,
        country,
        acceptedCount
      );

      this.ctx.storage.sql.exec(
        `INSERT INTO source_counts (source, submissions, accepted_pulls)
         VALUES (?, 1, ?)
         ON CONFLICT(source) DO UPDATE SET
           submissions = submissions + 1,
           accepted_pulls = accepted_pulls + excluded.accepted_pulls`,
        source,
        acceptedCount
      );
    });

    return { ok: true };
  }

  async getPublicContributorCount() {
    const row = this.ctx.storage.sql
      .exec("SELECT COUNT(*) AS contributors FROM contributors")
      .one();
    return row.contributors || 0;
  }

  async getStaffOverview() {
    const now = Date.now();
    const dayAgo = now - 24 * 60 * 60 * 1000;
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000;

    const totals = this.ctx.storage.sql
      .exec(
        `SELECT
           COUNT(*) AS unique_contributors,
           COALESCE(SUM(submissions), 0) AS total_submissions,
           COALESCE(SUM(total_accepted), 0) AS total_accepted,
           COALESCE(SUM(total_duplicates), 0) AS total_duplicates,
           COALESCE(SUM(CASE WHEN submissions > 1 THEN 1 ELSE 0 END), 0) AS returning_contributors,
           COALESCE(SUM(CASE WHEN last_seen_at >= ? THEN 1 ELSE 0 END), 0) AS active_24h,
           COALESCE(SUM(CASE WHEN last_seen_at >= ? THEN 1 ELSE 0 END), 0) AS active_7d
         FROM contributors`,
        dayAgo,
        weekAgo
      )
      .one();

    const blockedTotal = this.ctx.storage.sql
      .exec("SELECT COALESCE(SUM(blocked_attempts), 0) AS cnt FROM daily_telemetry")
      .one().cnt;

    const countries = this.ctx.storage.sql
      .exec(
        `SELECT country, submissions, accepted_pulls
         FROM country_counts
         ORDER BY accepted_pulls DESC, submissions DESC
         LIMIT 25`
      )
      .toArray();

    const sources = this.ctx.storage.sql
      .exec(
        `SELECT source, submissions, accepted_pulls
         FROM source_counts
         ORDER BY accepted_pulls DESC`
      )
      .toArray();

    const daily = this.ctx.storage.sql
      .exec(
        `SELECT day, submissions, accepted_pulls, duplicate_pulls, blocked_attempts
         FROM daily_telemetry
         ORDER BY day DESC
         LIMIT 30`
      )
      .toArray()
      .reverse();

    const recentEvents = this.ctx.storage.sql
      .exec(
        `SELECT id, created_at, contributor_hash, source, format, region, country,
                submitted_count, accepted_count, duplicate_count, pools_json
         FROM submission_events
         ORDER BY id DESC
         LIMIT 50`
      )
      .toArray()
      .map((e) => ({
        ...e,
        pools: (() => {
          try {
            return JSON.parse(e.pools_json || "{}");
          } catch {
            return {};
          }
        })(),
      }));

    const recentBlocked = this.ctx.storage.sql
      .exec(
        `SELECT id, created_at, reason, detail, contributor_hash, country, record_count
         FROM blocked_events
         ORDER BY id DESC
         LIMIT 40`
      )
      .toArray();

    const topContributors = this.ctx.storage.sql
      .exec(
        `SELECT contributor_hash, submissions, total_accepted, total_duplicates,
                last_source, last_region, last_country, last_seen_at
         FROM contributors
         ORDER BY total_accepted DESC
         LIMIT 15`
      )
      .toArray();

    return {
      totals: {
        ...totals,
        blocked_attempts: blockedTotal || 0,
      },
      countries,
      sources,
      daily,
      recentEvents,
      recentBlocked,
      topContributors,
    };
  }

  async getOfficialFeedCache(cacheKey = "default") {
    const rows = this.ctx.storage.sql
      .exec(
        `SELECT payload, updated_at FROM official_feed_cache WHERE cache_key = ?`,
        String(cacheKey || "default")
      )
      .toArray();
    if (!rows.length) return null;
    return {
      payload: String(rows[0].payload || ""),
      updatedAt: Number(rows[0].updated_at || 0),
    };
  }

  async setOfficialFeedCache(payload, cacheKey = "default") {
    const now = Date.now();
    this.ctx.storage.sql.exec(
      `INSERT INTO official_feed_cache (cache_key, payload, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(cache_key) DO UPDATE SET
         payload = excluded.payload,
         updated_at = excluded.updated_at`,
      String(cacheKey || "default"),
      String(payload || ""),
      now
    );
    return { ok: true, updatedAt: now };
  }
}
