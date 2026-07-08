// Title screen — GDD: logo + key art, "Welcome home, Champions", PLAY NOW.
import { el } from '../engine/dom.js';
import { go } from '../engine/scenes.js';
import { state, newGame, wipeSave, save } from '../state/store.js';
import { sfx } from '../engine/audio.js';
import { monToken } from '../ui/widgets.js';
import { showdownBg } from '../data/sprites.js';
import { pickN } from '../engine/rng.js';
import { SPECIES } from '../data/species.js';

export const titleScene = {
  async enter(root) {
    const hasSave = !!state()?.flags;
    const cast = pickN(Object.keys(SPECIES), 5);

    root.append(el('div.title-scene', { style: { '--bg': `url("${showdownBg('city')}")` } },
      el('div.title-cast', {},
        ...cast.map((s, i) => monToken(s, { size: `${6 + (i === 2 ? 3 : 0)}rem`, animated: true })),
      ),
      el('div.title-logo', {},
        el('div.poke', {}, 'POKÉMON'),
        el('div.champ', {}, 'CHAMPIONS'),
        el('div.tag', {}, 'Welcome home, Champions', el('span.blink', {}, ' ▌')),
      ),
      el('div.title-buttons', {},
        hasSave
          ? el('button.btn.primary.big', { onclick: () => { sfx.confirm(); go(state().flags.ftue ? 'hub' : 'ftue'); } }, '▶ PLAY NOW')
          : el('button.btn.primary.big', { onclick: () => { sfx.confirm(); newGame(); save(); go('ftue'); } }, '▶ PLAY NOW'),
        hasSave ? el('button.btn.small.ghost', {
          onclick: () => {
            if (confirm('Delete your save and start over?')) {
              wipeSave(); newGame(); save(); sfx.confirm(); go('ftue');
            }
          },
        }, 'New game (wipe save)') : null,
      ),
      el('div.credit', {}, 'Fan-made browser recreation for study — reconstructed from a community field guide. Not affiliated with Nintendo / Game Freak / TPC.'),
    ));
  },
  exit() {},
};
