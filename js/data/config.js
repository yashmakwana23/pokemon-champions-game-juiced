// Tunable balance constants. Every number here traces to the GDD field guide
// (reconstructed from 292 videos); deviations are listed in the README.
export const CONFIG = {
  LEVEL: 50,           // all Pokémon arrive at level 50
  IV: 31,              // perfect hidden stats, always
  STAT_POINTS_TOTAL: 66,   // simplified EV pool
  STAT_POINTS_MAX: 32,     // per-stat cap

  // --- battle ---
  DAMAGE_ROLL_MIN: 0.85,   // uniform 0.85–1.00
  CRIT_CHANCE: 1 / 24,     // 4.17%, crit = 1.5x
  CRIT_MULT: 1.5,
  MOVE_TIMER_S: 45,        // per-decision timer; auto-move on expiry
  SINGLES_PICK: 3,         // bring 6, pick 3
  WEATHER_TURNS: 5,
  WEATHER_TURNS_ROCK: 8,   // with matching weather rock
  SCREEN_TURNS: 5,
  SCREEN_TURNS_CLAY: 8,    // with Light Clay
  TAILWIND_TURNS: 4,
  TRICKROOM_TURNS: 5,
  TAUNT_TURNS: 3,
  BURN_FRAC: 1 / 16,
  POISON_FRAC: 1 / 8,
  TOXIC_FRAC: 1 / 16,      // escalates +1/16 each turn
  SAND_CHIP_FRAC: 1 / 16,
  LEFTOVERS_FRAC: 1 / 16,
  FULL_PARA_CHANCE: 0.125, // Champions rebalance (was 25%)
  THAW_CHANCE: 0.25,       // Champions rebalance (was 20%)
  FREEZE_MAX_TURNS: 3,     // guaranteed thaw on 3rd turn
  SLEEP_WAKE_T2: 1 / 3,    // 33% wake on 2nd turn, guaranteed on 3rd
  CONFUSE_SELF_HIT: 0.33,
  CONFUSE_MIN: 2, CONFUSE_MAX: 4,

  // --- economy (VP) ---
  VP_START: 3000,          // account-link starter mission equivalent
  VP_WIN_RANKED: 300,
  VP_LOSS_RANKED: 100,
  VP_WIN_CASUAL: 200,
  VP_LOSS_CASUAL: 50,
  VP_STREAK_BONUS: 50,     // per consecutive win, capped
  VP_STREAK_CAP: 300,
  VP_TUTORIAL: 10000,      // one-time tutorial completion payout
  VP_RANKUP: 1000,         // per rank-up
  COST_STAT_POINT: 5,
  COST_MOVE: 250,
  COST_NATURE: 500,
  COST_ABILITY: 500,
  COST_MEGA_STONE: 2000,
  RECRUIT_PRICES: { common: 1000, standard: 2500, rare: 5000, epic: 8000 },
  LINEUP_SIZE: 5,
  LINEUP_COOLDOWN_H: 22,
  LINEUP_SKIP_VP_PER_H: 100,
  TRIAL_DAYS: 7,           // free daily trial recruit; trials can't be trained

  // --- box & ladder ---
  BOX_BASE: 30,
  TEAM_SIZE: 6,
  RANK_TIERS: [
    { name: 'Beginner',    ranks: 1, boxBonus: 0 },
    { name: 'Poké Ball',   ranks: 4, boxBonus: 0 },
    { name: 'Great Ball',  ranks: 4, boxBonus: 5 },
    { name: 'Ultra Ball',  ranks: 4, boxBonus: 5 },
    { name: 'Master Ball', ranks: 4, boxBonus: 10 },
    { name: 'Champion',    ranks: 1, boxBonus: 0 },
  ],
  RANK_GAUGE: 100,         // 0–100 gauge per rank
  RANK_WIN_PTS: 25,
  RANK_LOSS_PTS_PROTECTED: 5,   // Beginner/Poké Ball: losses still trickle forward
  RANK_LOSS_PTS: -10,           // Great Ball and up: losses cost progress (floor 0)

  // --- season pass (battle pass, free track) ---
  SP_PER_WIN: 100,
  SP_PER_LOSS: 40,
  SP_PER_LEVEL: 100,
  SP_MAX_LEVEL: 20,

  SAVE_KEY: 'pokemon-champions-save-v1',
};
