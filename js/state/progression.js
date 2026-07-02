// Ranked ladder, VP payouts, missions and season pass — the "earn" half of
// the loop. Numbers from CONFIG (GDD-sourced).
import { CONFIG } from '../data/config.js';
import { state, save, grantVP } from './store.js';

export function rankInfo() {
  const S = state();
  const tier = CONFIG.RANK_TIERS[S.rank.tier];
  return {
    tierIdx: S.rank.tier, tierName: tier.name,
    rank: S.rank.rank + 1, ranksInTier: tier.ranks,
    pts: S.rank.pts, gauge: CONFIG.RANK_GAUGE,
    label: tier.ranks > 1 ? `${tier.name} Tier · Rank ${S.rank.rank + 1}` : `${tier.name} Tier`,
  };
}

// Applies a match result. Returns a summary consumed by the results screen.
export function applyResult({ mode, won }) {
  const S = state();
  const out = { won, mode, vpBase: 0, vpStreak: 0, rankDelta: 0, promotions: [], spGained: 0, rankUps: [] };

  S.record.battles++;
  if (won) { S.record.wins++; S.streak++; } else { S.record.losses++; S.streak = 0; }

  // --- VP ---
  if (mode === 'ranked') out.vpBase = won ? CONFIG.VP_WIN_RANKED : CONFIG.VP_LOSS_RANKED;
  else if (mode === 'casual') out.vpBase = won ? CONFIG.VP_WIN_CASUAL : CONFIG.VP_LOSS_CASUAL;
  if (won && mode === 'ranked' && S.streak > 1) {
    out.vpStreak = Math.min(CONFIG.VP_STREAK_BONUS * (S.streak - 1), CONFIG.VP_STREAK_CAP);
  }
  grantVP(out.vpBase + out.vpStreak);

  // --- season pass ---
  if (mode === 'ranked' || mode === 'casual') {
    out.spGained = won ? CONFIG.SP_PER_WIN : CONFIG.SP_PER_LOSS;
    S.season.sp += out.spGained;
  }

  // --- rank gauge (ranked only; Champion tier is terminal) ---
  if (mode === 'ranked' && S.rank.tier < CONFIG.RANK_TIERS.length - 1) {
    const protectedTier = S.rank.tier <= 1; // Beginner & Poké Ball: losses still trickle forward
    let delta = won ? CONFIG.RANK_WIN_PTS
      : (protectedTier ? CONFIG.RANK_LOSS_PTS_PROTECTED : CONFIG.RANK_LOSS_PTS);
    S.rank.pts += delta;
    out.rankDelta = delta;
    if (S.rank.pts < 0) S.rank.pts = 0; // floor — no demotion below rank bottom
    while (S.rank.pts >= CONFIG.RANK_GAUGE) {
      S.rank.pts -= CONFIG.RANK_GAUGE;
      const up = promote();
      if (!up) { S.rank.pts = CONFIG.RANK_GAUGE - 1; break; }
      out.rankUps.push(up);
      grantVP(CONFIG.VP_RANKUP);
    }
  }

  save();
  return out;
}

function promote() {
  const S = state();
  const tier = CONFIG.RANK_TIERS[S.rank.tier];
  if (S.rank.rank + 1 < tier.ranks) {
    S.rank.rank++;
    return { label: `${tier.name} Tier · Rank ${S.rank.rank + 1}`, vp: CONFIG.VP_RANKUP, tierUp: false };
  }
  if (S.rank.tier + 1 < CONFIG.RANK_TIERS.length) {
    S.rank.tier++;
    S.rank.rank = 0;
    const t = CONFIG.RANK_TIERS[S.rank.tier];
    return { label: `${t.name} Tier`, vp: CONFIG.VP_RANKUP, tierUp: true, boxBonus: t.boxBonus };
  }
  return null;
}

// Direct tier set (Emma placement match promotes Beginner -> Poké Ball).
export function promoteToPokeBall() {
  const S = state();
  if (S.rank.tier === 0) { S.rank.tier = 1; S.rank.rank = 0; S.rank.pts = 0; save(); }
}

// ---------- season pass ----------
export function seasonLevel() {
  return Math.min(CONFIG.SP_MAX_LEVEL, Math.floor(state().season.sp / CONFIG.SP_PER_LEVEL));
}

