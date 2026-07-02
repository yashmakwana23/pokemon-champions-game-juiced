// Damage pipeline — level-50 Gen formula with the GDD's recorded modifiers:
// random roll 0.85–1.00, crit 1/24 at 1.5x (ignores helpful defender boosts /
// harmful attacker drops), STAB 1.5 (2.0 Adaptability), 18-type chart with
// 4x/2x/0.5x/0.25x/0x tiers, burn halves physical, weather ±50%, screens.
import { CONFIG } from '../data/config.js';
import { eff } from '../data/types.js';
import { stageMult } from './stats.js';
import { rand, chance } from '../engine/rng.js';

const TYPE_BOOST_ITEMS = {
  'Charcoal': 'Fire', 'Mystic Water': 'Water', 'Miracle Seed': 'Grass', 'Magnet': 'Electric',
  'Silk Scarf': 'Normal',
};
const RESIST_BERRIES = {
  'Occa Berry': 'Fire', 'Chople Berry': 'Fighting', 'Yache Berry': 'Ice',
  'Shuca Berry': 'Ground', 'Haban Berry': 'Dragon', 'Colbur Berry': 'Dark',
};

// Effectiveness only (for UI pre-commit labels and AI) — no randomness.
export function typeMult(move, attacker, defender) {
  if (move.cat === 'status') return 1;
  let m = eff(move.type, defender.types, { superVsWater: !!move.superVsWater });
  // Scrappy / Mold Breaker style holes:
  if (m === 0) {
    if (attacker.ability === 'Scrappy' && move.type === 'Normal' || attacker.ability === 'Scrappy' && move.type === 'Fighting') {
      if (defender.types.includes('Ghost')) {
        m = eff(move.type, defender.types.filter(t => t !== 'Ghost'), { superVsWater: !!move.superVsWater });
      }
    }
  }
  // Ability immunities the chart doesn't know (unless Mold Breaker):
  if (attacker.ability !== 'Mold Breaker') {
    if (defender.ability === 'Levitate' && move.type === 'Ground') m = 0;
    if (defender.ability === 'Flash Fire' && move.type === 'Fire') m = 0;
    if (defender.ability === 'Lightning Rod' && move.type === 'Electric') m = 0;
    if (defender.ability === 'Thick Fat' && (move.type === 'Fire' || move.type === 'Ice')) m *= 0.5;
  }
  return m;
}

