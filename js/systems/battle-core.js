// Turn-based battle engine (3v3 singles, bring-6-pick-3). Deterministic core;
// the scene supplies E(event) => Promise which paces animations, and
// getSwitch(sideIdx, forced) => Promise<partyIdx> for mid-turn replacements.
import { CONFIG } from '../data/config.js';
import { SPECIES } from '../data/species.js';
import { MEGAS } from '../data/megas.js';
import { MOVES } from '../data/moves.js';
import { computeStats, stageMult, accStageMult } from './stats.js';
import { calcDamage, typeMult } from './damage.js';
import {
  changeStage, inflictStatus, healMon, maybeLumBerry,
  applyEntryHazards, switchInAbilities, endTurnResiduals,
} from './battle-effects.js';
import { chance, roll, randInt } from '../engine/rng.js';

export function makeBattleMon(inst, sideRef) {
  const sp = SPECIES[inst.species];
  const stats = computeStats(sp.stats, inst.statPoints, inst.nature);
  const megaName = (sp.mega ?? []).find(m => MEGAS[m].stone === inst.item) ?? null;
  return {
    inst, name: inst.species, glyph: sp.glyph,
    types: sp.types.slice(), ability: inst.ability,
    baseAbility: inst.ability, stats, maxHp: stats.hp, hp: stats.hp,
    stages: { atk: 0, def: 0, spa: 0, spd: 0, spe: 0, acc: 0 },
    status: null, statusTurns: 0, toxCounter: 0, sleepTurns: 0,
    item: inst.item, usedItem: null,
    moves: inst.moves.map(n => ({ name: n, pp: MOVES[n]?.pp ?? 8, maxPp: MOVES[n]?.pp ?? 8 })),
    megaTarget: megaName, isMega: false,
    side: sideRef,
    turnsOnField: 0, protectCount: 0, protectedThisTurn: false,
    movedThisTurn: false, chosenAction: null,
    volatile: { confuse: 0, flinch: false, taunt: 0, leech: false, yawn: 0,
      choiceLock: null, disabled: null, disabledTurns: 0, charging: null,
      proteanUsed: false, proteanType: null, flashFire: false,
      disguiseBroken: false, berryPopped: null },
  };
}

export function createBattle({ playerPicks, aiPicks, playerTrainer, aiTrainer, mode, playerOmni, aiOmni, aiLevel }) {
  const B = {
    mode, turn: 0, winner: null, forfeited: false,
    weather: { kind: null, turns: 0 },
    field: { trickroom: 0 },
    aiLevel,
    counters: { superHits: 0, megaUsed: false },
    sides: [],
    E: async () => {}, getSwitch: async () => 0,
  };
  B.sides[0] = mkSide(0, playerTrainer, playerPicks, playerOmni);
  B.sides[1] = mkSide(1, aiTrainer, aiPicks, aiOmni);
  function mkSide(idx, trainer, picks, omni) {
    const side = {
      idx, trainer, omni, activeIdx: 0, megaUsed: false, faintCount: 0,
      hazards: { rocks: 0, web: 0, tspikes: 0 },
      screens: { reflect: 0, lightscreen: 0, auroraveil: 0 },
      tailwind: 0,
    };
    side.party = picks.map(inst => makeBattleMon(inst, side));
    return side;
  }
  B.active = (i) => B.sides[i].party[B.sides[i].activeIdx];
  B.activeFoe = (mon) => {
    const other = B.sides[1 - mon.side.idx];
    const foe = other.party[other.activeIdx];
    return foe && foe.hp > 0 ? foe : null;
  };
  return B;
}

export function effectiveSpeed(B, mon) {
  let spe = mon.stats.spe * stageMult(mon.stages.spe);
  if (mon.status === 'par') spe *= 0.5;
  if (mon.side.tailwind > 0) spe *= 2;
  if (mon.item === 'Choice Scarf') spe *= 1.5;
  const w = B.weather.kind;
  if ((mon.ability === 'Swift Swim' && w === 'rain') || (mon.ability === 'Chlorophyll' && w === 'sun')
    || (mon.ability === 'Sand Rush' && w === 'sand') || (mon.ability === 'Slush Rush' && w === 'snow')) spe *= 2;
  return spe;
}

