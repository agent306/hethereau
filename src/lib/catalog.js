/**
 * NTE Game Catalog loader & lookup index.
 * Backed by real MIT-licensed mappings from Anong0u0/NTE_Gacha_Exporter & Waifus-Grace/NTE_Assets.
 */

export const POOL_DEFINITIONS = {
  monopoly_limited: {
    key: 'monopoly_limited',
    title: 'Limited Board',
    subtitle: 'Scarborough Fair · Featured S-Class Characters',
    currency: 'Solid Dice',
    costPerPull: 160,
    hardPity: 90,
    softPity: 70,
    softPityLabel: 'Board Mod (70)',
    has5050: false,
    guaranteeNote: '100% Featured S-Class · No 50/50',
    accent: '#a855f7',
    accentSoft: 'rgba(168, 85, 247, 0.16)',
  },
  monopoly_standard: {
    key: 'monopoly_standard',
    title: 'Standard Board',
    subtitle: 'Strange Encounters · Permanent Characters',
    currency: 'Fabricated Dice',
    costPerPull: 160,
    hardPity: 90,
    softPity: 70,
    softPityLabel: 'Board Mod (70)',
    has5050: false,
    guaranteeNote: 'Permanent Board · Carries Over',
    accent: '#38bdf8',
    accentSoft: 'rgba(56, 189, 248, 0.16)',
  },
  fork_lottery: {
    key: 'fork_lottery',
    title: 'Arc Research',
    subtitle: 'Miracle Box · Signature Arcs',
    currency: 'Tri-Keys',
    costPerPull: 160,
    hardPity: 60,
    hardUpPity: 80,
    softPity: null,
    softPityLabel: 'S-Rank Guarantee (60)',
    has5050: true,
    guaranteeNote: '60 S-Rank · 80 Featured Guarantee',
    accent: '#f59e0b',
    accentSoft: 'rgba(245, 158, 11, 0.16)',
  },
  mystery_box: {
    key: 'mystery_box',
    title: 'Mystery Box',
    subtitle: 'Gashapon · Vehicles & Cosmetics',
    currency: 'Mystery Coins',
    costPerPull: 160,
    hardPity: null,
    softPity: null,
    softPityLabel: null,
    has5050: false,
    guaranteeNote: 'Single Pulls · Per-Rotation',
    accent: '#ec4899',
    accentSoft: 'rgba(236, 72, 153, 0.16)',
  },
};

export const POOL_ORDER = [
  'monopoly_limited',
  'monopoly_standard',
  'fork_lottery',
  'mystery_box',
];

export function classifyPoolKey(poolId, recordType, lotteryId) {
  const pid = String(poolId || '').trim();
  const lid = String(lotteryId || '').trim();
  const rtype = String(recordType || '').toLowerCase();

  if (
    pid === 'Gashapon_MysteryBox' ||
    lid === 'Gashapon_MysteryBox' ||
    rtype === 'mystery_box'
  ) {
    return 'mystery_box';
  }
  if (
    pid.startsWith('ForkLottery_') ||
    pid === 'Arc_MiracleBox' ||
    pid === '1' ||
    rtype === 'fork' ||
    rtype === 'arc'
  ) {
    return 'fork_lottery';
  }
  if (
    pid === 'CardPool_NewRole' ||
    pid === 'Lottery_Permanent' ||
    lid === 'Lottery_Permanent'
  ) {
    return 'monopoly_standard';
  }
  if (
    pid === 'CardPool_Character' ||
    pid === 'Lottery_LimitedCharacter' ||
    lid.startsWith('Lottery_') ||
    rtype === 'monopoly'
  ) {
    return 'monopoly_limited';
  }
  return 'monopoly_limited';
}

export function cleanDisplayName(rawName) {
  if (!rawName) return '';
  return String(rawName)
    .replace(/^Character[·・.\-\s]+/i, '')
    .replace(/^Arc[·・.\-\s]+/i, '')
    .trim();
}

export function rarityToRank(rarity) {
  if (rarity >= 5 || rarity === 'S') return 'S';
  if (rarity === 4 || rarity === 'A') return 'A';
  return 'B';
}

export function rankToRarity(rank) {
  if (typeof rank === 'number') return rank;
  const r = String(rank || '').toUpperCase();
  if (r === 'S' || r === '5') return 5;
  if (r === 'A' || r === '4') return 4;
  return 3;
}

export function isCharacterItem(item) {
  return item?.category === 'character' || item?.subtype === 'character';
}

export function isArcItem(item) {
  return (
    item?.category === 'fork' ||
    item?.category === 'arc' ||
    item?.subtype === 'fork' ||
    item?.subtype === 'arc'
  );
}

export class NteCatalog {
  constructor(core = {}, en = {}, occurrences = {}) {
    this.core = core;
    this.en = en;
    this.occurrences = Array.isArray(occurrences.occurrences)
      ? occurrences.occurrences
      : [];

    this.itemsByLower = new Map();
    this.aliasesByLower = new Map();
    this.bannerSources = core.banner_sources || {};
    this.pools = core.pools || {};

    const rawAliases = core.item_aliases || {};
    for (const [alias, canonical] of Object.entries(rawAliases)) {
      this.aliasesByLower.set(alias.toLowerCase(), canonical);
    }

    const rawItems = core.items || {};
    const enItems = en.items || {};
    for (const [id, meta] of Object.entries(rawItems)) {
      const enEntry = enItems[id];
      const fullName =
        typeof enEntry === 'string'
          ? enEntry
          : enEntry?.name || id;
      const category = meta.category || inferCategory(id);
      const entry = {
        id,
        fullName,
        name: cleanDisplayName(fullName) || id,
        rarity: typeof meta.rarity === 'number' ? meta.rarity : 3,
        rank: rarityToRank(meta.rarity),
        category,
        subtype: meta.subtype || '',
        color: meta.color || null,
        avatar: category === 'character' ? `/avatars/${id}.png` : null,
      };
      this.itemsByLower.set(id.toLowerCase(), entry);
    }
  }

