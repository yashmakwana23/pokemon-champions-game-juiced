// FTUE: trainer name → starter bundle (1 of 3, grants a team of 6) → intro
// dialogue → Cordy's Battle Tutorial (scripted 3v3).
import { el, clear } from '../engine/dom.js';
import { go } from '../engine/scenes.js';
import { state, save, newInstance, addToBox } from '../state/store.js';
import { STARTER_BUNDLES, NPCS, DIALOGUE } from '../data/trainers.js';
import { monToken, playDialogue, toast } from '../ui/widgets.js';
import { sfx } from '../engine/audio.js';

export const ftueScene = {
  async enter(root) {
    const S = state();
    if (S.flags.ftue) return go('hub'); // guard: setup already done
    step1(root, S);
  },
  exit() {},
};

function step1(root, S) {
  const input = el('input', { type: 'text', maxLength: 12, placeholder: 'Your trainer name', value: S.trainer.name === 'Champion' ? '' : S.trainer.name });
  const goBtn = el('button.btn.primary.big', {
    onclick: () => {
      const name = input.value.trim().slice(0, 12) || 'Champion';
      S.trainer.name = name;
      save();
      sfx.confirm();
      step2(root, S);
    },
  }, 'Register');
  input.addEventListener('keydown', e => { if (e.key === 'Enter') goBtn.click(); });

  clear(root).append(el('div.ftue', {},
    el('h1', {}, 'Gym Manager Registration'),
    el('p.dim', {}, 'Frontier City needs your name for the ranked ledger.'),
    input, goBtn,
  ));
  setTimeout(() => input.focus(), 300);
}

function step2(root, S) {
  let selected = null;
  const cards = STARTER_BUNDLES.map(b => {
    const card = el('div.bundle.panel', {
      onclick: () => {
        selected = b;
        cards.forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        confirmBtn.disabled = false;
        sfx.click();
      },
    },
      el('h3', {}, b.name),
      el('div.lead-token', {}, monToken(b.lead, { size: '7rem', animated: true })),
      el('b', {}, b.lead),
      el('p.dim', { style: { fontSize: '0.78rem', marginTop: '0.4rem' } }, b.blurb),
      el('div.members', {}, ...b.team.slice(1).map(m => monToken(m, { size: '3.2rem', animated: true }))),
    );
    return card;
  });

  const confirmBtn = el('button.btn.primary.big', {
    disabled: true,
    onclick: async () => {
      sfx.confirm();
      for (const sp of selected.team) addToBox(newInstance(sp));
      S.team = S.box.slice(0, 6).map(m => m.uid);
      S.flags.ftue = true; // resume to hub on future loads
      save();
      toast(`${selected.name} joined your gym!`);
      await playDialogue(DIALOGUE.intro, NPCS);
      await playDialogue(DIALOGUE.preTutorial, NPCS);
      go('battle', { mode: 'tutorial' });
    },
  }, 'Found my gym with this pack');

  clear(root).append(el('div.ftue', {},
    el('h1', {}, `Welcome, ${S.trainer.name}!`),
    el('p.dim', {}, 'Choose a starter pack — its six Pokémon arrive at Lv 50, tournament-ready.'),
    el('div.bundles', {}, ...cards),
    confirmBtn,
  ));
}