// Legal UI actions for a side.
export function legalActions(B, sideIdx) {
  const side = B.sides[sideIdx];
  const mon = side.party[side.activeIdx];
  const foe = B.active(1 - sideIdx);
  const trapped = foe?.ability === 'Shadow Tag' && !mon.types.includes('Ghost');
  const out = { moves: [], switches: [], canMega: false, charging: null };
  if (mon.volatile.charging) { out.charging = mon.volatile.charging; return out; }
  for (let i = 0; i < mon.moves.length; i++) {
    const slot = mon.moves[i];
    const mv = MOVES[slot.name];
    let disabled = null;
    if (slot.pp <= 0) disabled = 'No PP left';
    else if (mon.volatile.choiceLock && mon.volatile.choiceLock !== slot.name) disabled = 'Locked by Choice item';
    else if (mon.volatile.disabled === slot.name) disabled = 'Disabled';
    else if (mon.volatile.taunt > 0 && mv.cat === 'status') disabled = 'Taunted';
    else if (mon.item === 'Assault Vest' && mv.cat === 'status') disabled = 'Assault Vest';
    else if (mv.firstTurnOnly && mon.turnsOnField > 0) disabled = 'Only works on first turn out';
    else if (mv.requiresSnow && B.weather.kind !== 'snow') disabled = 'Needs snow';
    out.moves.push({ idx: i, name: slot.name, pp: slot.pp, maxPp: slot.maxPp, disabled });
  }
  if (!trapped) {
    side.party.forEach((m, i) => { if (i !== side.activeIdx && m.hp > 0) out.switches.push(i); });
  }
  out.canMega = !!(side.omni && !side.megaUsed && !mon.isMega && mon.megaTarget);
  // Struggle fallback: no usable move and nowhere to run must never softlock
  if (!out.moves.some(m => !m.disabled) && out.switches.length === 0) {
    out.moves.push({ idx: 'struggle', name: 'Struggle', pp: 1, maxPp: 1, disabled: null });
  }
  return out;
}

export const STRUGGLE = {
  name: 'Struggle', type: 'Normal', cat: 'phys', power: 50, acc: null, pp: 1,
  priority: 0, contact: true, neverMiss: true,
  effects: [{ kind: 'recoilMax', pct: 25 }],
  desc: 'Used only when no other move can be selected. Hurts the user.',
};

async function megaEvolve(B, mon) {
  const mega = MEGAS[mon.megaTarget];
  if (!mega?.stats) return;
  await B.E({ t: 'msg', text: `${mon.name}'s ${mega.stone} is reacting to ${mon.side.trainer.name}'s Omni Ring!` });
  mon.isMega = true;
  mon.side.megaUsed = true;
  mon.name = mega.name;
  mon.types = mega.types.slice();
  mon.ability = mega.ability;
  const hpLost = mon.maxHp - mon.hp;
  const stats = computeStats(mega.stats, mon.inst.statPoints, mon.inst.nature);
  mon.stats = stats;
  mon.maxHp = stats.hp;
  mon.hp = Math.max(1, mon.maxHp - hpLost);
  if (mon.side.idx === 0) B.counters.megaUsed = true;
  await B.E({ t: 'mega', mon, text: `${mon.name} has Mega Evolved!` });
  await switchInAbilities(B, mon); // Drought (Charizard Y) etc. trigger on transform
}

async function doSwitch(B, side, toIdx, { entry = true } = {}) {
  const cur = side.party[side.activeIdx];
  if (cur && cur.hp > 0) {
    if (cur.ability === 'Regenerator') {
      cur.hp = Math.min(cur.maxHp, cur.hp + Math.floor(cur.maxHp / 3));
    }
    // volatile state clears on switch-out
    Object.assign(cur.volatile, { confuse: 0, flinch: false, taunt: 0, leech: false, yawn: 0,
      choiceLock: null, disabled: null, disabledTurns: 0, charging: null,
      proteanUsed: false, proteanType: null, flashFire: false });
    cur.stages = { atk: 0, def: 0, spa: 0, spd: 0, spe: 0, acc: 0 };
    cur.turnsOnField = 0;
    cur.toxCounter = 0; // badly-poisoned escalation resets on switch-out
    await B.E({ t: 'recall', mon: cur, text: `${side.trainer.name} withdrew ${cur.name}!` });
  }
  side.activeIdx = toIdx;
  const mon = side.party[toIdx];
  mon.turnsOnField = 0;
  await B.E({ t: 'switch', mon, side: side.idx, text: `${side.trainer.name} sent out ${mon.name}!` });
  await applyEntryHazards(B, mon);
  if (mon.hp > 0 && entry) await switchInAbilities(B, mon);
  if (mon.hp <= 0) await handleFaint(B, mon);
}

async function handleFaint(B, mon) {
  mon.side.faintCount = mon.side.party.filter(m => m.hp <= 0).length;
  await B.E({ t: 'faint', mon, text: `${mon.name} fainted!` });
  const foe = B.activeFoe(mon);
  if (foe && foe.ability === 'Moxie' && foe.hp > 0 && foe.movedThisTurn) {
    await B.E({ t: 'msg', text: `${foe.name}'s Moxie!` });
    await changeStage(B, foe, 'atk', 1);
  }
}

function sideAlive(side) { return side.party.some(m => m.hp > 0); }

async function checkWinner(B) {
  if (B.winner !== null) return true;
  const p = sideAlive(B.sides[0]), a = sideAlive(B.sides[1]);
  if (!p || !a) {
    B.winner = p ? 0 : a ? 1 : 1; // simultaneous KO: opponent wins the tiebreak
    return true;
  }
  return false;
}

