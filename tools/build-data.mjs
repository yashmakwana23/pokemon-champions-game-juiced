// Merges the GDD's dex_db.json (real stats/PP/power/prices scraped for
// Pokémon Champions) with the curated overlays into the game's ES-module data
// files. Run: node tools/build-data.mjs [path-to-dex_db.json]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SPECIES, MEGAS, ITEMS } from './overlay-species.mjs';
import { MOVES } from './overlay-moves.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEX_PATH = process.argv[2] ??
  'd:/Yash/Vork/6labs-MISC/Game Design Document/pipeline/6-final-docs/output/pokemon-champions/dex_db.json';
const OUT = path.join(__dirname, '..', 'js', 'data');
fs.mkdirSync(OUT, { recursive: true });

const dex = JSON.parse(fs.readFileSync(DEX_PATH, 'utf8'));
const byName = (kind) => Object.fromEntries(dex.groups[kind].map(e => [e.name, e]));
const dexMon = byName('pokemon'), dexMove = byName('move'), dexItem = byName('item');
const warns = [];

const STAT_KEYS = { HP:'hp', Atk:'atk', Def:'def', SpAtk:'spa', SpDef:'spd', Speed:'spe' };

function parseStats(entry) {
  // First "<name> Stats" table containing a Total row = base stats (BST).
  for (const t of entry.tables ?? []) {
    if (!/Stats$/i.test(t.title ?? '')) continue;
    const flat = t.rows.flat();
    if (!flat.includes('Total')) continue;
    const stats = {};
    for (const row of t.rows) {
      const k = STAT_KEYS[row[0]];
      if (k) stats[k] = parseInt(row[1], 10);
    }
    if (Object.keys(stats).length === 6) return stats;
  }
  return null;
}

function parseAbilities(entry) {
  const out = {};
  for (const t of entry.tables ?? []) {
    if (!/Abilit/i.test(t.title ?? '')) continue;
    for (const row of t.rows) {
      for (let i = 0; i + 1 < row.length; i += 2) {
        const name = String(row[i]).replace(/\s*\(Hidden\)\s*/i, '').trim();
        const desc = String(row[i + 1]).trim();
        if (name && desc && desc.length > 10) out[name] = desc;
      }
    }
  }
  return out;
}