export function calcDamage({ move, attacker, defender, battle, opts = {} }) {
  // Returns {dmg, mult, crit, effText} — dmg 0 with mult 0 means immune.
  const L = CONFIG.LEVEL;
  const mult = typeMult(move, attacker, defender);
  if (move.cat === 'status' || move.power === 0) return { dmg: 0, mult: 1, crit: false };
  if (mult === 0) return { dmg: 0, mult: 0, crit: false };

  const crit = opts.forceNoCrit ? false : chance(CONFIG.CRIT_CHANCE);

  // --- effective stats with stages (crit ignores unfavorable-to-attacker stages) ---
  const atkKey = move.offenseStat === 'def' ? 'def' : (move.cat === 'phys' ? 'atk' : 'spa');
  const defKey = move.defCategory === 'def' ? 'def' : (move.cat === 'phys' ? 'def' : 'spd');

  let atkStage = attacker.stages[atkKey];
  let defStage = defender.stages[defKey];
  if (crit) { atkStage = Math.max(0, atkStage); defStage = Math.min(0, defStage); }

  let A = attacker.stats[atkKey] * stageMult(atkStage);
  let D = defender.stats[defKey] * stageMult(defStage);

  // stat-modifying abilities/items
  if (attacker.ability === 'Huge Power' && atkKey === 'atk') A *= 2;
  if (attacker.ability === 'Solar Power' && battle.weather?.kind === 'sun' && atkKey === 'spa') A *= 1.5;
  if (attacker.ability === 'Guts' && attacker.status && atkKey === 'atk') A *= 1.5;
  if (attacker.ability === 'Supreme Overlord') A *= 1 + 0.1 * (attacker.side.faintCount ?? 0);
  if (attacker.item === 'Choice Band' && atkKey === 'atk') A *= 1.5;
  if (attacker.item === 'Choice Specs' && atkKey === 'spa') A *= 1.5;
  if (defender.item === 'Assault Vest' && defKey === 'spd') D *= 1.5;
  if (battle.weather?.kind === 'sand' && defender.types.includes('Rock') && defKey === 'spd') D *= 1.5;
  if (battle.weather?.kind === 'snow' && defender.types.includes('Ice') && defKey === 'def') D *= 1.5;

  // --- move power with modifiers ---
  let power = move.power;
  if (opts.powerOverride) power = opts.powerOverride;
  if (attacker.ability === 'Technician' && power <= 60) power *= 1.5;
  if (attacker.ability === 'Tough Claws' && move.contact) power *= 1.3;
  if (attacker.ability === 'Mega Launcher' && move.pulse) power *= 1.5;
  if (attacker.ability === 'Sand Force' && battle.weather?.kind === 'sand'
      && ['Rock', 'Ground', 'Steel'].includes(move.type)) power *= 1.3;
  if (attacker.ability === 'Pixilate' && move.type === 'Normal') power *= 1.2; // type change handled by caller
  const lowHpBoost = { Blaze: 'Fire', Torrent: 'Water', Overgrow: 'Grass' }[attacker.ability];
  if (lowHpBoost === move.type && attacker.hp <= attacker.maxHp / 3) power *= 1.5;
  if (attacker.ability === 'Flash Fire' && attacker.volatile.flashFire && move.type === 'Fire') power *= 1.5;
  if (TYPE_BOOST_ITEMS[attacker.item] === move.type) power *= 1.2;
  if (attacker.item === 'Muscle Band' && move.cat === 'phys') power *= 1.1;
  if (move.hexBoost && defender.status) power *= 2;

  // --- base formula ---
  let dmg = Math.floor(Math.floor(Math.floor((2 * L) / 5 + 2) * power * (A / Math.max(1, D))) / 50) + 2;

  // --- multipliers, canonical order-ish ---
  if (battle.weather?.kind === 'rain') {
    if (move.type === 'Water') dmg *= 1.5;
    if (move.type === 'Fire') dmg *= 0.5;
  }
  if (battle.weather?.kind === 'sun') {
    if (move.type === 'Fire') dmg *= 1.5;
    if (move.type === 'Water') dmg *= 0.5;
  }
  if (battle.field?.psychicTerrain && move.type === 'Psychic') dmg *= 1.3;
  if (crit) dmg *= CONFIG.CRIT_MULT;
  dmg *= CONFIG.DAMAGE_ROLL_MIN + rand() * (1 - CONFIG.DAMAGE_ROLL_MIN);

  // STAB
  const effTypes = attacker.volatile.proteanType ? [attacker.volatile.proteanType] : attacker.types;
  if (effTypes.includes(move.type) || attacker.ability === 'Protean') {
    dmg *= attacker.ability === 'Adaptability' ? 2 : 1.5;
  }

  dmg *= mult;
  if (attacker.status === 'brn' && move.cat === 'phys' && attacker.ability !== 'Guts') dmg *= 0.5;

  // screens (singles: 50%) — crits break through
  const scr = defender.side.screens;
  if (!crit) {
    if (move.cat === 'phys' && (scr.reflect > 0 || scr.auroraveil > 0)) dmg *= 0.5;
    if (move.cat === 'spec' && (scr.lightscreen > 0 || scr.auroraveil > 0)) dmg *= 0.5;
  }

  if (attacker.item === 'Life Orb') dmg *= 1.3;
  if (attacker.item === 'Expert Belt' && mult >= 2) dmg *= 1.2;

  // defender damage-halving abilities (Mold Breaker pierces)
  if (attacker.ability !== 'Mold Breaker') {
    if (defender.ability === 'Multiscale' && defender.hp === defender.maxHp) dmg *= 0.5;
  }

  // resist berry
  if (mult >= 2 && RESIST_BERRIES[defender.item] === move.type) {
    dmg *= 0.5;
    defender.volatile.berryPopped = defender.item;
    defender.item = null;
  }

  return { dmg: Math.max(1, Math.floor(dmg)), mult, crit };
}