async function replaceFainted(B) {
  for (const side of B.sides) {
    const mon = side.party[side.activeIdx];
    if (mon.hp > 0 || !sideAlive(side)) continue;
    const toIdx = await B.getSwitch(side.idx, true);
    await doSwitch(B, side, toIdx);
  }
}

// ---------- damage application ----------
async function applyDamage(B, target, dmg, { mult = 1, isDirect = true } = {}) {
  if (target.hp <= 0) return 0;
  if (isDirect && target.ability === 'Disguise' && !target.volatile.disguiseBroken) {
    target.volatile.disguiseBroken = true;
    const chip = Math.max(1, Math.floor(target.maxHp / 8));
    const before = target.hp;
    target.hp = Math.max(0, target.hp - chip);
    await B.E({ t: 'hp', mon: target, from: before, to: target.hp, text: `${target.name}'s disguise was busted!` });
    return 0;
  }
  let final = Math.min(dmg, target.hp);
  if (isDirect && final >= target.hp && target.hp === target.maxHp) {
    if (target.ability === 'Sturdy') {
      final = target.hp - 1;
      await B.E({ t: 'msg', text: `${target.name} endured the hit with Sturdy!` });
    } else if (target.item === 'Focus Sash') {
      final = target.hp - 1;
      target.item = null;
      await B.E({ t: 'msg', text: `${target.name} hung on using its Focus Sash!` });
    }
  }
  const before = target.hp;
  target.hp = Math.max(0, target.hp - final);
  await B.E({ t: 'hp', mon: target, from: before, to: target.hp, mult });
  if (target.volatile.berryPopped) {
    await B.E({ t: 'msg', text: `${target.name}'s ${target.volatile.berryPopped} weakened the attack!` });
    target.volatile.berryPopped = null;
  }
  if (target.hp > 0) {
    if (mult >= 2 && target.item === 'Weakness Policy') {
      target.item = null;
      await B.E({ t: 'msg', text: `${target.name}'s Weakness Policy activated!` });
      await changeStage(B, target, 'atk', 2);
      await changeStage(B, target, 'spa', 2);
    }
    if (target.item === 'Sitrus Berry' && target.hp <= target.maxHp / 2) {
      target.item = null;
      await healMon(B, target, target.maxHp / 4, 'restored HP with its Sitrus Berry!');
    }
  }
  return final;
}