export const SEASON_REWARDS = [
  { lv: 1,  what: 'vp', n: 500,  label: '500 VP' },
  { lv: 2,  what: 'vp', n: 500,  label: '500 VP' },
  { lv: 3,  what: 'teammate', n: 1, label: 'Teammate Ticket' },
  { lv: 4,  what: 'vp', n: 750,  label: '750 VP' },
  { lv: 5,  what: 'training', n: 1, label: 'Training Ticket' },
  { lv: 6,  what: 'vp', n: 750,  label: '750 VP' },
  { lv: 8,  what: 'vp', n: 1000, label: '1,000 VP' },
  { lv: 10, what: 'teammate', n: 1, label: 'Teammate Ticket' },
  { lv: 12, what: 'training', n: 1, label: 'Training Ticket' },
  { lv: 14, what: 'vp', n: 1500, label: '1,500 VP' },
  { lv: 16, what: 'vp', n: 1500, label: '1,500 VP' },
  { lv: 18, what: 'teammate', n: 1, label: 'Teammate Ticket' },
  { lv: 20, what: 'vp', n: 3000, label: '3,000 VP' },
];

export function claimSeasonReward(lv) {
  const S = state();
  const r = SEASON_REWARDS.find(r => r.lv === lv);
  if (!r || S.season.claimed.includes(lv) || seasonLevel() < lv) return false;
  S.season.claimed.push(lv);
  if (r.what === 'vp') grantVP(r.n);
  else if (r.what === 'teammate') S.tickets.teammate += r.n;
  else if (r.what === 'training') S.tickets.training += r.n;
  save();
  return true;
}

// ---------- missions ----------
export const STARTER_MISSIONS = [
  { id: 'tutorial',  label: 'Complete the Battle Tutorial', vp: 0 },     // pays via VP_TUTORIAL
  { id: 'placement', label: 'Win your placement match vs Emma', vp: 2000 },
  { id: 'recruit',   label: 'Recruit a Pokémon at the Roster Ranch', vp: 1500 },
  { id: 'train',     label: 'Train a Pokémon in the Training Room', vp: 1500 },
  { id: 'item',      label: 'Buy an item at the Frontier Shop', vp: 1000 },
  { id: 'mega',      label: 'Mega Evolve a Pokémon in battle', vp: 2000 },
  { id: 'rankwin3',  label: 'Win 3 Ranked battles', vp: 3000 },
];

const DAILY_POOL = [
  { id: 'play1', label: 'Battle once (any mode)', vp: 200, need: 1, counts: 'battles' },
  { id: 'win1',  label: 'Win a battle', vp: 300, need: 1, counts: 'wins' },
  { id: 'super', label: 'Land 3 super-effective moves', vp: 200, need: 3, counts: 'super' },
  { id: 'scout', label: 'Visit the Roster Ranch', vp: 100, need: 1, counts: 'scout' },
  { id: 'mega',  label: 'Mega Evolve once', vp: 300, need: 1, counts: 'mega' },
];

export function todayKey() { return new Date().toISOString().slice(0, 10); }

export function ensureDailies() {
  const S = state();
  if (S.missions.daily?.date === todayKey()) return S.missions.daily;
  // deterministic-ish daily pick: rotate pool by day-of-year
  const day = Math.floor(Date.now() / 86400000);
  const tasks = [0, 1, 2].map(i => {
    const t = DAILY_POOL[(day + i * 2) % DAILY_POOL.length];
    return { ...t, progress: 0, claimed: false };
  });
  S.missions.daily = { date: todayKey(), tasks };
  save();
  return S.missions.daily;
}

export function missionEvent(kind, n = 1) {
  const S = state();
  const d = S.missions.daily;
  if (!d || d.date !== todayKey()) return;
  for (const t of d.tasks) {
    if (t.counts === kind && !t.claimed) t.progress = Math.min(t.need, t.progress + n);
  }
  save();
}

export function markStarterDone(id) {
  const S = state();
  if (!S.missions.starterDone.includes(id)) { S.missions.starterDone.push(id); save(); }
}

export function claimStarter(id) {
  const S = state();
  const m = STARTER_MISSIONS.find(m => m.id === id);
  if (!m || !S.missions.starterDone.includes(id) || S.missions.starterClaimed.includes(id)) return false;
  S.missions.starterClaimed.push(id);
  grantVP(m.vp);
  save();
  return true;
}

export function claimDaily(id) {
  const S = state();
  const t = S.missions.daily?.tasks.find(t => t.id === id);
  if (!t || t.claimed || t.progress < t.need) return false;
  t.claimed = true;
  grantVP(t.vp);
  save();
  return true;
}
