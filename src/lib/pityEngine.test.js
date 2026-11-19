import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { NteCatalog } from './catalog.js';
import { normalizeExternalJson } from './formats.js';
import { analyzeAccountPulls, getNextPullChance, mergePullRecords } from './pityEngine.js';
import { generateSampleNteExport } from './sampleData.js';
import { smartMergeStates, statesHaveSamePullIds } from './googleDriveSync.js';
import { getContributePreference, isEligibleForGlobalStats } from './statsApi.js';

function loadLocalCatalog() {
  const dataDir = path.resolve(process.cwd(), 'public', 'data');
  const core = JSON.parse(fs.readFileSync(path.join(dataDir, 'core.json'), 'utf8'));
  const en = JSON.parse(fs.readFileSync(path.join(dataDir, 'en.json'), 'utf8'));
  const occ = JSON.parse(
    fs.readFileSync(path.join(dataDir, 'banner-occurrences.json'), 'utf8')
  );
  return new NteCatalog(core, en, occ);
}

describe('NTE Pity Engine & Format Parsers', () => {
  it('excludes Monopoly Points Gift and Slumberland bonus rows from pity math', () => {
    const catalog = loadLocalCatalog();
    const sample = normalizeExternalJson(generateSampleNteExport());
    const analysis = analyzeAccountPulls(sample.records, catalog);

    const limited = analysis.pools.monopoly_limited;
    expect(limited.totalPulls).toBe(228);
    expect(limited.bonusRows).toBe(2);
    expect(limited.currentSPity).toBe(38);
    expect(limited.currentAPity).toBe(8); // 228 % 10
    expect(limited.sRankCount).toBe(3);

    const pities = limited.sRankHistory.map((h) => h.pityAtPull);
    expect(pities).toEqual([76, 41, 73]);
    expect(limited.sRankHistory.every((h) => h.rateStatus === 'featured')).toBe(true);
    expect(limited.sRankHistory[0].item.avatar).toMatch(/^\/avatars\/\d+\.png$/);
  });

  it('does NOT reset Limited Board Character S-Rank pity on S-rarity Solid Dice, Outfits, or Mod Parts', () => {
    const catalog = loadLocalCatalog();
    const raw = normalizeExternalJson({
      info: { schema: 'nte-gacha-export', schema_version: '2.1' },
      nte: {
        list: [
          // Newest -> oldest: 2 filler, then S-Class Solid Dice, then S-Class Outfit, then Character 1010 (Nanally) at pull 3, preceded by 2 filler
          { record_id: 'r6', source_order: 0, record_type: 'monopoly', time: '2026-11-19 10:00:06', pool_id: 'CardPool_Character', lottery_id: 'Lottery_Nanali', item_id: 'fork_nonos', count: 1, roll_points: 2 },
          { record_id: 'r5', source_order: 1, record_type: 'monopoly', time: '2026-11-19 10:00:05', pool_id: 'CardPool_Character', lottery_id: 'Lottery_Nanali', item_id: 'Dicelimite', count: 1, roll_points: 5 },
          { record_id: 'r4', source_order: 2, record_type: 'monopoly', time: '2026-11-19 10:00:04', pool_id: 'CardPool_Character', lottery_id: 'Lottery_Nanali', item_id: 'Fashion_vehicle_1010_V008', count: 1, roll_points: 3 },
          { record_id: 'r3', source_order: 3, record_type: 'monopoly', time: '2026-11-19 10:00:03', pool_id: 'CardPool_Character', lottery_id: 'Lottery_Nanali', item_id: '1010', count: 1, roll_points: 6 },
          { record_id: 'r2', source_order: 4, record_type: 'monopoly', time: '2026-11-19 10:00:02', pool_id: 'CardPool_Character', lottery_id: 'Lottery_Nanali', item_id: 'Dicelimite', count: 1, roll_points: 4 },
          { record_id: 'r1', source_order: 5, record_type: 'monopoly', time: '2026-11-19 10:00:01', pool_id: 'CardPool_Character', lottery_id: 'Lottery_Nanali', item_id: 'fork_dustbin', count: 1, roll_points: 1 },
        ],
      },
    });

    const analysis = analyzeAccountPulls(raw.records, catalog);
    const limited = analysis.pools.monopoly_limited;

    // 6 total dice pulls:
    // pull 1: fork_dustbin (B) -> sPity=1
    // pull 2: Dicelimite (S item, NOT character) -> sPity=2 (must NOT reset!)
    // pull 3: 1010 Nanally (S character) -> pityAtPull=3, sPity resets to 0!
    // pull 4: Fashion_vehicle_1010_V008 (S cosmetic, NOT character) -> sPity=1
    // pull 5: Dicelimite (S item, NOT character) -> sPity=2
    // pull 6: fork_nonos (B) -> sPity=3
    expect(limited.totalPulls).toBe(6);
    expect(limited.sRankCount).toBe(1); // Only 1 S-Class Character!
    expect(limited.allSRankCount).toBe(4); // 1 char + 2 Solid Dice + 1 Mod Part
    expect(limited.nonPitySCount).toBe(3);
    expect(limited.sRankHistory[0].item.id).toBe('1010');
    expect(limited.sRankHistory[0].pityAtPull).toBe(3);
    expect(limited.currentSPity).toBe(3);
  });

  it('tracks Arc Research off-rate -> guaranteed pickup transitions', () => {
    const catalog = loadLocalCatalog();
    const sample = normalizeExternalJson(generateSampleNteExport());
    const analysis = analyzeAccountPulls(sample.records, catalog);

    const fork = analysis.pools.fork_lottery;
    expect(fork.totalPulls).toBe(100);
    expect(fork.currentSPity).toBe(14);
    expect(fork.currentAPity).toBeLessThan(10);
    expect(fork.sRankCount).toBe(2);
    expect(fork.sRankHistory[0].rateStatus).toBe('guaranteed');
    expect(fork.sRankHistory[0].pityAtPull).toBe(34);
    expect(fork.sRankHistory[1].rateStatus).toBe('off_rate');
    expect(fork.sRankHistory[1].pityAtPull).toBe(52);
  });

  it('parses Golumpa v1 JSON and deduplicates cleanly on re-import', () => {
    const golumpa = {
      format: 'nte-history-export',
      format_version: 1,
      banner: { id: 'Lottery_LimitedCharacter', system: 'Monopoly' },
      records: [
        {
          uid: '7aae34232160e950ecc7b5da38812caa',
          pool_group_id: 'Lottery_LimitedCharacter',
          timestamp: '2026-06-10 13:32:17',
          roll_result: 5,
          result_type: 'dice',
          reward_id: '1010',
          reward_name: 'Nanally',
          reward_rank: 'S',
          quantity: 1,
        },
        {
          uid: '7aae34232160e950ecc7b5da38812cab',
          pool_group_id: 'Lottery_LimitedCharacter',
          timestamp: '2026-06-10 13:32:17',
          roll_result: 0,
          result_type: 'points_gift',
          reward_id: 'DiceNormal',
          reward_rank: 'A',
          quantity: 1,
        },
      ],
    };

    const parsed = normalizeExternalJson(golumpa);
    expect(parsed.records).toHaveLength(2);
    expect(parsed.records[1].isBonus).toBe(true);

    const first = mergePullRecords([], parsed.records);
    expect(first.added).toBe(2);
    const second = mergePullRecords(first.merged, parsed.records);
    expect(second.added).toBe(0);
    expect(second.duplicates).toBe(2);
  });

  it('losslessly merges Google Drive & local states without losing profiles or pulls', () => {
    const local = {
      activeProfileId: 'main',
      profiles: {
        main: {
          id: 'main',
          name: 'Main',
          updatedAt: '2026-11-19T12:00:00Z',
          manualCharacters: { '1023': 1 },
          records: [
            { id: 'a1', item_id: '1010', time: '2026-11-19 10:00:00' },
            { id: 'a2', item_id: '1004', time: '2026-11-19 10:01:00' },
          ],
        },
      },
    };
    const remote = {
      activeProfileId: 'main',
      profiles: {
        main: {
          id: 'main',
          name: 'Main',
          updatedAt: '2026-11-18T12:00:00Z',
          manualCharacters: { '1023': 2, '1054': 1 },
          records: [
            { id: 'a1', item_id: '1010', time: '2026-11-19 10:00:00' },
            { id: 'b3', item_id: '1003', time: '2026-11-18 09:00:00' },
          ],
        },
        alt: {
          id: 'alt',
          name: 'Alt EU',
          updatedAt: '2026-11-18T12:00:00Z',
          records: [{ id: 'c1', item_id: '1033', time: '2026-11-18 08:00:00' }],
        },
      },
    };

    expect(statesHaveSamePullIds(local, remote)).toBe(false);
    const merged = smartMergeStates(local, remote);
    expect(Object.keys(merged.profiles).sort()).toEqual(['alt', 'main']);
    expect(merged.profiles.main.records.map((r) => r.id).sort()).toEqual(['a1', 'a2', 'b3']);
    expect(merged.profiles.main.manualCharacters).toEqual({ '1023': 2, '1054': 1 });
    expect(merged.profiles.alt.records).toHaveLength(1);
    expect(statesHaveSamePullIds(merged, merged)).toBe(true);
  });

  it('computes accurate next-pull S-Class probabilities across base, soft pity, and hard pity', () => {
    expect(getNextPullChance('monopoly_limited', 0)).toEqual({ percent: 0.99, label: '0.99%', tier: 'base' });
    expect(getNextPullChance('monopoly_limited', 69)).toEqual({ percent: 0.99, label: '0.99%', tier: 'base' });
    expect(getNextPullChance('monopoly_limited', 70)).toEqual({ percent: 19.59, label: '19.59%', tier: 'soft' });
    expect(getNextPullChance('monopoly_standard', 88)).toEqual({ percent: 19.59, label: '19.59%', tier: 'soft' });
    expect(getNextPullChance('monopoly_limited', 89)).toEqual({ percent: 100, label: '100%', tier: 'hard' });
    expect(getNextPullChance('fork_lottery', 0)).toEqual({ percent: 3, label: '3.0%', tier: 'base' });
    expect(getNextPullChance('fork_lottery', 59)).toEqual({ percent: 100, label: '100%', tier: 'hard' });
    expect(getNextPullChance('mystery_box', 12)).toBeNull();
  });

  it('defaults global stats contribution to ON and excludes manual/demo records', () => {
    expect(getContributePreference()).toBe(true);
    expect(
      isEligibleForGlobalStats({
        id: '3b0fd73d4bf5adcc5d1ba187101c9513',
        item_id: '1010',
        time: '2026-11-19 15:27:58',
        source: 'pktmon_zero_install',
      })
    ).toBe(true);
    expect(
      isEligibleForGlobalStats({
        id: 'manual_1234',
        item_id: '1010',
        time: '2026-11-19 15:27:58',
        source: 'manual',
      })
    ).toBe(false);
    expect(
      isEligibleForGlobalStats({
        id: 'demo_1234',
        item_id: '1010',
        time: '2026-11-19 15:27:58',
        source: 'demo',
      })
    ).toBe(false);
  });
});