// ---------- move execution ----------
async function executeMove(B, user, moveIdx) {
  if (user.hp <= 0 || B.winner !== null) return;
  const side = user.side;
  const foeSide = B.sides[1 - side.idx];
  let target = foeSide.party[foeSide.activeIdx];

  // pre-move interruptions
  if (user.volatile.flinch) {
    user.volatile.flinch = false;
    await B.E({ t: 'msg', text: `${user.name} flinched and couldn't move!` });
    return;
  }
  if (user.status === 'slp') {
    user.sleepTurns++;
    const wake = user.sleepTurns >= CONFIG.FREEZE_MAX_TURNS ? true
      : user.sleepTurns === 2 ? chance(CONFIG.SLEEP_WAKE_T2) : false;
    if (wake) {
      user.status = null; user.sleepTurns = 0;
      await B.E({ t: 'msg', text: `${user.name} woke up!` });
    } else {
      await B.E({ t: 'msg', text: `${user.name} is fast asleep.` });
      return;
    }
  }
  if (user.status === 'frz') {
    user.statusTurns++;
    if (user.statusTurns >= CONFIG.FREEZE_MAX_TURNS || chance(CONFIG.THAW_CHANCE)) {
      user.status = null; user.statusTurns = 0;
      await B.E({ t: 'msg', text: `${user.name} thawed out!` });
    } else {
      await B.E({ t: 'msg', text: `${user.name} is frozen solid!` });
      return;
    }
  }
  if (user.status === 'par' && chance(CONFIG.FULL_PARA_CHANCE)) {
    await B.E({ t: 'msg', text: `${user.name} is fully paralyzed!` });
    return;
  }
  if (user.volatile.confuse > 0) {
    user.volatile.confuse--;
    if (user.volatile.confuse === 0) {
      await B.E({ t: 'msg', text: `${user.name} snapped out of confusion!` });
    } else {
      await B.E({ t: 'msg', text: `${user.name} is confused!` });
      if (chance(CONFIG.CONFUSE_SELF_HIT)) {
        const A = user.stats.atk * stageMult(user.stages.atk);
        const D = user.stats.def * stageMult(user.stages.def);
        let dmg = Math.floor(Math.floor(Math.floor((2 * CONFIG.LEVEL) / 5 + 2) * 40 * (A / Math.max(1, D))) / 50) + 2;
        dmg = Math.floor(dmg * (CONFIG.DAMAGE_ROLL_MIN + Math.random() * 0.15));
        await B.E({ t: 'msg', text: 'It hurt itself in its confusion!' });
        await applyDamage(B, user, dmg, { isDirect: false });
        if (user.hp <= 0) { await handleFaint(B, user); }
        return;
      }
    }
  }

  // resolve move (charging continues automatically)
  let moveName, mv;
  if (moveIdx === 'struggle') {
    moveName = 'Struggle';
    mv = STRUGGLE;
  } else if (user.volatile.charging) {
    moveName = user.volatile.charging;
    user.volatile.charging = null;
    mv = MOVES[moveName];
  } else {
    const slot = user.moves[moveIdx];
    if (!slot) return;
    moveName = slot.name;
    const ppCost = target?.ability === 'Pressure' ? 2 : 1;
    slot.pp = Math.max(0, slot.pp - ppCost);
    if (user.item?.startsWith('Choice')) user.volatile.choiceLock = moveName;
    mv = MOVES[moveName];
  }
  user.movedThisTurn = true;
  await B.E({ t: 'usemove', mon: user, move: mv, text: `${user.name} used ${moveName}!` });

  // Solar Beam charge
  if (mv.chargeSolar && B.weather.kind !== 'sun' && !mv._charged) {
    user.volatile.charging = moveName;
    await B.E({ t: 'msg', text: `${user.name} is absorbing sunlight!` });
    return;
  }

  // Protean type shift (once per switch-in)
  if (user.ability === 'Protean' && !user.volatile.proteanUsed && !user.types.includes(mv.type)) {
    user.volatile.proteanUsed = true;
    user.volatile.proteanType = mv.type;
    user.types = [mv.type];
    await B.E({ t: 'msg', text: `${user.name} became ${mv.type}-type!` });
  }

  const selfTargeted = ['self', 'allySide', 'field', 'foeSide'].includes(mv.target) || mv.cat === 'status' && mv.acc === null;

  // Sucker Punch fails if the target isn't about to use a damaging move
  if (mv.effects?.some(e => e.kind === 'suckerpunch')) {
    const tAct = target?.chosenAction;
    const targetAttacking = tAct?.type === 'move' && !target.movedThisTurn
      && MOVES[target.moves[tAct.idx]?.name]?.cat !== 'status';
    if (!targetAttacking) {
      await B.E({ t: 'msg', text: 'But it failed!' });
      return;
    }
  }

  // status-move guards on the target
  if (!selfTargeted && target) {
    if (mv.cat === 'status' && target.ability === 'Good as Gold') {
      await B.E({ t: 'msg', text: `${target.name}'s Good as Gold blocks it!` });
      return;
    }
    if (mv.cat === 'status' && target.ability === 'Magic Bounce') {
      await B.E({ t: 'msg', text: `${target.name} bounced it back with Magic Bounce!` });
      target = user; // reflected onto the user
    }
  }
  if ((mv.target === 'foeSide') && B.active(1 - side.idx)?.ability === 'Magic Bounce') {
    await B.E({ t: 'msg', text: `${B.active(1 - side.idx).name} bounced it back with Magic Bounce!` });
    await applyHazard(B, side, mv.effects.find(e => e.kind === 'hazard').hazard);
    return;
  }

  // Protect check
  if (!selfTargeted && target?.protectedThisTurn && (mv.cat !== 'status' || mv.acc !== null)) {
    if (user.ability === 'Piercing Drill' && mv.contact && mv.cat !== 'status') {
      await B.E({ t: 'msg', text: `${user.name}'s Piercing Drill drills through the protection!` });
      await dealDamage(B, user, target, mv, { pierceMod: 0.25 });
      return;
    }
    await B.E({ t: 'msg', text: `${target.name} protected itself!` });
    return;
  }

  // accuracy
  if (!selfTargeted && mv.acc !== null && target) {
    const perfect = (mv.rainPerfect && B.weather.kind === 'rain') || (mv.snowPerfect && B.weather.kind === 'snow') || mv.neverMiss;
    if (!perfect) {
      let acc = mv.acc * accStageMult(user.stages.acc);
      if (user.item === 'Wide Lens') acc *= 1.1;
      if (!roll(acc)) {
        await B.E({ t: 'msg', text: `${user.name}'s attack missed!` });
        return;
      }
    }
  }

  if (mv.cat === 'status') {
    await applyMoveEffects(B, user, target, mv, { dealt: 0, mult: 1 });
  } else {
    await dealDamage(B, user, target, mv);
  }

  // pivot after successful move (U-turn / Volt Switch / Parting Shot)
  if (mv.effects?.some(e => e.kind === 'pivot') && user.hp > 0 && B.winner === null) {
    const benched = side.party.filter((m, i) => i !== side.activeIdx && m.hp > 0);
    if (benched.length) {
      const toIdx = await B.getSwitch(side.idx, false);
      if (toIdx != null && toIdx !== side.activeIdx && side.party[toIdx]?.hp > 0) {
        await doSwitch(B, side, toIdx);
      }
    }
  }
}