function parseMoveNumbers(name) {
  const e = dexMove[name];
  if (!e) return null;
  const out = {};
  const p = parseInt(e.facts?.Power, 10); if (!isNaN(p)) out.power = p;
  const pp = parseInt(e.facts?.PP, 10); if (!isNaN(pp)) out.pp = pp;
  let details = '';
  for (const t of e.tables ?? []) {
    const flat = t.rows.flat().map(String);
    if (/Effect$/i.test(t.title ?? '')) {
      for (let i = 0; i < flat.length - 1; i++) {
        if (flat[i] === 'Accuracy') { const a = parseInt(flat[i + 1], 10); if (!isNaN(a)) out.acc = a; }
      }
      const effIdx = flat.indexOf('Effect');
      if (effIdx >= 0 && flat[effIdx + 1] && flat[effIdx + 1] !== '—') out.desc = flat[effIdx + 1];
    }
    if (/Move Details/i.test(t.title ?? '')) details += ' ' + flat.join(' ');
  }
  const pr = details.match(/([+-]\d+)\s*priority/i); if (pr) out.priority = parseInt(pr[1], 10);
  if (/Does not make direct contact/i.test(details)) out.contact = false;
  else if (/direct contact/i.test(details)) out.contact = true;
  if (out.desc) out.desc = out.desc.replace(/'/g, '’');
  return out;
}

function parseDexNum(e) {
  const nd = e?.facts?.['National Dex'] ?? (String(e?.blurb ?? '').match(/#\d+/) || [])[0];
  const n = parseInt(String(nd ?? '').replace(/\D/g, ''), 10);
  return isNaN(n) ? null : n;
}

// ---------- species ----------
const speciesOut = {};
for (const [name, ov] of Object.entries(SPECIES)) {
  const e = dexMon[name];
  const stats = e && parseStats(e);
  if (!stats) warns.push(`no stats for ${name}`);
  const dexAbil = e ? parseAbilities(e) : {};
  const abilities = ov.abilities.filter(a => {
    if (!dexAbil[a]) warns.push(`ability ${a} not on dex page of ${name}`);
    return true;
  });
  speciesOut[name] = {
    name, types: ov.types, glyph: ov.glyph, tier: ov.tier,
    dex: parseDexNum(e),
    stats: stats ?? { hp: 80, atk: 80, def: 80, spa: 80, spd: 80, spe: 80 },
    abilities, mega: ov.mega ?? null, moves: ov.moves, alts: ov.alts,
  };
  if (!speciesOut[name].dex) warns.push(`no dex number for ${name}`);
}

// ---------- megas ----------
const megasOut = {};
for (const [name, ov] of Object.entries(MEGAS)) {
  const e = dexMon[name];
  const stats = e && parseStats(e);
  if (!stats) warns.push(`no stats for ${name}`);
  const dexAbil = e ? parseAbilities(e) : {};
  const dexAbilNames = Object.keys(dexAbil);
  const ability = ov.ability ?? dexAbilNames[0] ?? null;
  if (!ov.ability && dexAbilNames.length) warns.push(`${name}: using dex ability "${dexAbilNames[0]}"`);
  if (ov.ability && !dexAbil[ov.ability] && dexAbilNames.length)
    warns.push(`${name}: overlay ability ${ov.ability} vs dex ${dexAbilNames.join('/')}`);
  megasOut[name] = {
    name, base: ov.base, types: ov.types,
    stats: stats ?? null, ability,
    stone: stoneName(ov.base, name),
  };
}
function stoneName(base, megaName) {
  const suffix = megaName.endsWith(' X') ? ' X' : megaName.endsWith(' Y') ? ' Y' : '';
  const stems = {
    Charizard: 'Charizardite', Venusaur: 'Venusaurite', Blastoise: 'Blastoisinite',
    Alakazam: 'Alakazite', Gengar: 'Gengarite', Dragonite: 'Dragoninite',
    Tyranitar: 'Tyranitarite', Metagross: 'Metagrossite', Garchomp: 'Garchompite',
    Lucario: 'Lucarionite', Gyarados: 'Gyaradosite', Scizor: 'Scizorite',
    Gardevoir: 'Gardevoirite', Swampert: 'Swampertite', Blaziken: 'Blazikenite',
    Kangaskhan: 'Kangaskhanite', Mawile: 'Mawilite', Heracross: 'Heracronite',
    Absol: 'Absolite', Aerodactyl: 'Aerodactylite', Houndoom: 'Houndoominite',
    Manectric: 'Manectite', Greninja: 'Greninjite', Excadrill: 'Excadrite',
  };
  return (stems[base] ?? base + 'ite') + suffix;
}

// ---------- moves ----------
const movesOut = {};
for (const [name, ov] of Object.entries(MOVES)) {
  const nums = parseMoveNumbers(name);
  if (!nums) warns.push(`move not in dex: ${name}`);
  const m = { name, ...ov, ...(nums ?? {}) };
  // Overlay wins for fields it sets explicitly where the dex text is unreliable:
  if (ov.priority !== undefined) m.priority = ov.priority;
  if (ov.acc !== undefined && (nums?.acc === undefined)) m.acc = ov.acc;
  if (ov.contact !== undefined) m.contact = ov.contact;
  m.priority ??= 0; m.acc ??= null; m.pp ??= 8; m.power ??= 0;
  m.contact ??= false; m.target ??= (m.cat === 'status' ? 'foe' : 'foe');
  if (ov.override) Object.assign(m, ov.override); // curated corrections beat scrape
  delete m.override;
  movesOut[name] = m;
}

// ---------- items ----------
const itemsOut = {};
for (const [name, ov] of Object.entries(ITEMS)) {
  const e = dexItem[name];
  let price = null, dexDesc = null;
  if (e) {
    const c = parseInt(String(e.facts?.['VP Cost'] ?? '').replace(/,/g, ''), 10);
    if (!isNaN(c)) price = c;
    if (e.facts?.Effect) dexDesc = e.facts.Effect;
  } else warns.push(`item not in dex: ${name}`);
  const isBerry = /Berry$/.test(name);
  itemsOut[name] = {
    name, kind: ov.kind, boost: ov.boost ?? null,
    price: price ?? (isBerry ? 400 : 700),
    desc: (dexDesc ?? ov.desc).replace(/'/g, '’'),
  };
}

// ---------- emit ----------
const banner = (what) =>
  `// GENERATED by tools/build-data.mjs — ${what}\n// Numeric data sourced from the GDD dex_db.json (scraped Pokémon Champions wiki);\n// types/categories/effects curated in tools/overlay-*.mjs. Do not edit by hand.\n`;
const emit = (file, name, obj) =>
  fs.writeFileSync(path.join(OUT, file), banner(file) + `export const ${name} = ` + JSON.stringify(obj, null, 1) + ';\n');

emit('species.js', 'SPECIES', speciesOut);
emit('megas.js', 'MEGAS', megasOut);
emit('moves.js', 'MOVES', movesOut);
emit('items.js', 'ITEMS', itemsOut);

console.log(`species: ${Object.keys(speciesOut).length}, megas: ${Object.keys(megasOut).length}, moves: ${Object.keys(movesOut).length}, items: ${Object.keys(itemsOut).length}`);
console.log('warnings:\n' + warns.map(w => '  - ' + w).join('\n'));
