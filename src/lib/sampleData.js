/**
 * Generates a realistic demo NTE pull dataset using REAL NTE item/character/arc/banner IDs
 * so Natthu can explore every dashboard card, pity bar, histogram, and filter instantly.
 */

export function generateSampleNteExport() {
  const list = [];
  let seq = 0;

  // Helper to push newest-first timestamped pulls
  const baseDate = new Date('2026-06-22T18:40:00Z').getTime();

  function addBatch(poolId, lotteryId, recordType, minutesOffset, items) {
    const ts = new Date(baseDate - minutesOffset * 60000)
      .toISOString()
      .replace('T', ' ')
      .slice(0, 19);

    items.forEach((entry, idx) => {
      const id = `demo_${poolId}_${seq++}_${idx}`;
      const row = {
        record_id: id,
        source_order: seq,
        record_type: recordType,
        time: ts,
        pool_id: poolId,
        item_id: entry.item_id,
        count: entry.count || 1,
      };
      if (lotteryId) {
        row.lottery_id = lotteryId;
        row.banner_id = lotteryId;
      }
      if (entry.item_name) row.item_name = entry.item_name;
      if (entry.rarity) row.rarity = entry.rarity;
      if (entry.roll_points) {
        row.roll_points = entry.roll_points;
        row.roll_label = String(entry.roll_points);
      }
      if (entry.roll_label_id) {
        row.roll_label_id = entry.roll_label_id;
        row.roll_label = entry.roll_label;
      }
      list.push(row);
    });
  }

  const bFillerArcs = [
    'fork_nonos',
    'fork_appliance',
    'fork_dustbin',
    'fork_coffee',
    'fork_camera',
    'fork_lamp',
  ];
  const aChars = ['1008', '1019', '1020', '1021', '1033']; // Skia, Mint, Haniel, Edgar, Adler
  const aArcs = ['fork_BitterCake', 'fork_bopu', 'fork_BoxingCandy'];

  function makeFiller(i) {
    if (i % 10 === 4) {
      return {
        item_id: aChars[i % aChars.length],
        roll_points: (i % 6) + 1,
      };
    }
    return {
      item_id: bFillerArcs[i % bFillerArcs.length],
      roll_points: (i % 6) + 1,
    };
  }

  // 1) Limited Character Board: 3 featured S-ranks + current pity at 38
  // Chronological story:
  //   - Pull 73 (Board Modification soft pity!): Nanally (1010) on Lottery_Nanali
  //   - Pull 41 (early luck!): Lacrimosa (1004) on Lottery_AnHunQu
  //   - Pull 76 (Board Modification): Kaesi (1071) on Lottery_Kaesi
  //   - + 38 pulls building pity toward next featured character
  //   - Plus 2 Monopoly bonus rows (Points Gift & Slumberland) that must NOT count toward pity!
  const limitedPulls = [];
  // Build newest -> oldest so source_order aligns naturally
  for (let i = 0; i < 38; i++) limitedPulls.push({ ...makeFiller(i + 1), lottery: 'Lottery_Kaesi' });
  limitedPulls.push({ item_id: 'DiceNormal', roll_label_id: 'BPUI_LotteryResult_jidianzengli', roll_label: 'Points Gift', lottery: 'Lottery_Kaesi' });
  limitedPulls.push({ item_id: '1071', roll_points: 6, lottery: 'Lottery_Kaesi' }); // S-rank @ 76
  for (let i = 0; i < 75; i++) limitedPulls.push({ ...makeFiller(i + 10), lottery: 'Lottery_Kaesi' });
  limitedPulls.push({ item_id: '1004', roll_points: 5, lottery: 'Lottery_AnHunQu' }); // S-rank @ 41
  limitedPulls.push({ item_id: '1033', roll_label_id: 'BPUI_LotteryResult_chenmiandi', roll_label: 'Slumberland', lottery: 'Lottery_AnHunQu' });
  for (let i = 0; i < 40; i++) limitedPulls.push({ ...makeFiller(i + 25), lottery: 'Lottery_AnHunQu' });
  limitedPulls.push({ item_id: '1010', roll_points: 4, lottery: 'Lottery_Nanali' }); // S-rank @ 73
  for (let i = 0; i < 72; i++) limitedPulls.push({ ...makeFiller(i + 50), lottery: 'Lottery_Nanali' });

  for (let i = 0; i < limitedPulls.length; i += 10) {
    const chunk = limitedPulls.slice(i, i + 10);
    addBatch('CardPool_Character', chunk[0].lottery, 'monopoly', i * 18 + 60, chunk);
  }

  // 2) Standard Board: 1 S-rank (Sakiri 1003 @ 64) + 21 current pity
  const stdPulls = [];
  for (let i = 0; i < 21; i++) stdPulls.push(makeFiller(i + 3));
  stdPulls.push({ item_id: '1003', roll_points: 3 }); // Sakiri @ 64
  for (let i = 0; i < 63; i++) stdPulls.push(makeFiller(i + 17));
  for (let i = 0; i < stdPulls.length; i += 10) {
    addBatch('CardPool_NewRole', 'Lottery_Permanent', 'monopoly', i * 25 + 400, stdPulls.slice(i, i + 10));
  }

  // 3) Arc Research (Fork Lottery): 1 off-rate S-rank (fork_Arachne @ 52), then guaranteed featured S-rank (fork_TigerTally @ 34) + 14 current pity
  const forkPulls = [];
  for (let i = 0; i < 14; i++) {
    forkPulls.push({ item_id: i % 9 === 4 ? aArcs[i % aArcs.length] : bFillerArcs[i % bFillerArcs.length] });
  }
  forkPulls.push({ item_id: 'fork_TigerTally' }); // Featured @ 34 (Guaranteed!)
  for (let i = 0; i < 33; i++) {
    forkPulls.push({ item_id: i % 9 === 5 ? aArcs[i % aArcs.length] : bFillerArcs[i % bFillerArcs.length] });
  }
  forkPulls.push({ item_id: 'fork_Arachne' }); // Off-rate @ 52
  for (let i = 0; i < 51; i++) {
    forkPulls.push({ item_id: i % 9 === 3 ? aArcs[i % aArcs.length] : bFillerArcs[i % bFillerArcs.length] });
  }
  for (let i = 0; i < forkPulls.length; i += 10) {
    addBatch('ForkLottery_Nanali', null, 'fork', i * 30 + 900, forkPulls.slice(i, i + 10));
  }

  // 4) Mystery Box: 8 single pulls including vehicle039 (Draco S-Class)
  const mbItems = [
    { item_id: 'CharacterUpMaterial_lv3', item_name: 'Elite Hunter Guide', rarity: 4 },
    { item_id: 'CityAbility_UpMaterial', item_name: 'Dreamless Seed', rarity: 3 },
    { item_id: 'vehicle039', item_name: 'Draco', rarity: 5 },
    { item_id: 'CityAbility_UpMaterial', item_name: 'Dreamless Seed', rarity: 3 },
    { item_id: 'BussinessCard_MangHe_bsj', item_name: 'Trackside Shadow', rarity: 5 },
    { item_id: 'CharacterUpMaterial_lv3', item_name: 'Elite Hunter Guide', rarity: 4 },
    { item_id: 'CityAbility_UpMaterial', item_name: 'Dreamless Seed', rarity: 3 },
    { item_id: 'CityAbility_UpMaterial', item_name: 'Dreamless Seed', rarity: 3 },
  ];
  mbItems.forEach((entry, idx) => {
    addBatch('Gashapon_MysteryBox', 'Gashapon_MysteryBox', 'mystery_box', idx * 12 + 30, [
      { ...entry, count: 1 },
    ]);
  });

  return {
    info: {
      schema: 'nte-gacha-export',
      schema_version: '2.1',
      source: 'demo_sample',
      locale: 'en',
    },
    nte: { list },
  };
}
