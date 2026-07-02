// Missions & Season Pass — the non-battle VP faucets: starter missions
// (one-time), daily missions (reset every 24h), and the free season pass
// track fed by Season Points from every match.
import { el, clear, fmt } from '../engine/dom.js';
import { go } from '../engine/scenes.js';
import { CONFIG } from '../data/config.js';
import { state } from '../state/store.js';
import {
  ensureDailies, claimDaily, STARTER_MISSIONS, claimStarter,
  seasonLevel, SEASON_REWARDS, claimSeasonReward,
} from '../state/progression.js';
import { toast, topbar } from '../ui/widgets.js';
import { sfx } from '../engine/audio.js';

export const missionsScene = {
  async enter(root) {
    const S = state();
    ensureDailies();

    const body = el('div.screen-body', { style: { flexDirection: 'column', overflowY: 'auto' } });
    root.append(topbar('Missions & Season Pass', { onBack: () => go('hub') }), el('div.screen', {}, body));
    render();

    function render() {
      const lv = seasonLevel();
      clear(body).append(
        el('h3', {}, 'Daily missions — reset every day'),
        el('div.mission-list', { style: { flex: '0 0 auto' } },
          ...S.missions.daily.tasks.map(t => {
            const done = t.progress >= t.need;
            return el('div.mission.panel' + (done && !t.claimed ? '.done' : ''), {},
              el('div.info', {},
                el('b', {}, t.label),
                el('div.dim', { style: { fontSize: '0.78rem' } }, `${Math.min(t.progress, t.need)}/${t.need}`),
              ),
              el('span.reward', {}, `${fmt(t.vp)} VP`),
              t.claimed ? el('span.owned.dim', {}, 'Claimed')
                : el('button.btn.small.gold', {
                    disabled: !done,
                    onclick: () => { if (claimDaily(t.id)) { sfx.buy(); toast(`+${t.vp} VP`); render(); } },
                  }, 'Claim'),
            );
          }),
        ),
        el('h3', { style: { marginTop: '0.8rem' } }, 'Starter missions — one-time'),
        el('div.mission-list', { style: { flex: '0 0 auto' } },
          ...STARTER_MISSIONS.filter(m => m.vp > 0).map(m => {
            const done = S.missions.starterDone.includes(m.id);
            const claimed = S.missions.starterClaimed.includes(m.id);
            return el('div.mission.panel' + (done && !claimed ? '.done' : ''), {},
              el('div.info', {}, el('b', {}, m.label)),
              el('span.reward', {}, `${fmt(m.vp)} VP`),
              claimed ? el('span.owned.dim', {}, 'Claimed')
                : el('button.btn.small.gold', {
                    disabled: !done,
                    onclick: () => { if (claimStarter(m.id)) { sfx.buy(); toast(`+${m.vp} VP`); render(); } },
                  }, done ? 'Claim' : 'Locked'),
            );
          }),
        ),
        el('h3', { style: { marginTop: '0.8rem' } }, `Season pass — level ${lv} · ${fmt(S.season.sp)} SP (+${CONFIG.SP_PER_WIN}/win)`),
        el('div.season-track.panel', {},
          ...SEASON_REWARDS.map(r => {
            const unlocked = lv >= r.lv;
            const claimed = S.season.claimed.includes(r.lv);
            return el('div.season-node' + (unlocked ? '.unlocked' : '') + (claimed ? '.claimed' : ''), {},
              el('div.lv', {}, `LV ${r.lv}`),
              el('div', { style: { margin: '0.3rem 0', fontWeight: 700 } }, r.label),
              claimed ? el('small.dim', {}, '✔')
                : el('button.btn.small' + (unlocked ? '.gold' : ''), {
                    disabled: !unlocked,
                    onclick: () => { if (claimSeasonReward(r.lv)) { sfx.buy(); toast(`Season reward: ${r.label}!`); render(); } },
                  }, unlocked ? 'Claim' : '🔒'),
            );
          }),
        ),
      );
    }
  },
  exit() {},
};
