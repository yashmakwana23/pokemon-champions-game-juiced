// Stat math — exact formulas recorded in the GDD (level fixed at 50, IVs
// always 31, 66-point simplified EV pool, nature x1.1/x0.9):
//   HP   = floor(((2B + 31) * L) / 100) + L + 10 + SP_hp
//   Stat = floor((floor(((2B + 31) * L) / 100) + 5 + SP) * N)
import { CONFIG } from '../data/config.js';
import { NATURES } from '../data/natures.js';

export const STAT_KEYS = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];
export const STAT_LABELS = { hp: 'HP', atk: 'Atk', def: 'Def', spa: 'Sp.Atk', spd: 'Sp.Def', spe: 'Speed' };

export function computeStats(baseStats, statPoints, natureName) {
  const L = CONFIG.LEVEL, IV = CONFIG.IV;
  const nat = NATURES[natureName] ?? { up: null, down: null };
  const out = {};
  for (const k of STAT_KEYS) {
    const B = baseStats[k];
    const SP = statPoints?.[k] ?? 0;
    const core = Math.floor(((2 * B + IV) * L) / 100);
    if (k === 'hp') {
      out.hp = core + L + 10 + SP;
    } else {
      const N = nat.up === k ? 1.1 : nat.down === k ? 0.9 : 1.0;
      out[k] = Math.floor((core + 5 + SP) * N);
    }
  }
  return out;
}

// Stat stages -6..+6 → multiplier ((2+n)/2 up, 2/(2-n) down).
export function stageMult(stage) {
  return stage >= 0 ? (2 + stage) / 2 : 2 / (2 - stage);
}

// Accuracy/evasion stages use thirds.
export function accStageMult(stage) {
  return stage >= 0 ? (3 + stage) / 3 : 3 / (3 - stage);
}

export function clampStage(v) {
  return Math.max(-6, Math.min(6, v));
}

export function totalStatPoints(sp) {
  return STAT_KEYS.reduce((s, k) => s + (sp?.[k] ?? 0), 0);
}
