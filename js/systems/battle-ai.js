// Opponent AI. aiLevel scales with ladder tier: 0 random-ish (Beginner),
// 1 greedy damage, 2 tactical (status/setup/switching), 3 expert (mega timing,
// accuracy weighting, hazards early).
import { MOVES } from '../data/moves.js';
import { calcDamage, typeMult } from './damage.js';
import { legalActions, effectiveSpeed, STRUGGLE } from './battle-core.js';
import { eff } from '../data/types.js';
import { pick, chance } from '../engine/rng.js';

function estimateDamage(B, user, target, mv) {
  if (mv.cat === 'status' || mv.power === 0) return 0;
  // average three rolls, crits off — cheap and tracks the real pipeline
  let sum = 0;
  for (let i = 0; i < 3; i++) {
    sum += calcDamage({ move: mv, attacker: user, defender: target, battle: B, opts: { forceNoCrit: true } }).dmg;
  }
  let d = sum / 3;
  if (mv.acc !== null) d *= mv.acc / 100;
  const mh = mv.effects?.find(e => e.kind === 'multihit');
  if (mh) d *= (mh.min + mh.max) / 2;
  return d;
}

function incomingThreat(B, mon, foe) {
  // worst expected hit from the foe's known moves, as fraction of our HP
  let worst = 0;
  for (const slot of foe.moves) {
    const mv = MOVES[slot.name];
    if (!mv || mv.cat === 'status' || slot.pp <= 0) continue;
    worst = Math.max(worst, estimateDamage(B, foe, mon, mv));
  }
  return worst / Math.max(1, mon.hp);
}

function matchupScore(B, mon, foe) {
  let best = 0;
  for (const name of mon.inst.moves) {
    const mv = MOVES[name];
    if (!mv || mv.cat === 'status') continue;
    best = Math.max(best, typeMult(mv, mon, foe) * (mon.types.includes(mv.type) ? 1.5 : 1));
  }
  let defense = 1;
  for (const t of foe.types) defense *= eff(t, mon.types);
  return best / Math.max(0.25, defense);
}

export function chooseSwitch(B, sideIdx) {
  const side = B.sides[sideIdx];
  const foe = B.active(1 - sideIdx);
  const options = side.party
    .map((m, i) => ({ m, i }))
    .filter(o => o.i !== side.activeIdx && o.m.hp > 0);
  if (!options.length) return side.activeIdx;
  if (!foe || B.aiLevel === 0) return pick(options).i;
  options.sort((a, b) => matchupScore(B, b.m, foe) - matchupScore(B, a.m, foe));
  return options[0].i;
}

export function chooseAction(B, sideIdx) {
  const side = B.sides[sideIdx];
  const mon = side.party[side.activeIdx];
  const foe = B.active(1 - sideIdx);
  const legal = legalActions(B, sideIdx);
  const lvl = B.aiLevel ?? 1;

  if (legal.charging) return { type: 'move', idx: 0 };
  const usable = legal.moves.filter(m => !m.disabled);
  if (!usable.length) {
    if (legal.switches.length) return { type: 'switch', idx: chooseSwitch(B, sideIdx) };
    return { type: 'move', idx: legal.moves[0]?.idx ?? 0 };
  }
  const mega = legal.canMega && (lvl >= 2 || chance(0.5));
  if (!foe) return { type: 'move', idx: pick(usable).idx, mega };
  if (lvl === 0) return { type: 'move', idx: pick(usable).idx, mega };

  const myHpFrac = mon.hp / mon.maxHp;
  const threat = incomingThreat(B, mon, foe);
  const faster = effectiveSpeed(B, mon) >= effectiveSpeed(B, foe);

  // consider escaping a bad matchup (lvl 2+)
  if (lvl >= 2 && legal.switches.length && threat > 0.45 && !faster) {
    const bestEff = Math.max(...usable.map(u => typeMult(MOVES[u.name] ?? STRUGGLE, mon, foe)));
    if (bestEff <= 0.5 && chance(0.7)) {
      return { type: 'switch', idx: chooseSwitch(B, sideIdx) };
    }
  }

  let best = null, bestScore = -1;
  for (const u of usable) {
    const mv = MOVES[u.name] ?? STRUGGLE;
    let score = 0;
    if (mv.cat !== 'status') {
      const d = estimateDamage(B, mon, foe, mv);
      score = Math.min(1.6, d / Math.max(1, foe.hp)); // KO potential saturates
      if (d >= foe.hp) score += faster ? 1.2 : 0.7;    // likely KO
      if (mv.effects?.some(e => e.kind === 'recoil' || e.kind === 'recoilMax') && myHpFrac < 0.35) score -= 0.4;
      if (mv.effects?.some(e => e.kind === 'suckerpunch') && lvl >= 2) score -= 0.25; // risky
      if (mv.effects?.some(e => e.kind === 'pivot') && threat > 0.35 && lvl >= 2) score += 0.25;
    } else if (lvl >= 2) {
      const safe = threat < 0.3;
      for (const e of mv.effects ?? []) {
        if (e.kind === 'stage' && e.who === 'self' && e.delta > 0 && safe && myHpFrac > 0.6) score += 0.55 + 0.1 * e.delta;
        if (e.kind === 'status' && !foe.status) {
          if (e.status === 'brn' && foe.stats.atk >= foe.stats.spa) score += 0.7;
          if (e.status === 'par' && !faster) score += 0.7;
          if (e.status === 'slp' || e.status === 'tox') score += 0.65;
          if (e.status === 'psn') score += 0.3;
        }
        if (e.kind === 'heal' && myHpFrac < 0.45) score += 0.9;
        if (e.kind === 'rest' && myHpFrac < 0.4) score += 0.8;
        if (e.kind === 'hazard' && B.turn <= 3 && lvl >= 3) score += 0.6;
        if (e.kind === 'screen' && B.turn <= 4) score += 0.45;
        if (e.kind === 'weather') score += 0.35;
        if (e.kind === 'field') score += 0.35;
        if (e.kind === 'protect' && mon.protectCount === 0 && threat > 0.25 && chance(0.5)) score += 0.5;
        if (e.kind === 'bellydrum' && myHpFrac > 0.85 && threat < 0.25) score += 1.0;
        if (e.kind === 'taunt' && foe.inst.moves.filter(n => MOVES[n]?.cat === 'status').length >= 2) score += 0.5;
        if (e.kind === 'leechseed' && !foe.types.includes('Grass')) score += 0.4;
        if (e.kind === 'yawn' && !foe.status) score += 0.5;
      }
    }
    score += Math.random() * (lvl >= 3 ? 0.15 : lvl === 2 ? 0.3 : 0.6); // noise
    if (score > bestScore) { bestScore = score; best = u; }
  }
  return { type: 'move', idx: best.idx, mega };
}
