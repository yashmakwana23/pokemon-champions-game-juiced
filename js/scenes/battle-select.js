// Battle menu → matchmaking VS splash → Team Preview (see opponent's 6 with
// items/types, pick your 3 + order) → battle. Placement match vs Emma gates
// Ranked while in Beginner Tier.
import { el, clear } from '../engine/dom.js';
import { go } from '../engine/scenes.js';
import { SPECIES } from '../data/species.js';
import { MEGAS } from '../data/megas.js';
import { CONFIG } from '../data/config.js';
import { state, teamMons } from '../state/store.js';
import { rankInfo } from '../state/progression.js';
import { generateOpponent, scriptedTeam } from '../systems/teamgen.js';
import { EMMA_TEAM, NPCS, DIALOGUE } from '../data/trainers.js';
import { monToken, typeBadge, toast, topbar, rankChip, playDialogue } from '../ui/widgets.js';
import { sleep } from '../engine/dom.js';
import { sfx } from '../engine/audio.js';

export const battleSelectScene = {
  async enter(root, params = {}) {
    const S = state();
    const team = teamMons();
    const r = rankInfo();

    if (params.phase === 'preview') return preview(root, params);

    const needTeam = team.length < CONFIG.TEAM_SIZE;
    const placement = S.rank.tier === 0;

    const modes = [
      {
        id: 'ranked', ic: '🏆',
        t: placement ? 'Placement Match' : 'Ranked Battle',
        d: placement ? 'Beat Emma to enter Poké Ball Tier' : `${r.label} · win +${CONFIG.RANK_WIN_PTS} pts · ${CONFIG.VP_WIN_RANKED} VP`,
      },
      { id: 'casual', ic: '🎮', t: 'Casual Battle', d: `No rank stakes · ${CONFIG.VP_WIN_CASUAL} VP per win` },
      { id: 'tutorial', ic: '🎓', t: 'Battle Tutorial', d: 'Rematch Cordy’s lesson team' },
    ];

    root.append(
      topbar('Battle', { onBack: () => go('hub'), extras: [rankChip()] }),
      el('div.screen', {},
        needTeam ? el('div.panel', { style: { margin: '1rem 1.3rem', padding: '1rem' } },
          el('b', {}, `Your battle team has ${team.length}/6 Pokémon. `),
          el('span.dim', {}, 'A registered team of 6 is required to queue.'),
          el('button.btn.small.primary', { style: { marginLeft: '0.8rem' }, onclick: () => go('box') }, 'Fix team'),
        ) : null,
        el('div.mode-cards', {}, ...modes.map(m =>
          el('div.mode-card.panel' + (needTeam && m.id !== 'tutorial' ? '.off' : ''), {
            onclick: () => {
              if (needTeam && m.id !== 'tutorial') return;
              sfx.confirm();
              matchmake(root, m.id === 'ranked' && placement ? 'placement' : m.id);
            },
          },
            el('div.ic', {}, m.ic),
            el('h2', { style: { margin: '0.4rem 0' } }, m.t),
            el('p.dim', { style: { fontSize: '0.82rem' } }, m.d),
          ),
        )),
      ),
    );
  },
  exit() {},
};

async function matchmake(root, mode) {
  const S = state();
  let opp;
  if (mode === 'tutorial') {
    return go('battle', { mode: 'tutorial' });
  } else if (mode === 'placement') {
    await playDialogue(DIALOGUE.preEmma, NPCS);
    opp = { trainer: { name: 'Emma', title: 'Placement Rival' }, team: scriptedTeam(EMMA_TEAM.concat([
      { species: 'Azumarill' }, { species: 'Houndoom' }, { species: 'Snorlax' },
    ])), aiLevel: 1, hasOmniRing: false };
  } else {
    opp = generateOpponent({ tierIdx: S.rank.tier, mode });
  }

  clear(root).append(el('div.vs-screen', {},
    el('div.vs-trainer', {},
      el('div.face', {}, '🧑‍💼'),
      el('h2', {}, S.trainer.name),
      el('small.dim', {}, 'Gym Manager'),
    ),
    el('div.vs', {}, 'VS'),
    el('div.vs-trainer', {},
      el('div.face', {}, mode === 'placement' ? NPCS.emma.glyph : '🥊'),
      el('h2', {}, opp.trainer.name),
      el('small.dim', {}, opp.trainer.title),
      S.streak > 1 && mode === 'ranked' ? el('div.chip', { style: { marginTop: '0.4rem' } }, `🔥 ${S.streak} win streak`) : null,
    ),
  ));
  sfx.mega();
  await sleep(1600);
  go('battle-select', { phase: 'preview', mode, opp });
}

function preview(root, { mode, opp }) {
  const S = state();
  const mine = teamMons();
  const picked = [];

  const myCol = el('div.preview-team.panel');
  const foeCol = el('div.preview-team.panel');
  const startBtn = el('button.btn.primary.big', {
    disabled: true,
    onclick: () => {
      sfx.confirm();
      go('battle', { mode, opp, picks: picked.map(uid => mine.find(m => m.uid === uid)) });
    },
  }, `Battle! (pick ${CONFIG.SINGLES_PICK})`);

  root.append(
    topbar('Team Preview — pick 3 & lead order', {
      onBack: () => go('battle-select'),
      extras: [el('span.chip', {}, mode === 'casual' ? 'Casual' : mode === 'placement' ? 'Placement' : 'Ranked'), rankChip()],
    }),
    el('div.screen', {},
      el('div.preview-cols', { style: { padding: '1rem 1.3rem' } },
        el('div', {}, el('h3', { style: { marginBottom: '0.4rem' } }, `Your team — choose ${CONFIG.SINGLES_PICK}`), myCol),
        el('div', {}, el('h3', { style: { marginBottom: '0.4rem' } }, `${opp.trainer.name}'s team`), foeCol),
      ),
      el('div.row', { style: { justifyContent: 'center', padding: '0 0 1rem' } }, startBtn),
    ),
  );

  render();

  function render() {
    clear(myCol).append(...mine.map(m => {
      const idx = picked.indexOf(m.uid);
      return el('div.preview-mon.pickable' + (idx >= 0 ? '.picked' : ''), {
        onclick: () => {
          const i = picked.indexOf(m.uid);
          if (i >= 0) picked.splice(i, 1);
          else if (picked.length < CONFIG.SINGLES_PICK) picked.push(m.uid);
          sfx.click();
          startBtn.disabled = picked.length !== CONFIG.SINGLES_PICK;
          render();
        },
      },
        idx >= 0 ? el('span.ord', {}, String(idx + 1)) : el('span', { style: { width: '1.5rem' } }),
        monToken(m.species, { size: '2.9rem' }),
        el('div.grow', {},
          el('b', {}, m.species),
          el('div.row', {}, ...SPECIES[m.species].types.map(typeBadge)),
        ),
        el('span.itm', {}, m.item ? `🎒 ${m.item}` : ''),
      );
    }));
    clear(foeCol).append(...opp.team.map(m => el('div.preview-mon', {},
      el('span', { style: { width: '1.5rem' } }),
      monToken(m.species, { size: '2.9rem' }),
      el('div.grow', {},
        el('b', {}, m.species),
        el('div.row', {}, ...SPECIES[m.species].types.map(typeBadge)),
      ),
      el('span.itm', {}, m.item ? `🎒 ${m.item}` : ''),
    )));
  }
}
