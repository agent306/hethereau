import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const dataDir = path.join(root, 'public', 'data');
const core = JSON.parse(fs.readFileSync(path.join(dataDir, 'core.json'), 'utf8'));
const en = JSON.parse(fs.readFileSync(path.join(dataDir, 'en.json'), 'utf8'));

const items = {};
for (const [id, meta] of Object.entries(core.items || {})) {
  const rarity = Number(meta.rarity || 3);
  const rank = rarity >= 5 ? 'S' : rarity === 4 ? 'A' : 'B';
  const name = (en.items && en.items[id]) || id;
  items[id] = [name, rarity, rank, meta.category || 'item'];
}

const aliases = core.item_aliases || {};

const banners = {};
for (const [id, title] of Object.entries(en.pools || {})) {
  banners[id] = title;
}
for (const [id, title] of Object.entries(en.banner_sources || {})) {
  banners[id] = title;
}

const outPath = path.join(root, 'worker', 'src', 'catalogWhitelist.js');
const content =
  `// Auto-generated from public/data/core.json & en.json via scripts/sync-worker-catalog.mjs\n` +
  `// Format: itemId -> [name, rarity, rank, category]\n` +
  `export const CATALOG_ITEMS = ${JSON.stringify(items)};\n` +
  `export const CATALOG_ALIASES = ${JSON.stringify(aliases)};\n` +
  `export const CATALOG_BANNERS = ${JSON.stringify(banners)};\n`;

fs.writeFileSync(outPath, content, 'utf8');
console.log(
  `Wrote ${outPath}: ${Object.keys(items).length} items, ${Object.keys(aliases).length} aliases, ${Object.keys(banners).length} banners (${content.length} bytes)`
);