  resolveItem(itemId, fallbackName = '', fallbackRarity = null) {
    if (!itemId) {
      return {
        id: 'unknown',
        name: fallbackName || 'Unknown',
        fullName: fallbackName || 'Unknown',
        rarity: rankToRarity(fallbackRarity),
        rank: rarityToRank(rankToRarity(fallbackRarity)),
        category: 'item',
        subtype: '',
        color: null,
        avatar: null,
      };
    }

    const lower = String(itemId).toLowerCase();
    const canonical = this.aliasesByLower.get(lower) || itemId;
    const hit =
      this.itemsByLower.get(String(canonical).toLowerCase()) ||
      this.itemsByLower.get(lower);

    if (hit) return hit;

    const rarity =
      fallbackRarity !== null && fallbackRarity !== undefined
        ? rankToRarity(fallbackRarity)
        : 3;
    const category = inferCategory(itemId);

    return {
      id: itemId,
      name: cleanDisplayName(fallbackName) || itemId,
      fullName: fallbackName || itemId,
      rarity,
      rank: rarityToRank(rarity),
      category,
      subtype: '',
      color: null,
      avatar: category === 'character' ? `/avatars/${itemId}.png` : null,
    };
  }

  resolveBannerTitle(poolId, lotteryId, timestamp) {
    const enBanners = this.en.banner_sources || {};
    const enPools = this.en.pools || {};

    if (lotteryId && enBanners[lotteryId]?.title) {
      return enBanners[lotteryId].title;
    }
    if (poolId && enBanners[poolId]?.title) {
      return enBanners[poolId].title;
    }
    if (poolId && enPools[poolId]?.title) {
      return enPools[poolId].title;
    }

    const poolKey = classifyPoolKey(poolId, '', lotteryId);
    if (poolKey === 'monopoly_limited' && timestamp) {
      const hit = this.occurrences.find((occ) => {
        if (!occ.active_from || !occ.active_until) return false;
        const src = this.bannerSources[occ.source_id];
        if (!src || src.pool_kind !== 'monopoly_limited') return false;
        return timestamp >= occ.active_from && timestamp <= occ.active_until;
      });
      if (hit && enBanners[hit.source_id]?.title) {
        return enBanners[hit.source_id].title;
      }
    }

    if (poolId && enPools[poolId]?.name) {
      return enPools[poolId].name;
    }
    return POOL_DEFINITIONS[poolKey]?.title || poolId || 'Unknown Pool';
  }

  isFeaturedItem(poolId, lotteryId, itemId) {
    const canon = (
      this.aliasesByLower.get(String(itemId || '').toLowerCase()) ||
      String(itemId || '')
    ).toLowerCase();

    const src =
      (lotteryId && this.bannerSources[lotteryId]) ||
      (poolId && this.bannerSources[poolId]);

    if (src) {
      if (src.pool_kind === 'monopoly_limited') {
        return true;
      }
      if (Array.isArray(src.rate_up_5) && src.rate_up_5.length > 0) {
        return src.rate_up_5.some((id) => id.toLowerCase() === canon);
      }
    }

    const pool = poolId && this.pools[poolId];
    if (pool && Array.isArray(pool.pickup_item_ids) && pool.pickup_item_ids.length > 0) {
      return pool.pickup_item_ids.some((id) => id.toLowerCase() === canon);
    }

    return null;
  }

  listSelectableItems() {
    const items = Array.from(this.itemsByLower.values());
    items.sort((a, b) => {
      if (b.rarity !== a.rarity) return b.rarity - a.rarity;
      if (a.category !== b.category) {
        const order = { character: 0, arc: 1, fork: 1, vehicle: 2, cosmetic: 3, item: 4 };
        return (order[a.category] ?? 9) - (order[b.category] ?? 9);
      }
      return a.name.localeCompare(b.name);
    });
    return items;
  }
}

function inferCategory(itemId) {
  const s = String(itemId || '').toLowerCase();
  if (/^\d{4}$/.test(s)) return 'character';
  if (s.startsWith('fork_')) return 'fork';
  if (s.includes('vehicle')) return 'vehicle';
  if (s.includes('fashion') || s.includes('card') || s.includes('skin')) return 'cosmetic';
  return 'item';
}

let cachedCatalog = null;

export async function loadCatalog() {
  if (cachedCatalog) return cachedCatalog;
  const [coreRes, enRes, occRes] = await Promise.all([
    fetch('/data/core.json'),
    fetch('/data/en.json'),
    fetch('/data/banner-occurrences.json'),
  ]);
  const [core, en, occ] = await Promise.all([
    coreRes.json(),
    enRes.json(),
    occRes.json(),
  ]);
  cachedCatalog = new NteCatalog(core, en, occ);
  return cachedCatalog;
}
