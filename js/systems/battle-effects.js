// Effect helpers for the battle core: stat stages, status infliction, entry
// hazards and switch-in ability triggers. All emit through the battle's E().
import { CONFIG } from '../data/config.js';
import { eff } from '../data/types.js';
import { clampStage } from './stats.js';
import { chance } from '../engine/rng.js';

export const STAGE_NAMES = { atk: 'Attack', def: 'Defense', spa: 'Sp. Atk', spd: 'Sp. Def', spe: 'Speed', acc: 'accuracy' };
export const STATUS_NAMES = { brn: 'burned', par: 'paralyzed', psn: 'poisoned', tox: 'badly poisoned', slp: 'asleep', frz: 'frozen' };

// ---- stat stages (with Clear Body / Defiant / White Herb interplay) ----
export async function changeStage(B, mon, stat, delta, { fromFoe = false } = {}) {
  if (mon.hp <= 0) return;
  if (fromFoe && mon.ability === 'Clear Body') {
    await B.E({ t: 'msg', text: `${mon.name}'s Clear Body prevents stat loss!` });
    return;
  }
  const before = mon.stages[stat];
  mon.stages[stat] = clampStage(before + delta);
  const applied = mon.stages[stat] - before;
  if (applied === 0) {
    await B.E({ t: 'msg', text: `${mon.name}'s ${STAGE_NAMES[stat]} won't go any ${delta > 0 ? 'higher' : 'lower'}!` });
    return;
  }
  const dir = applied > 0 ? (applied >= 2 ? 'rose sharply' : 'rose') : (applied <= -2 ? 'fell harshly' : 'fell');
  await B.E({ t: 'stage', mon, stat, delta: applied, text: `${mon.name}'s ${STAGE_NAMES[stat]} ${dir}!` });

  if (applied < 0 && fromFoe) {
    if (mon.ability === 'Defiant') {
      await B.E({ t: 'msg', text: `${mon.name}'s Defiant!` });
      await changeStage(B, mon, 'atk', 2);
    }
    if (mon.item === 'White Herb') {
      let restored = false;
      for (const k of Object.keys(mon.stages)) if (mon.stages[k] < 0) { mon.stages[k] = 0; restored = true; }
      if (restored) {
        mon.item = null;
        await B.E({ t: 'msg', text: `${mon.name} restored its stats with its White Herb!` });
      }
    }
  }
}

const STATUS_IMMUNE = {
  brn: (m) => m.types.includes('Fire'),
  par: (m) => m.types.includes('Electric'),
  psn: (m) => m.types.includes('Poison') || m.types.includes('Steel'),
  tox: (m) => m.types.includes('Poison') || m.types.includes('Steel'),
  frz: (m) => m.types.includes('Ice'),
  slp: () => false,
};

export async function inflictStatus(B, mon, status, { quiet = false } = {}) {
  if (mon.hp <= 0 || mon.status) return false;
  if (STATUS_IMMUNE[status]?.(mon)) {
    if (!quiet) await B.E({ t: 'msg', text: `It doesn't affect ${mon.name}...` });
    return false;
  }
  mon.status = status;
  mon.statusTurns = 0;
  if (status === 'tox') mon.toxCounter = 0;
  await B.E({ t: 'status', mon, status, text: `${mon.name} is ${STATUS_NAMES[status]}!` });
  await maybeLumBerry(B, mon);
  return true;
}

export async function maybeLumBerry(B, mon) {
  if (mon.item === 'Lum Berry' && (mon.status || mon.volatile.confuse > 0)) {
    mon.status = null;
    mon.volatile.confuse = 0;
    mon.item = null;
    await B.E({ t: 'msg', text: `${mon.name} cured itself with its Lum Berry!` });
  }
}

export async function healMon(B, mon, amount, why = '') {
  if (mon.hp <= 0 || mon.hp >= mon.maxHp) return;
  const before = mon.hp;
  mon.hp = Math.min(mon.maxHp, mon.hp + Math.max(1, Math.floor(amount)));
  await B.E({ t: 'hp', mon, from: before, to: mon.hp, heal: true, text: why ? `${mon.name} ${why}` : null });
}

// ---- entry hazards & switch-in ----
export async function applyEntryHazards(B, mon) {
  const hz = mon.side.hazards;
  if (hz.rocks) {
    const mult = eff('Rock', mon.types);
    if (mult > 0 && mon.ability !== 'Magic Guard') {
      const dmg = Math.max(1, Math.floor(mon.maxHp * (1 / 8) * mult));
      const before = mon.hp;
      mon.hp = Math.max(0, mon.hp - dmg);
      await B.E({ t: 'hp', mon, from: before, to: mon.hp, text: `Pointed stones dug into ${mon.name}!` });
    }
  }
  if (mon.hp <= 0) return;
  const grounded = !mon.types.includes('Flying') && mon.ability !== 'Levitate';
  if (hz.web && grounded) {
    await B.E({ t: 'msg', text: `${mon.name} was caught in a sticky web!` });
    await changeStage(B, mon, 'spe', -1, { fromFoe: true });
  }
  if (hz.tspikes && grounded) {
    if (mon.types.includes('Poison')) {
      mon.side.hazards.tspikes = 0;
      await B.E({ t: 'msg', text: `${mon.name} absorbed the Toxic Spikes!` });
    } else {
      await inflictStatus(B, mon, hz.tspikes >= 2 ? 'tox' : 'psn', { quiet: true });
    }
  }
}

