// Ranch lineup rolls and AI opponent team generation, scaled by ladder tier.
import { SPECIES } from '../data/species.js';
import { MEGAS } from '../data/megas.js';
import { NATURE_NAMES, NATURES } from '../data/natures.js';
import { OPPONENTS, ARCHETYPE_POOLS } from '../data/trainers.js';
import { CONFIG } from '../data/config.js';
import { pick, pickN, chance, randInt, shuffle } from '../engine/rng.js';
import { newInstance, state } from '../state/store.js';

const ALL_SPECIES = Object.keys(SPECIES);

// ---------- Roster Ranch ----------
export function rollLineup() {
  // Weighted toward cheaper tiers, always at least one rare-or-better.
  const byTier = (t) => ALL_SPECIES.filter(s => SPECIES[s].tier === t);
  const lineup = new Set();
  lineup.add(pick(byTier(chance(0.4) ? 'epic' : 'rare')));
  while (lineup.size < CONFIG.LINEUP_SIZE) {
    const t = Math.random() < 0.35 ? 'common' : Math.random() < 0.6 ? 'standard' : Math.random() < 0.8 ? 'rare' : 'epic';
    lineup.add(pick(byTier(t)));
  }
  return [...lineup];
}

export function recruitPrice(speciesName) {
  return CONFIG.RECRUIT_PRICES[SPECIES[speciesName].tier] ?? 2500;
}

// ---------- AI team generation ----------
// A species' role decides its auto-spread: fast attacker, bulky attacker, wall.
function autoBuild(speciesName, quality) {
  const sp = SPECIES[speciesName];
  const s = sp.stats;
  const phys = s.atk >= s.spa;
  const fast = s.spe >= 85;
  const bulky = s.hp + s.def + s.spd > 260;

  // quality 0..1 scales how much of the 66-point pool the AI uses.
  const pool = Math.round(CONFIG.STAT_POINTS_TOTAL * quality);
  const spts = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
  const put = (k, n) => { const v = Math.min(n, CONFIG.STAT_POINTS_MAX, poolLeft()); spts[k] += v; };
  const poolLeft = () => pool - Object.values(spts).reduce((a, b) => a + b, 0);

  let nature = 'Hardy';
  if (fast) {
    put(phys ? 'atk' : 'spa', 32); put('spe', 32); put('hp', 32);
    nature = phys ? 'Jolly' : 'Timid';
  } else if (bulky && !phys && s.spa < 90) {
    put('hp', 32); put('def', 32); put('spd', 32);
    nature = 'Bold';
  } else {
    put(phys ? 'atk' : 'spa', 32); put('hp', 32); put(phys ? 'spe' : 'def', 32);
    nature = phys ? 'Adamant' : 'Modest';
  }
  if (!NATURES[nature]) nature = 'Hardy';
  if (quality < 0.4) nature = 'Hardy'; // low tiers: untrained mons

  // moves: defaults, with a chance to swap in an alternate at higher quality
  let moves = sp.moves.slice(0, 4);
  if (quality > 0.5 && sp.alts.length && chance(0.5)) {
    const alt = pick(sp.alts);
    if (!moves.includes(alt)) moves[randInt(0, 3)] = alt;
  }
  return newInstance(speciesName, { nature, statPoints: spts, moves, ability: pick(sp.abilities) });
}

const AI_ITEMS = ['Leftovers', 'Focus Sash', 'Choice Scarf', 'Choice Band', 'Choice Specs',
  'Life Orb', 'Assault Vest', 'Sitrus Berry', 'Lum Berry', 'Rocky Helmet', 'Weakness Policy'];

export function generateOpponent({ tierIdx, mode }) {
  const S = state();
  const opp = pick(OPPONENTS);
  const pool = ARCHETYPE_POOLS[opp.archetype] ?? ARCHETYPE_POOLS.balance;
  const quality = Math.min(1, 0.25 + tierIdx * 0.18 + (mode === 'ranked' ? 0.05 : 0));
  const aiLevel = tierIdx <= 0 ? 0 : tierIdx === 1 ? 1 : tierIdx === 2 ? 2 : 3;

  const picks = pickN(pool, CONFIG.TEAM_SIZE);
  const team = picks.map(sp => autoBuild(sp, quality));

  // held items from Great Ball tier up; one mega candidate from Ultra Ball up
  if (tierIdx >= 2) {
    const items = shuffle(AI_ITEMS);
    team.forEach((m, i) => { if (chance(0.75)) m.item = items[i % items.length]; });
  }
  if (tierIdx >= 2 && S.flags.tutorial) {
    const megaMon = team.find(m => SPECIES[m.species].mega);
    if (megaMon && chance(tierIdx >= 3 ? 0.9 : 0.5)) {
      const megaName = pick(SPECIES[megaMon.species].mega);
      megaMon.item = MEGAS[megaName].stone;
    }
  }
  return { trainer: { name: opp.name, title: opp.title }, team, aiLevel, hasOmniRing: tierIdx >= 2 };
}

// Scripted teams (Cordy / Emma) — gentle spreads, no training.
export function scriptedTeam(entries) {
  return entries.map(e => {
    const inst = newInstance(e.species, {});
    inst.item = e.item ?? null;
    return inst;
  });
}
