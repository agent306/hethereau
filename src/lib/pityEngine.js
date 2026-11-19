/**
 * NTE Scarborough Fair Pity Engine & Deterministic Merge.
 *
 * Verified against live NTE game rules & Anong0u0/nte-core (`derived.rs`):
 * - Monopoly Limited Board (`monopoly_limited`): 90 hard pity, 70 Board Modification soft pity,
 *   100% featured S-Class Character (no 50/50). ONLY `category === "character"` resets Character
 *   S-Rank pity -- S-rarity skins, gliders, vehicle mod parts, and Solid Dice do NOT reset it!
 * - Monopoly Standard Board (`monopoly_standard`): 90 hard pity; ONLY S-Class Characters reset pity.
 * - Arc Research (`fork_lottery`): 60 S-Rank / 80 featured guarantee; ONLY Arcs (`fork`) reset pity.
 * - Mystery Box (`mystery_box`): single pulls per rotation; any S-rarity drop counts.
 * - Monopoly bonus rows (`Points Gift`, `Slumberland` / `Chase Reward`) stay in the log but DO NOT
 *   advance pull/pity counters.
 */

import {
  POOL_DEFINITIONS,
  POOL_ORDER,
  classifyPoolKey,
  isCharacterItem,
  isArcItem,
} from './catalog.js';
import { isNonPityBonusRow } from './formats.js';

/**
 * Returns the pity-affecting rarity (5 or 4) ONLY if the item belongs to that pool's pity domain.
 * Non-character S-rarity tile rewards on Monopoly boards (Solid Dice, Outfits, Mod Parts) return null!
 */
export function hitRarityForPity(item, poolKey) {
  if (!item || typeof item.rarity !== 'number') return null;
  if (item.rarity < 4) return null;

  if (poolKey === 'monopoly_limited' || poolKey === 'monopoly_standard') {
    return isCharacterItem(item) ? item.rarity : null;
  }
  if (poolKey === 'fork_lottery') {
    return isArcItem(item) ? item.rarity : null;
  }
  // Mystery Box: any S/A drop
  return item.rarity;
}

/**
 * Computes the S-Class success probability (%) for the NEXT roll (`currentSPity + 1`).
 * - Scarborough Fair Monopoly Boards:
 *     Pulls 1-70  (currentSPity 0..69)  -> 0.99% base
 *     Pulls 71-89 (currentSPity 70..88) -> 19.59% Board Modification soft pity
 *     Pull 90     (currentSPity >= 89)  -> 100% hard pity
 * - Arc Research (fork_lottery):
 *     Pulls 1-59  (currentSPity 0..58)  -> 3.0% base per pull
 *     Pull 60     (currentSPity >= 59)  -> 100% hard pity
 */
export function getNextPullChance(poolKey, currentSPity = 0) {
  const pity = Math.max(0, Number(currentSPity) || 0);
  if (poolKey === 'monopoly_limited' || poolKey === 'monopoly_standard') {
    if (pity >= 89) {
      return { percent: 100, label: '100%', tier: 'hard' };
    }
    if (pity >= 70) {
      return { percent: 19.59, label: '19.59%', tier: 'soft' };
    }
    return { percent: 0.99, label: '0.99%', tier: 'base' };
  }
  if (poolKey === 'fork_lottery') {
    if (pity >= 59) {
      return { percent: 100, label: '100%', tier: 'hard' };
    }
    return { percent: 3, label: '3.0%', tier: 'base' };
  }
  return null;
}

export function mergePullRecords(existing = [], incoming = []) {
  const byId = new Map();
  for (const rec of existing) {
    byId.set(rec.id, rec);
  }

  let added = 0;
  let duplicates = 0;

  for (const rec of incoming) {
    const prev = byId.get(rec.id);
    if (!prev) {
      byId.set(rec.id, rec);
      added++;
    } else {
      duplicates++;
      if (!prev.lottery_id && rec.lottery_id) {
        byId.set(rec.id, { ...prev, lottery_id: rec.lottery_id });
      }
    }
  }

  const merged = Array.from(byId.values());
  return { merged, added, duplicates };
}