async function dealDamage(B, user, target, mv, { pierceMod = 1 } = {}) {
  if (!target || target.hp <= 0) { await B.E({ t: 'msg', text: 'But there was no target...' }); return; }

  // absorb-ability immunities (Mold Breaker pierces)
  if (user.ability !== 'Mold Breaker') {
    if (target.ability === 'Flash Fire' && mv.type === 'Fire') {
      target.volatile.flashFire = true;
      await B.E({ t: 'msg', text: `${target.name}'s Flash Fire absorbed the flames!` });
      return;
    }
    if (target.ability === 'Lightning Rod' && mv.type === 'Electric') {
      await B.E({ t: 'msg', text: `${target.name}'s Lightning Rod drew in the attack!` });
      await changeStage(B, target, 'spa', 1);
      return;
    }
  }

  const first = calcDamage({ move: mv, attacker: user, defender: target, battle: B });
  if (first.mult === 0) {
    await B.E({ t: 'msg', text: `It doesn't affect ${target.name}...` });
    return;
  }

  // multihit / Parental Bond
  let hits = 1;
  const mh = mv.effects?.find(e => e.kind === 'multihit');
  if (mh) hits = user.ability === 'Skill Link' ? mh.max : randInt(mh.min, mh.max);
  const bond = user.ability === 'Parental Bond' && !mh;

  let dealtTotal = 0, lastMult = first.mult, anyCrit = false;
  for (let h = 0; h < hits && target.hp > 0; h++) {
    const r = h === 0 ? first : calcDamage({ move: mv, attacker: user, defender: target, battle: B });
    r.dmg = Math.floor(r.dmg * pierceMod);
    dealtTotal += await applyDamage(B, target, Math.max(1, r.dmg), { mult: r.mult });
    anyCrit = anyCrit || r.crit;
    lastMult = r.mult;
    if (bond && target.hp > 0) {
      const r2 = calcDamage({ move: mv, attacker: user, defender: target, battle: B, opts: { forceNoCrit: true } });
      dealtTotal += await applyDamage(B, target, Math.max(1, Math.floor(r2.dmg * 0.25)), { mult: r2.mult });
    }
  }
  if (hits > 1) await B.E({ t: 'msg', text: `Hit ${hits} time${hits > 1 ? 's' : ''}!` });
  if (anyCrit) await B.E({ t: 'msg', text: 'A critical hit!' });

  // effectiveness commentary + counters
  if (lastMult >= 4) await B.E({ t: 'eff', mult: lastMult, text: "It's extremely effective!" });
  else if (lastMult >= 2) await B.E({ t: 'eff', mult: lastMult, text: "It's super effective!" });
  else if (lastMult > 0 && lastMult <= 0.26) await B.E({ t: 'eff', mult: lastMult, text: "It's mostly ineffective..." });
  else if (lastMult < 1) await B.E({ t: 'eff', mult: lastMult, text: "It's not very effective..." });
  if (lastMult >= 2 && user.side.idx === 0) B.counters.superHits++;

  // freeze thaws when hit by fire
  if (mv.type === 'Fire' && target.status === 'frz' && target.hp > 0) {
    target.status = null; target.statusTurns = 0;
    await B.E({ t: 'msg', text: `${target.name} was thawed out by the flames!` });
  }

  // contact consequences
  if (mv.contact && target.hp > 0 && user.hp > 0 && user.ability !== 'Magic Guard') {
    if (target.ability === 'Rough Skin') {
      const before = user.hp;
      user.hp = Math.max(0, user.hp - Math.max(1, Math.floor(user.maxHp / 8)));
      await B.E({ t: 'hp', mon: user, from: before, to: user.hp, text: `${user.name} was hurt by ${target.name}'s Rough Skin!` });
    }
    if (target.item === 'Rocky Helmet') {
      const before = user.hp;
      user.hp = Math.max(0, user.hp - Math.max(1, Math.floor(user.maxHp / 6)));
      await B.E({ t: 'hp', mon: user, from: before, to: user.hp, text: `${user.name} was hurt by the Rocky Helmet!` });
    }
    if (target.ability === 'Static' && chance(0.3) && user.hp > 0) {
      await B.E({ t: 'msg', text: `${target.name}'s Static!` });
      await inflictStatus(B, user, 'par');
    }
    if (target.ability === 'Flame Body' && chance(0.3) && user.hp > 0) {
      await B.E({ t: 'msg', text: `${target.name}'s Flame Body!` });
      await inflictStatus(B, user, 'brn');
    }
  }
  if (target.hp > 0 && target.ability === 'Cursed Body' && chance(0.3) && !user.volatile.disabled) {
    const slot = user.moves.find(s => s.name === mv.name);
    if (slot) {
      user.volatile.disabled = mv.name;
      user.volatile.disabledTurns = 3;
      await B.E({ t: 'msg', text: `${target.name}'s Cursed Body disabled ${mv.name}!` });
    }
  }
  if (target.hp > 0 && target.ability === 'Justified' && mv.type === 'Dark') {
    await changeStage(B, target, 'atk', 1);
  }

  // drain / recoil / self-effects / secondaries
  await applyMoveEffects(B, user, target, mv, { dealt: dealtTotal, mult: lastMult });

  if (user.item === 'Life Orb' && dealtTotal > 0 && user.hp > 0 && user.ability !== 'Magic Guard') {
    const before = user.hp;
    user.hp = Math.max(0, user.hp - Math.max(1, Math.floor(user.maxHp / 10)));
    await B.E({ t: 'hp', mon: user, from: before, to: user.hp, text: `${user.name} was hurt by its Life Orb!` });
  }
  if (user.item === "King's Rock" && dealtTotal > 0 && target.hp > 0 && !target.movedThisTurn && chance(0.1)) {
    target.volatile.flinch = true;
  }

  if (target.hp <= 0) await handleFaint(B, target);
  if (user.hp <= 0) await handleFaint(B, user);
}