export async function switchInAbilities(B, mon) {
  const foe = B.activeFoe(mon);
  const setWeather = { Drought: 'sun', Drizzle: 'rain', 'Sand Stream': 'sand', 'Snow Warning': 'snow' }[mon.ability];
  if (setWeather && B.weather.kind !== setWeather) {
    const rocks = { sun: 'Heat Rock', rain: 'Damp Rock', sand: 'Smooth Rock', snow: 'Icy Rock' };
    const turns = mon.item === rocks[setWeather] ? CONFIG.WEATHER_TURNS_ROCK : CONFIG.WEATHER_TURNS;
    B.weather = { kind: setWeather, turns };
    const names = { sun: 'The sunlight turned harsh!', rain: 'It started to rain!', sand: 'A sandstorm kicked up!', snow: 'It started to snow!' };
    await B.E({ t: 'weather', kind: setWeather, text: `${mon.name}'s ${mon.ability}! ${names[setWeather]}` });
  }
  if (mon.ability === 'Intimidate' && foe && foe.hp > 0) {
    if (foe.ability === 'Inner Focus' || foe.ability === 'Scrappy' || foe.ability === 'Clear Body') {
      await B.E({ t: 'msg', text: `${foe.name}'s ${foe.ability} blocked Intimidate!` });
    } else {
      await B.E({ t: 'msg', text: `${mon.name}'s Intimidate cuts ${foe.name}'s Attack!` });
      await changeStage(B, foe, 'atk', -1, { fromFoe: true });
    }
  }
  if (mon.ability === 'Trace' && foe && foe.ability) {
    mon.ability = foe.ability;
    await B.E({ t: 'msg', text: `${mon.name} traced ${foe.name}'s ${foe.ability}!` });
    if (mon.ability !== 'Trace') await switchInAbilities(B, mon); // traced weather setters fire
  }
}

// Rock-type-scaled residual fractions
export function sandImmune(mon) {
  return mon.types.some(t => ['Rock', 'Ground', 'Steel'].includes(t))
    || ['Magic Guard', 'Sand Force', 'Sand Rush'].includes(mon.ability);
}

export async function endTurnResiduals(B, mon) {
  if (mon.hp <= 0) return;
  const chip = async (frac, text) => {
    if (mon.ability === 'Magic Guard') return;
    const before = mon.hp;
    mon.hp = Math.max(0, mon.hp - Math.max(1, Math.floor(mon.maxHp * frac)));
    await B.E({ t: 'hp', mon, from: before, to: mon.hp, text });
  };
  if (B.weather.kind === 'sand' && !sandImmune(mon)) {
    await chip(CONFIG.SAND_CHIP_FRAC, `${mon.name} is buffeted by the sandstorm!`);
  }
  if (mon.hp <= 0) return;
  if (B.weather.kind === 'sun' && mon.ability === 'Solar Power') {
    await chip(1 / 8, `${mon.name} is worn down by Solar Power!`);
  }
  if (mon.hp <= 0) return;
  if (B.weather.kind === 'rain' && mon.ability === 'Rain Dish') {
    await healMon(B, mon, mon.maxHp / 16, 'collected raindrops with Rain Dish!');
  }
  if (mon.item === 'Leftovers') {
    await healMon(B, mon, mon.maxHp * CONFIG.LEFTOVERS_FRAC, 'restored a little HP with its Leftovers!');
  }
  // leech seed — Champions wiki text says 1/16 (rebalanced from mainline 1/8)
  if (mon.volatile.leech && mon.ability !== 'Magic Guard') {
    const foe = B.activeFoe(mon);
    if (foe && foe.hp > 0) {
      const before = mon.hp;
      const drain = Math.max(1, Math.floor(mon.maxHp / 16));
      mon.hp = Math.max(0, mon.hp - drain);
      await B.E({ t: 'hp', mon, from: before, to: mon.hp, text: `${mon.name}'s health is sapped by Leech Seed!` });
      await healMon(B, foe, drain);
    }
  }
  if (mon.hp <= 0) return;
  // status residuals
  if (mon.status === 'brn') await chip(CONFIG.BURN_FRAC, `${mon.name} is hurt by its burn!`);
  else if (mon.status === 'psn') await chip(CONFIG.POISON_FRAC, `${mon.name} is hurt by poison!`);
  else if (mon.status === 'tox') {
    mon.toxCounter = (mon.toxCounter ?? 0) + 1;
    await chip(CONFIG.TOXIC_FRAC * mon.toxCounter, `${mon.name} is hurt by poison!`);
  }
  if (mon.hp <= 0) return;
  // yawn
  if (mon.volatile.yawn > 0) {
    mon.volatile.yawn--;
    if (mon.volatile.yawn === 0 && !mon.status) {
      await B.E({ t: 'msg', text: `${mon.name} couldn't stay awake!` });
      await inflictStatus(B, mon, 'slp');
    }
  }
  if (mon.ability === 'Speed Boost') {
    await changeStage(B, mon, 'spe', 1);
  }
}