export function sortChronological(records) {
  return [...records].sort((a, b) => {
    const ta = a.time || '';
    const tb = b.time || '';
    if (ta !== tb) return ta.localeCompare(tb);
    const oa = typeof a.sourceOrder === 'number' ? a.sourceOrder : 0;
    const ob = typeof b.sourceOrder === 'number' ? b.sourceOrder : 0;
    if (oa !== ob) return ob - oa;
    return String(a.id).localeCompare(String(b.id));
  });
}

export function analyzeAccountPulls(rawRecords = [], catalog) {
  const byPool = {};
  for (const key of POOL_ORDER) {
    byPool[key] = [];
  }

  for (const rec of rawRecords) {
    const poolKey = rec.poolKey || classifyPoolKey(rec.pool_id, rec.record_type, rec.lottery_id);
    if (!byPool[poolKey]) byPool[poolKey] = [];
    byPool[poolKey].push({ ...rec, poolKey });
  }

  const pools = {};
  const allEnriched = [];
  let grandTotalPulls = 0;
  let grandTotalBonusRows = 0;
  let grandTotalSRanks = 0;
  let grandTotalSRankNonPity = 0;
  let grandTotalARanks = 0;

  for (const poolKey of POOL_ORDER) {
    const def = POOL_DEFINITIONS[poolKey];
    const chrono = sortChronological(byPool[poolKey] || []);
    const isMonopoly = poolKey === 'monopoly_limited' || poolKey === 'monopoly_standard';

    let totalPulls = 0;
    let bonusRows = 0;
    let sPity = 0;
    let aPity = 0;
    let arcGuaranteedNext = false;
    let arcWins = 0;
    let arcLosses = 0;

    // Pity-resetting S-ranks (Characters on Monopoly, Arcs on Fork, S-items on Mystery Box)
    const sRankHistory = [];
    // All S-rarity drops including skins/gliders/mod parts/Solid Dice
    const allSRankHistory = [];
    const aRankHistory = [];
    const enrichedChrono = [];
    const maxBin = def.hardPity || 90;
    const pityHistogram = new Array(maxBin + 1).fill(0);

    for (const rec of chrono) {
      const item = catalog
        ? catalog.resolveItem(rec.item_id, rec.item_name_hint, rec.rarity_hint)
        : {
            id: rec.item_id,
            name: rec.item_name_hint || rec.item_id,
            rarity: rec.rarity_hint || 3,
            rank: (rec.rarity_hint || 3) >= 5 ? 'S' : (rec.rarity_hint || 3) === 4 ? 'A' : 'B',
            category: /^\d{4}$/.test(String(rec.item_id)) ? 'character' : 'item',
            subtype: '',
            color: null,
            avatar: null,
          };

      const bannerTitle = catalog
        ? catalog.resolveBannerTitle(rec.pool_id, rec.lottery_id, rec.time)
        : def.title;

      const isBonus = rec.isBonus ?? isNonPityBonusRow(rec);
      const pityHitRarity = isBonus ? null : hitRarityForPity(item, poolKey);
      let pullPity = null;
      let rateStatus = null;

      if (isBonus) {
        bonusRows++;
      } else {
        totalPulls++;
        sPity++;

        if (isMonopoly) {
          aPity = totalPulls % 10;
        } else {
          aPity = Math.min(10, aPity + 1);
        }

        if (pityHitRarity === 5) {
          pullPity = sPity;
          if (pullPity <= maxBin) {
            pityHistogram[pullPity]++;
          }

          if (poolKey === 'monopoly_limited') {
            rateStatus = 'featured';
          } else if (poolKey === 'fork_lottery') {
            const featured = catalog
              ? catalog.isFeaturedItem(rec.pool_id, rec.lottery_id, item.id)
              : null;
            if (arcGuaranteedNext) {
              rateStatus = 'guaranteed';
              arcGuaranteedNext = false;
            } else if (featured === true) {
              rateStatus = 'featured';
              arcWins++;
            } else if (featured === false) {
              rateStatus = 'off_rate';
              arcLosses++;
              arcGuaranteedNext = true;
            }
          } else if (poolKey === 'monopoly_standard') {
            rateStatus = 'standard';
          }

          sPity = 0;
          if (!isMonopoly) aPity = 0;
        } else if (pityHitRarity === 4) {
          pullPity = isMonopoly ? ((totalPulls - 1) % 10) + 1 : aPity;
          if (!isMonopoly) aPity = 0;
        }
      }

      const isPityResetS = !isBonus && pityHitRarity === 5;
      const isAnyS = !isBonus && item.rarity >= 5;

      const enriched = {
        ...rec,
        poolKey,
        isBonus,
        isPityResetS,
        pityHitRarity,
        item,
        bannerTitle,
        pityAtPull: pullPity,
        // Current running S-pity at the moment of drop (useful for viewing non-pity S-items like skins/dice)
        sPityAtMoment: isBonus ? null : isPityResetS ? pullPity : sPity,
        rateStatus,
        pullIndex: isBonus ? null : totalPulls,
      };

      enrichedChrono.push(enriched);

      if (isPityResetS) {
        sRankHistory.push(enriched);
      }
      if (isAnyS) {
        allSRankHistory.push(enriched);
      }
      if (!isBonus && pityHitRarity === 4) {
        aRankHistory.push(enriched);
      }
    }

    const avgSPity =
      sRankHistory.length > 0
        ? sRankHistory.reduce((sum, x) => sum + (x.pityAtPull || 0), 0) / sRankHistory.length
        : 0;

    const sRatePct = totalPulls > 0 ? (sRankHistory.length / totalPulls) * 100 : 0;
    const nonPitySCount = allSRankHistory.length - sRankHistory.length;

    pools[poolKey] = {
      definition: def,
      totalPulls,
      bonusRows,
      currencySpent: totalPulls * def.costPerPull,
      currentSPity: sPity,
      currentAPity: aPity,
      inSoftPity: Boolean(def.softPity && sPity >= def.softPity),
      nextSRankChance: getNextPullChance(poolKey, sPity),
      guaranteedNext: poolKey === 'monopoly_limited' ? true : arcGuaranteedNext,
      arcWins,
      arcLosses,
      sRankCount: sRankHistory.length,
      allSRankCount: allSRankHistory.length,
      nonPitySCount,
      aRankCount: aRankHistory.length,
      avgSPity,
      sRatePct,
      sRankHistory: [...sRankHistory].reverse(),
      allSRankHistory: [...allSRankHistory].reverse(),
      pityHistogram,
      records: [...enrichedChrono].reverse(),
    };

    grandTotalPulls += totalPulls;
    grandTotalBonusRows += bonusRows;
    grandTotalSRanks += sRankHistory.length;
    grandTotalSRankNonPity += nonPitySCount;
    grandTotalARanks += aRankHistory.length;
    allEnriched.push(...enrichedChrono);
  }

  allEnriched.sort((a, b) => {
    const ta = a.time || '';
    const tb = b.time || '';
    if (ta !== tb) return tb.localeCompare(ta);
    const oa = typeof a.sourceOrder === 'number' ? a.sourceOrder : 0;
    const ob = typeof b.sourceOrder === 'number' ? b.sourceOrder : 0;
    return oa - ob;
  });

  return {
    pools,
    allRecords: allEnriched,
    totals: {
      pulls: grandTotalPulls,
      bonusRows: grandTotalBonusRows,
      anulith: grandTotalPulls * 160,
      sRanks: grandTotalSRanks,
      sRankExtras: grandTotalSRankNonPity,
      aRanks: grandTotalARanks,
    },
  };
}
