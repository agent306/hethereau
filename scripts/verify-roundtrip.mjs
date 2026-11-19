/**
 * End-to-end round-trip verification:
 *   PowerShell zero-install pktmon decoder (public/import-nte.ps1)
 *     -> emits JSON
 *     -> parsed by src/lib/formats.js (normalizeExternalJson)
 *     -> resolved against real NTE catalog (public/data/core.json + en.json + banner-occurrences.json)
 *     -> analyzed by src/lib/pityEngine.js (analyzeAccountPulls)
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { NteCatalog } from '../src/lib/catalog.js';
import { normalizeExternalJson } from '../src/lib/formats.js';
import { analyzeAccountPulls } from '../src/lib/pityEngine.js';

const root = process.cwd();
const dataDir = path.join(root, 'public', 'data');
const catalog = new NteCatalog(
  JSON.parse(fs.readFileSync(path.join(dataDir, 'core.json'), 'utf8')),
  JSON.parse(fs.readFileSync(path.join(dataDir, 'en.json'), 'utf8')),
  JSON.parse(fs.readFileSync(path.join(dataDir, 'banner-occurrences.json'), 'utf8'))
);

const rawJson = execFileSync(
  'powershell.exe',
  [
    '-NoProfile',
    '-ExecutionPolicy',
    'Bypass',
    '-File',
    path.join(root, 'scripts', 'test-importer.ps1'),
    '-EmitJson',
  ],
  { encoding: 'utf8' }
);

const normalized = normalizeExternalJson(rawJson);
const analysis = analyzeAccountPulls(normalized.records, catalog);

if (normalized.format !== 'Zero-Install pktmon (v2.1)') {
  throw new Error(`Unexpected format: ${normalized.format}`);
}
if (analysis.pools.monopoly_limited.totalPulls !== 1) {
  throw new Error(
    `Expected 1 dice pull on limited board (2 bonus rows excluded), got ${analysis.pools.monopoly_limited.totalPulls}`
  );
}
if (analysis.pools.monopoly_limited.bonusRows !== 2) {
  throw new Error(
    `Expected 2 bonus rows on limited board, got ${analysis.pools.monopoly_limited.bonusRows}`
  );
}
if (analysis.pools.monopoly_limited.sRankHistory[0]?.item?.name !== 'Nanally') {
  throw new Error(
    `Expected Nanally resolved from real catalog, got ${analysis.pools.monopoly_limited.sRankHistory[0]?.item?.name}`
  );
}
if (analysis.pools.fork_lottery.totalPulls !== 2) {
  throw new Error(`Expected 2 fork pulls, got ${analysis.pools.fork_lottery.totalPulls}`);
}
if (analysis.pools.mystery_box.totalPulls !== 1) {
  throw new Error(`Expected 1 mystery box pull, got ${analysis.pools.mystery_box.totalPulls}`);
}

console.log(
  '[PASS] Full E2E round-trip verified: import-nte.ps1 -> JSON -> formats.js -> NteCatalog -> pityEngine.js!'
);
console.log(
  `       Limited: ${analysis.pools.monopoly_limited.totalPulls} pull + ${analysis.pools.monopoly_limited.bonusRows} bonus (S-Rank: ${analysis.pools.monopoly_limited.sRankHistory[0].item.name}), Arc: ${analysis.pools.fork_lottery.totalPulls}, Mystery Box: ${analysis.pools.mystery_box.totalPulls}`
);
