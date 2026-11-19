/**
 * Universal importer for NTE pull history JSON payloads.
 * Supports:
 *   1. Zero-Install pktmon importer (`schema: "nte-gacha-export"`, v2.1)
 *   2. Anong0u0/NTE_Gacha_Exporter (`schema: "nte-gacha-export"`, v2.x)
 *   3. Golumpa/nte-exporter (`format: "nte-history-export"`, v1)
 *   4. Hethereau.moe full backup JSON (`format: "hethereau-backup"`)
 */

import { classifyPoolKey, rankToRarity } from './catalog.js';

export function isNonPityBonusRow(record) {
  const labelId = String(record.roll_label_id || '');
  const label = String(record.roll_label || '').toLowerCase();
  const resultType = String(record.result_type || '').toLowerCase();

  if (
    labelId === 'BPUI_LotteryResult_jidianzengli' ||
    labelId === 'BPUI_LotteryResult_chenmiandi'
  ) {
    return true;
  }
  if (
    label === 'points gift' ||
    label === 'slumberland' ||
    label === 'chase reward' ||
    resultType === 'points_gift' ||
    resultType === 'chase_reward'
  ) {
    return true;
  }
  return false;
}

function stableFallbackId(rec, idx) {
  const raw = [
    rec.poolKey,
    rec.time || '',
    rec.item_id || '',
    rec.count || 1,
    rec.roll_points ?? '',
    rec.roll_label_id || rec.roll_label || '',
    idx,
  ].join('|');
  // Simple FNV-1a 64-bit style hex fallback when an external file lacks record_id
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < raw.length; i++) {
    const c = raw.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ (c + i), 0x85ebca6b) >>> 0;
  }
  return h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0');
}

export function normalizeExternalJson(input) {
  let parsed = input;
  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (!trimmed) {
      throw new Error('Input is empty. Paste JSON from the PowerShell importer or upload a file.');
    }
    try {
      parsed = JSON.parse(trimmed);
    } catch (err) {
      throw new Error(`Invalid JSON: ${err.message}`);
    }
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('JSON root must be an object or array.');
  }

  // Case 1: Anong0u0 / Zero-Install pktmon (`info.schema === "nte-gacha-export"` or `nte.list`)
  if (parsed.nte && Array.isArray(parsed.nte.list)) {
    const source = parsed.info?.source || 'nte-gacha-export';
    const records = parsed.nte.list.map((row, index) => {
      const poolId = row.pool_id || 'CardPool_Character';
      const lotteryId = row.lottery_id || row.banner_id || null;
      const recordType = row.record_type || 'monopoly';
      const poolKey = classifyPoolKey(poolId, recordType, lotteryId);
      const norm = {
        id: row.record_id || '',
        sourceOrder: typeof row.source_order === 'number' ? row.source_order : index,
        record_type: recordType,
        time: normalizeTimeString(row.time),
        pool_id: poolId,
        poolKey,
        lottery_id: lotteryId,
        item_id: String(row.item_id || ''),
        item_name_hint: row.item_name || '',
        rarity_hint: row.rarity ?? null,
        count: Number(row.count) || 1,
        roll_points: row.roll_points ?? null,
        roll_label_id: row.roll_label_id || null,
        roll_label: row.roll_label || null,
        secondary_item_id: row.secondary_item_id || null,
        secondary_count: row.secondary_count ?? null,
        source,
      };
      if (!norm.id) norm.id = stableFallbackId(norm, index);
      norm.isBonus = isNonPityBonusRow(norm);
      return norm;
    });

    return {
      format: source === 'pktmon_zero_install' ? 'Zero-Install pktmon (v2.1)' : 'NTE Gacha Export (v2.1)',
      records,
      meta: parsed.info || {},
    };
  }

  // Case 2: Golumpa/nte-exporter v1 (`format === "nte-history-export"` or `records: []`)
  if (parsed.format === 'nte-history-export' || Array.isArray(parsed.records)) {
    const defaultPool = parsed.banner?.id || 'Lottery_LimitedCharacter';
    const system = String(parsed.banner?.system || 'Monopoly').toLowerCase();
    const records = (parsed.records || []).map((row, index) => {
      const poolId = row.pool_group_id || defaultPool;
      const recordType =
        row.source_type === 'mystery_box'
          ? 'mystery_box'
          : row.source_type === 'miracle_box' || system === 'gashapon'
            ? 'fork'
            : 'monopoly';
      const poolKey = classifyPoolKey(poolId, recordType, null);

      let rollLabelId = null;
      let rollLabel = null;
      let rollPoints = null;
      const rtype = String(row.result_type || '').toLowerCase();
      if (rtype === 'points_gift' || row.roll_result === 0) {
        rollLabelId = 'BPUI_LotteryResult_jidianzengli';
        rollLabel = 'Points Gift';
      } else if (rtype === 'chase_reward') {
        rollLabelId = 'BPUI_LotteryResult_chenmiandi';
        rollLabel = 'Slumberland';
      } else if (typeof row.roll_result === 'number' && row.roll_result > 0) {
        rollPoints = row.roll_result;
        rollLabel = String(row.roll_result);
      }

      const norm = {
        id: row.uid || '',
        sourceOrder: index,
        record_type: recordType,
        time: normalizeTimeString(row.timestamp),
        pool_id: poolId,
        poolKey,
        lottery_id: null,
        item_id: String(row.reward_id || ''),
        item_name_hint: row.reward_name || '',
        rarity_hint: row.reward_rank ? rankToRarity(row.reward_rank) : null,
        count: Number(row.quantity) || 1,
        roll_points: rollPoints,
        roll_label_id: rollLabelId,
        roll_label: rollLabel,
        result_type: row.result_type || null,
        secondary_item_id: null,
        secondary_count: null,
        source: parsed.source || 'golumpa-nte-exporter',
      };
      if (!norm.id) norm.id = stableFallbackId(norm, index);
      norm.isBonus = isNonPityBonusRow(norm);
      return norm;
    });

    return {
      format: 'Golumpa NTE History Export (v1)',
      records,
      meta: {
        user_uid: parsed.user_uid || null,
        account_region: parsed.account_region || null,
      },
    };
  }

  // Case 3: Direct array of normalized records
  if (Array.isArray(parsed)) {
    return normalizeExternalJson({
      info: { schema: 'nte-gacha-export', source: 'raw-array' },
      nte: { list: parsed },
    });
  }

  throw new Error(
    'Unrecognized JSON format. Expected Zero-Install pktmon JSON, Anong0u0 NTE Gacha Export (v2.1), or Golumpa NTE History Export (v1).'
  );
}

function normalizeTimeString(val) {
  if (!val) return '';
  return String(val).replace('T', ' ').replace(/Z$/, '').slice(0, 19);
}