async function applyHazard(B, targetSide, hazard) {
  if (hazard === 'rocks' && !targetSide.hazards.rocks) {
    targetSide.hazards.rocks = 1;
    await B.E({ t: 'msg', text: `Pointed stones float in the air around ${targetSide.trainer.name}'s team!` });
  } else if (hazard === 'web' && !targetSide.hazards.web) {
    targetSide.hazards.web = 1;
    await B.E({ t: 'msg', text: `A sticky web spreads beneath ${targetSide.trainer.name}'s team!` });
  } else if (hazard === 'tspikes' && targetSide.hazards.tspikes < 2) {
    targetSide.hazards.tspikes++;
    await B.E({ t: 'msg', text: `Poison spikes scatter around ${targetSide.trainer.name}'s team!` });
  } else {
    await B.E({ t: 'msg', text: 'But it failed!' });
  }
}

async function applyMoveEffects(B, user, target, mv, { dealt, mult }) {
  for (const e of mv.effects ?? []) {
    if (B.winner !== null) return;
    switch (e.kind) {
      case 'stage': {
        const who = e.who === 'self' ? user : target;
        if (!who || who.hp <= 0) break;
        if (e.chance && !roll(e.chance)) break;
        if (e.who === 'target' && mv.cat !== 'status' && dealt === 0) break;
        await changeStage(B, who, e.stat, e.delta, { fromFoe: e.who === 'target' });
        break;
      }
      case 'status': {
        if (!target || target.hp <= 0) break;
        if (e.chance < 100 && !roll(e.chance)) break;
        if (e.chance === 100 && mv.cat === 'status') {
          const m = typeMult({ ...mv, cat: 'phys', power: 1 }, user, target);
          if ((e.status === 'brn' && m === 0) || (e.status === 'par' && mv.type === 'Electric' && m === 0)
            || ((e.status === 'psn' || e.status === 'tox') && m === 0)) {
            await B.E({ t: 'msg', text: `It doesn't affect ${target.name}...` });
            break;
          }
        }
        await inflictStatus(B, target, e.status);
        break;
      }
      case 'flinch':
        if (target && target.hp > 0 && dealt > 0 && !target.movedThisTurn
          && target.ability !== 'Inner Focus' && roll(e.chance)) target.volatile.flinch = true;
        break;
      case 'confuse':
        if (target && target.hp > 0 && target.volatile.confuse === 0 && roll(e.chance)) {
          target.volatile.confuse = randInt(CONFIG.CONFUSE_MIN, CONFIG.CONFUSE_MAX);
          await B.E({ t: 'msg', text: `${target.name} became confused!` });
          await maybeLumBerry(B, target);
        }
        break;
      case 'heal': await healMon(B, user, user.maxHp * (e.pct / 100), 'regained health!'); break;
      case 'drain':
        if (dealt > 0) await healMon(B, user, dealt * (e.pct / 100), 'drained the energy!');
        break;
      case 'recoil':
        if (dealt > 0 && user.ability !== 'Magic Guard') {
          const before = user.hp;
          user.hp = Math.max(0, user.hp - Math.max(1, Math.floor(dealt * (e.pct / 100))));
          await B.E({ t: 'hp', mon: user, from: before, to: user.hp, text: `${user.name} is damaged by recoil!` });
        }
        break;
      case 'recoilMax':
        if (dealt > 0 && user.ability !== 'Magic Guard') {
          const before = user.hp;
          user.hp = Math.max(0, user.hp - Math.max(1, Math.floor(user.maxHp * (e.pct / 100))));
          await B.E({ t: 'hp', mon: user, from: before, to: user.hp, text: `${user.name} is hit with recoil!` });
        }
        break;
      case 'protect': {
        const ok = chance(1 / Math.pow(2, user.protectCount));
        if (ok) {
          user.protectedThisTurn = true;
          user.protectCount++;
          await B.E({ t: 'msg', text: `${user.name} protected itself!` });
        } else {
          await B.E({ t: 'msg', text: 'But it failed!' });
        }
        break;
      }
      case 'rest':
        if (user.hp < user.maxHp) {
          user.status = 'slp'; user.sleepTurns = 1; // wakes on schedule
          await healMon(B, user, user.maxHp, 'went to sleep and became healthy!');
        } else await B.E({ t: 'msg', text: 'But it failed!' });
        break;
      case 'yawn':
        if (target && !target.status && target.volatile.yawn === 0 && target.ability !== 'Good as Gold') {
          target.volatile.yawn = 2;
          await B.E({ t: 'msg', text: `${target.name} grew drowsy!` });
        } else await B.E({ t: 'msg', text: 'But it failed!' });
        break;
      case 'taunt':
        if (target && target.volatile.taunt === 0) {
          target.volatile.taunt = CONFIG.TAUNT_TURNS;
          await B.E({ t: 'msg', text: `${target.name} fell for the taunt!` });
        }
        break;
      case 'leechseed':
        if (target && !target.types.includes('Grass') && !target.volatile.leech) {
          target.volatile.leech = true;
          await B.E({ t: 'msg', text: `${target.name} was seeded!` });
        } else await B.E({ t: 'msg', text: 'But it failed!' });
        break;
      case 'bellydrum':
        if (user.hp > user.maxHp / 2 && user.stages.atk < 6) {
          const before = user.hp;
          user.hp -= Math.floor(user.maxHp / 2);
          await B.E({ t: 'hp', mon: user, from: before, to: user.hp, text: `${user.name} cut its own HP!` });
          user.stages.atk = 6;
          await B.E({ t: 'stage', mon: user, stat: 'atk', delta: 6, text: `${user.name} maximized its Attack!` });
        } else await B.E({ t: 'msg', text: 'But it failed!' });
        break;
      case 'knockoff':
        if (target && target.item && !target.megaTarget && dealt > 0) {
          await B.E({ t: 'msg', text: `${user.name} knocked off ${target.name}'s ${target.item}!` });
          target.item = null;
        }
        break;
      case 'hazard': await applyHazard(B, B.sides[1 - user.side.idx], e.hazard); break;
      case 'clearHazards': {
        const hz = user.side.hazards;
        if (hz.rocks || hz.web || hz.tspikes) {
          user.side.hazards = { rocks: 0, web: 0, tspikes: 0 };
          await B.E({ t: 'msg', text: `${user.name} blew away the hazards!` });
        }
        break;
      }
      case 'screen': {
        const scr = user.side.screens;
        if (scr[e.screen] > 0) { await B.E({ t: 'msg', text: 'But it failed!' }); break; }
        const turns = user.item === 'Light Clay' ? CONFIG.SCREEN_TURNS_CLAY : CONFIG.SCREEN_TURNS;
        scr[e.screen] = turns;
        const names = { reflect: 'Reflect raised physical defense!', lightscreen: 'Light Screen raised special defense!', auroraveil: 'Aurora Veil shields the team!' };
        await B.E({ t: 'msg', text: names[e.screen] });
        break;
      }
      case 'weather': {
        if (B.weather.kind === e.w) { await B.E({ t: 'msg', text: 'But it failed!' }); break; }
        const rocks = { sun: 'Heat Rock', rain: 'Damp Rock', sand: 'Smooth Rock', snow: 'Icy Rock' };
        B.weather = { kind: e.w, turns: user.item === rocks[e.w] ? CONFIG.WEATHER_TURNS_ROCK : CONFIG.WEATHER_TURNS };
        const names = { sun: 'The sunlight turned harsh!', rain: 'It started to rain!', sand: 'A sandstorm kicked up!', snow: 'It started to snow!' };
        await B.E({ t: 'weather', kind: e.w, text: names[e.w] });
        break;
      }
      case 'field':
        if (e.f === 'tailwind') {
          if (user.side.tailwind > 0) { await B.E({ t: 'msg', text: 'But it failed!' }); break; }
          user.side.tailwind = CONFIG.TAILWIND_TURNS;
          await B.E({ t: 'field', f: 'tailwind', text: `A tailwind blew from behind ${user.side.trainer.name}'s team!` });
        } else if (e.f === 'trickroom') {
          if (B.field.trickroom > 0) {
            B.field.trickroom = 0;
            await B.E({ t: 'field', f: 'trickroom', text: 'The twisted dimensions returned to normal!' });
          } else {
            B.field.trickroom = CONFIG.TRICKROOM_TURNS;
            await B.E({ t: 'field', f: 'trickroom', text: `${user.name} twisted the dimensions!` });
          }
        }
        break;
      // suckerpunch / pivot / multihit handled in executeMove/dealDamage
    }
  }
}

