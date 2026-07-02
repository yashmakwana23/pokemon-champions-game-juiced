// Results — WON!/LOST banner, VP breakdown with streak bonus, animated rank
// gauge with promotions, season points; routes tutorial/placement rewards.
import { el, fmt, sleep } from '../engine/dom.js';
import { go } from '../engine/scenes.js';
import { CONFIG } from '../data/config.js';
import { state, save, grantVP } from '../state/store.js';
import { applyResult, rankInfo, promoteToPokeBall, markStarterDone, missionEvent } from '../state/progression.js';
import { NPCS, DIALOGUE } from '../data/trainers.js';
import { playDialogue, toast } from '../ui/widgets.js';
import { sfx } from '../engine/audio.js';

export const resultsScene = {
  async enter(root, { won, mode, opp, counters, forfeited }) {
    const S = state();

    // mission counters from the battle
    missionEvent('battles');
    if (won) missionEvent('wins');
    if (counters?.superHits) missionEvent('super', counters.superHits);
    if (counters?.megaUsed) { missionEvent('mega'); markStarterDone('mega'); }

    // scripted flows -----------------------------------------------------
    if (mode === 'tutorial') {
      const firstTime = !S.flags.tutorial;
      if (firstTime && won) {
        S.flags.tutorial = true;
        grantVP(CONFIG.VP_TUTORIAL);
        S.omniRing = true;
        S.tickets.teammate += 1;
        markStarterDone('tutorial');
        save();
      }
      root.append(banner(won ? 'WON!' : 'LOST...', won),
        panel([
          firstTime && won ? line('Tutorial reward', `+${fmt(CONFIG.VP_TUTORIAL)} VP`) : null,
          firstTime && won ? line('Omni Ring', 'unlocked 💍') : null,
          firstTime && won ? line('Teammate Ticket', '+1 🎟') : null,
          !won ? el('p.dim', {}, 'Cordy: "No worries — rematch me from the Battle menu any time."') : null,
        ]),
        buttons([won ? ['Continue', () => go('hub')] : ['Try again', () => go('battle', { mode: 'tutorial' })], ['To the Gym', () => go('hub')]]),
      );
      sfx[won ? 'win' : 'lose']();
      return;
    }

    if (mode === 'placement') {
      if (won) {
        promoteToPokeBall();
        markStarterDone('placement');
        if (!S.omniRing) { S.omniRing = true; }
        save();
      }
      root.append(banner(won ? 'WON!' : 'LOST...', won),
        panel([
          won ? line('Placement', 'Poké Ball Tier unlocked 🏆') : null,
          won ? el('p.dim', {}, 'Ranked ladder, streak bonuses and rank-up rewards are now live.') : el('p.dim', {}, 'Emma: "Shake it off — challenge me again!"'),
        ]),
        buttons([['Continue', async () => {
          if (won) await playDialogue(DIALOGUE.postEmma, NPCS);
          go('hub');
        }]]),
      );
      sfx[won ? 'win' : 'lose']();
      return;
    }

    // ladder matches ------------------------------------------------------
    const before = rankInfo();
    const res = applyResult({ mode, won });
    const after = rankInfo();

    // track per-mon wins for flavor achievements
    if (won) for (const uid of S.team) {
      const m = S.box.find(x => x.uid === uid);
      if (m) m.wins = (m.wins ?? 0) + 1;
    }
    // starter mission: 3 ranked wins
    if (mode === 'ranked' && won) {
      S.record.rankedWins = (S.record.rankedWins ?? 0) + 1;
      if (S.record.rankedWins >= 3) markStarterDone('rankwin3');
    }
    save();

    const gauge = el('div.gauge', { style: { width: '100%' } }, el('i', { style: { width: `${before.pts}%` } }));

    root.append(
      banner(won ? 'WON!' : forfeited ? 'FORFEITED' : 'LOST...', won),
      panel([
        el('div.row', { style: { justifyContent: 'space-between' } },
          el('b', {}, `vs ${opp.trainer.name}`), el('small.dim', {}, opp.trainer.title)),
        line(`${mode === 'ranked' ? 'Ranked' : 'Casual'} ${won ? 'victory' : 'defeat'}`, `+${fmt(res.vpBase)} VP`),
        res.vpStreak ? line(`Win streak ×${S.streak} bonus`, `+${fmt(res.vpStreak)} VP`) : null,
        res.rankUps.length ? line('Rank-up bonus', `+${fmt(CONFIG.VP_RANKUP * res.rankUps.length)} VP`) : null,
        line('Season points', `+${res.spGained} SP`),
        mode === 'ranked' ? el('div', { style: { marginTop: '0.4rem' } },
          el('div.row', { style: { justifyContent: 'space-between' } },
            el('small.dim.caps', {}, after.label),
            el('small.dim', {}, `${res.rankDelta >= 0 ? '+' : ''}${res.rankDelta} pts`)),
          gauge,
        ) : null,
        ...res.rankUps.map(up => el('div.rankup-banner', {}, `⬆ RANK UP! ${up.label}${up.tierUp ? ' — new tier!' : ''}`)),
        res.rankUps.some(u => u.tierUp && u.boxBonus) ? el('p.dim', { style: { textAlign: 'center' } }, 'Box capacity increased!') : null,
      ]),
      buttons([
        ['⚔ Battle again', () => go('battle-select')],
        ['To the Gym', () => go('hub')],
      ]),
    );

    sfx[won ? 'win' : 'lose']();
    if (res.rankUps.length) { await sleep(500); sfx.rankup(); }
    await sleep(80);
    gauge.querySelector('i').style.width = `${after.pts}%`;
  },
  exit() {},
};

function banner(text, won) {
  return el('div.results', { style: { flex: '0 0 auto', paddingBottom: 0 } },
    el('div.verdict.' + (won ? 'won' : 'lost'), {}, text));
}
function panel(children) {
  return el('div.results', { style: { flex: '0 0 auto', paddingTop: 0 } },
    el('div.results-panel.panel', {}, ...children.filter(Boolean)));
}
function line(label, amount) {
  return el('div.vp-line', {}, el('span.dim', {}, label), el('span.amount', {}, amount));
}
function buttons(defs) {
  return el('div.results', { style: { flex: '0 0 auto', paddingTop: 0 } },
    el('div.row', {}, ...defs.map(([label, fn]) =>
      el('button.btn' + (label.includes('Battle') || label === 'Continue' ? '.primary' : ''), { onclick: fn }, label))));
}
