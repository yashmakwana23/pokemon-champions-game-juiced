// Central game state + localStorage persistence. All mutations go through
// helpers here so scenes stay declarative.
import { CONFIG } from '../data/config.js';
import { SPECIES } from '../data/species.js';
import { MOVES } from '../data/moves.js';

let S = null;
let uidCounter = 1;

export function state() { return S; }

export function newGame() {
  S = {
    v: 1,
    trainer: { name: 'Champion' },
    vp: CONFIG.VP_START,
    tickets: { teammate: 0, training: 1 },
    omniRing: false,
    box: [],
    team: [],                    // array of uids, up to 6
    inventory: {},               // itemName -> count
    megaStones: {},              // stoneName -> true
    rank: { tier: 0, rank: 0, pts: 0 },
    streak: 0,
    season: { sp: 0, claimed: [] },
    missions: { daily: null, starterClaimed: [], starterDone: [] },
    ranch: { lineup: [], refreshedAt: 0, trialDate: '' },
    flags: { ftue: false, tutorial: false, placement: false, kittIntro: false },
    settings: { sound: true, timer: true, battleInfo: true },
    record: { wins: 0, losses: 0, battles: 0, perMon: {} },
    uidCounter: 1,
  };
  return S;
}

export function save() {
  if (!S) return;
  S.uidCounter = uidCounter;
  try { localStorage.setItem(CONFIG.SAVE_KEY, JSON.stringify(S)); } catch { /* storage full/blocked */ }
}

export function load() {
  try {
    const raw = localStorage.getItem(CONFIG.SAVE_KEY);
    if (!raw) return null;
    S = JSON.parse(raw);
    uidCounter = S.uidCounter ?? 1000;
    // migration: saves from before the ftue flag existed
    if (S.box?.length && !S.flags.ftue) S.flags.ftue = true;
    return S;
  } catch { return null; }
}

export function wipeSave() {
  localStorage.removeItem(CONFIG.SAVE_KEY);
  S = null;
}

// ---------- Pokémon instances ----------
export function newInstance(speciesName, opts = {}) {
  const sp = SPECIES[speciesName];
  const inst = {
    uid: uidCounter++,
    species: speciesName,
    nature: opts.nature ?? 'Hardy',
    ability: opts.ability ?? sp.abilities[0],
    statPoints: opts.statPoints ?? { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
    moves: (opts.moves ?? sp.moves).slice(0, 4),
    item: opts.item ?? null,
    trialUntil: opts.trialUntil ?? null,   // timestamp; trials can't be trained
    wins: 0,
  };
  return inst;
}

export function addToBox(inst) {
  if (S.box.length >= boxCapacity()) return false;
  S.box.push(inst);
  return true;
}

export function boxCapacity() {
  // each tier's boxBonus is granted on entering that tier
  let cap = CONFIG.BOX_BASE;
  for (let t = 1; t <= S.rank.tier; t++) cap += CONFIG.RANK_TIERS[t].boxBonus;
  return cap;
}

export function getMon(uid) { return S.box.find(m => m.uid === uid) ?? null; }

export function isTrial(inst) {
  return inst.trialUntil != null && Date.now() < inst.trialUntil;
}

export function trialExpired(inst) {
  return inst.trialUntil != null && Date.now() >= inst.trialUntil;
}

// Remove expired trial rentals (called on hub entry).
export function sweepTrials() {
  const before = S.box.length;
  S.box = S.box.filter(m => !trialExpired(m));
  S.team = S.team.filter(uid => S.box.some(m => m.uid === uid));
  return before - S.box.length;
}

export function teamMons() {
  return S.team.map(getMon).filter(Boolean);
}

export function spendVP(amount) {
  if (S.vp < amount) return false;
  S.vp -= amount;
  return true;
}

export function grantVP(amount) { S.vp += amount; }

// PP for a move at full: from data.
export function movePP(name) { return MOVES[name]?.pp ?? 8; }