// ---------- the turn ----------
export async function runTurn(B, actions) {
  // actions: [{type:'move'|'switch'|'forfeit', idx, mega}] indexed by side
  B.turn++;
  for (const side of B.sides) {
    const mon = side.party[side.activeIdx];
    mon.protectedThisTurn = false;
    mon.movedThisTurn = false;
    mon.chosenAction = actions[side.idx];
  }

  if (actions[0].type === 'forfeit') {
    B.winner = 1; B.forfeited = true;
    await B.E({ t: 'msg', text: `${B.sides[0].trainer.name} forfeited the match.` });
    return;
  }

  // 1) switches
  const order = [0, 1].sort((a, b) => effectiveSpeed(B, B.active(b)) - effectiveSpeed(B, B.active(a)));
  for (const i of order) {
    if (actions[i].type === 'switch') await doSwitch(B, B.sides[i], actions[i].idx);
    if (await checkWinner(B)) return;
  }

  // 2) mega evolutions
  for (const i of order) {
    if (actions[i].type === 'move' && actions[i].mega) {
      const mon = B.active(i);
      if (B.sides[i].omni && !B.sides[i].megaUsed && mon.megaTarget && !mon.isMega) {
        await megaEvolve(B, mon);
      }
    }
  }

  // 3) moves, by priority bracket then speed
  const movers = [0, 1].filter(i => actions[i].type === 'move' || B.active(i).volatile.charging);
  const keyOf = (i) => {
    const mon = B.active(i);
    const mvName = mon.volatile.charging ?? mon.moves[actions[i].idx]?.name;
    const prio = mon.volatile.charging ? 0 : (MOVES[mvName]?.priority ?? 0);
    let spe = effectiveSpeed(B, mon);
    if (B.field.trickroom > 0) spe = 99999 - spe;
    let quick = 0;
    if (mon.item === 'Quick Claw' && chance(0.2)) quick = 1;
    return { prio, spe, quick, rnd: Math.random() };
  };
  const keys = Object.fromEntries(movers.map(i => [i, keyOf(i)]));
  movers.sort((a, b) =>
    keys[b].prio - keys[a].prio || keys[b].quick - keys[a].quick ||
    keys[b].spe - keys[a].spe || keys[b].rnd - keys[a].rnd);

  for (const i of movers) {
    if (B.winner !== null) return;
    const side = B.sides[i];
    const mon = side.party[side.activeIdx];
    if (mon.hp <= 0) continue;
    if (keys[i].quick) await B.E({ t: 'msg', text: `${mon.name}'s Quick Claw let it move first!` });
    await executeMove(B, mon, actions[i].idx);
    if (await checkWinner(B)) return;
    await replaceFainted(B);
    if (await checkWinner(B)) return;
  }

  // 4) end of turn
  await endOfTurn(B);
  if (await checkWinner(B)) return;
  await replaceFainted(B);
  await checkWinner(B);
}

async function endOfTurn(B) {
  // weather tick
  if (B.weather.kind) {
    B.weather.turns--;
    if (B.weather.turns <= 0) {
      const names = { sun: 'The sunlight faded.', rain: 'The rain stopped.', sand: 'The sandstorm subsided.', snow: 'The snow stopped.' };
      await B.E({ t: 'weather', kind: null, text: names[B.weather.kind] });
      B.weather = { kind: null, turns: 0 };
    }
  }
  // residuals in speed order
  const order = [0, 1].sort((a, b) => effectiveSpeed(B, B.active(b)) - effectiveSpeed(B, B.active(a)));
  for (const i of order) {
    const mon = B.active(i);
    if (mon.hp > 0) await endTurnResiduals(B, mon);
    if (mon.hp <= 0) await handleFaint(B, mon);
  }
  // side/field ticks
  for (const side of B.sides) {
    for (const k of Object.keys(side.screens)) {
      if (side.screens[k] > 0 && --side.screens[k] === 0) {
        const names = { reflect: 'Reflect', lightscreen: 'Light Screen', auroraveil: 'Aurora Veil' };
        await B.E({ t: 'msg', text: `${side.trainer.name}'s ${names[k]} wore off.` });
      }
    }
    if (side.tailwind > 0 && --side.tailwind === 0) {
      await B.E({ t: 'field', f: 'tailwind', text: `${side.trainer.name}'s tailwind petered out.` });
    }
  }
  if (B.field.trickroom > 0 && --B.field.trickroom === 0) {
    await B.E({ t: 'field', f: 'trickroom', text: 'The twisted dimensions returned to normal!' });
  }
  // per-mon turn upkeep
  for (const side of B.sides) {
    const mon = side.party[side.activeIdx];
    if (mon.hp <= 0) continue;
    mon.turnsOnField++;
    if (!mon.protectedThisTurn) mon.protectCount = 0;
    if (mon.volatile.taunt > 0) mon.volatile.taunt--;
    if (mon.volatile.disabledTurns > 0 && --mon.volatile.disabledTurns === 0) mon.volatile.disabled = null;
    mon.volatile.flinch = false;
  }
}
