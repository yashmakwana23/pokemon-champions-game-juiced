// Roster Ranch — rotating recruit lineup. Trial Scout (free daily 7-day
// rental, untrainable) vs Permanent Recruit (VP by rarity, or 1 Teammate
// Ticket). Lineup refreshes on a 22h cooldown, skippable at 100 VP/hour.
import { el, clear, fmt } from '../engine/dom.js';
import { go } from '../engine/scenes.js';
import { CONFIG } from '../data/config.js';
import { SPECIES } from '../data/species.js';
import { state, save, newInstance, addToBox, boxCapacity, spendVP } from '../state/store.js';
import { rollLineup, recruitPrice } from '../systems/teamgen.js';
import { missionEvent, markStarterDone, todayKey } from '../state/progression.js';
import { monToken, typeBadge, toast, topbar, modal } from '../ui/widgets.js';
import { inspectorPanel } from '../ui/pokecard.js';
import { sfx } from '../engine/audio.js';

const H = 3600_000;

export const ranchScene = {
  timer: null,
  async enter(root) {
    const S = state();
    if (!S.ranch.lineup.length || !S.ranch.refreshedAt) refresh(true);
    missionEvent('scout');

    const body = el('div.screen-body');
    root.append(
      topbar('Roster Ranch', { onBack: () => go('hub') }),
      el('div.screen', {}, body),
    );
    render(body);
    this.timer = setInterval(() => render(body), 30_000);

    function refresh(free = false) {
      S.ranch.lineup = rollLineup();
      if (free) S.ranch.refreshedAt = Date.now();
      save();
    }

    function cooldownLeft() {
      return Math.max(0, S.ranch.refreshedAt + CONFIG.LINEUP_COOLDOWN_H * H - Date.now());
    }

    function render(body) {
      const left = cooldownLeft();
      const hoursLeft = Math.ceil(left / H);
      const skipCost = hoursLeft * CONFIG.LINEUP_SKIP_VP_PER_H;
      const trialUsed = S.ranch.trialDate === todayKey();

      clear(body).append(
        el('div.lineup', {}, ...S.ranch.lineup.map(spName => {
          const sp = SPECIES[spName];
          const price = recruitPrice(spName);
          const full = S.box.length >= boxCapacity();
          return el('div.recruit-card.panel', {},
            monToken(spName, { size: '8rem', animated: true }),
            el('div.nm', {}, spName),
            el('div.row', {}, ...sp.types.map(typeBadge)),
            el('small.dim', {}, `${sp.tier} · BST ${Object.values(sp.stats).reduce((a, b) => a + b, 0)}`),
            el('div.price', {}, `${fmt(price)} VP`),
            el('div.row', {},
              el('button.btn.small', {
                title: 'Free 7-day rental — cannot be trained. Once per day.',
                disabled: trialUsed || full,
                onclick: () => {
                  const inst = newInstance(spName, { trialUntil: Date.now() + CONFIG.TRIAL_DAYS * 24 * H });
                  if (!addToBox(inst)) return toast('Box is full!');
                  S.ranch.trialDate = todayKey();
                  save(); sfx.confirm();
                  toast(`${spName} joined on a 7-day trial!`);
                  render(body);
                },
              }, trialUsed ? 'Trial used' : 'Trial · Free'),
              el('button.btn.small.gold', {
                disabled: full || (S.vp < price && S.tickets.teammate < 1),
                onclick: () => confirmRecruit(spName, price),
              }, full ? 'Box full' : 'Recruit'),
              el('button.btn.small.ghost', { onclick: () => modal(inspectorPanel(newInstance(spName), { title: 'Scouting report' })) }, '🔍'),
            ),
          );
        })),
        el('div.ranch-side', {},
          el('div.panel', { style: { padding: '1rem' } },
            el('h3', {}, '🤠 Kitt'),
            el('p.dim', { style: { fontSize: '0.85rem', margin: '0.4rem 0' } },
              'Every recruit arrives at Lv 50 with perfect hidden stats. Trials are free samples — but only permanent teammates can be trained.'),
          ),
          el('div.panel', { style: { padding: '1rem' } },
            el('h3', {}, 'New lineup'),
            left <= 0
              ? el('button.btn.primary', { style: { marginTop: '0.5rem' }, onclick: () => { refresh(true); sfx.confirm(); toast('Meet a new lineup of Pokémon!'); render(body); } }, 'Meet a New Lineup!')
              : el('div', {},
                  el('p.dim', { style: { fontSize: '0.85rem', margin: '0.4rem 0' } }, `Next free lineup in ~${hoursLeft}h`),
                  el('button.btn.small.gold', {
                    disabled: S.vp < skipCost,
                    onclick: () => {
                      if (!spendVP(skipCost)) return;
                      refresh(true); sfx.buy(); toast('Lineup refreshed!'); render(body);
                    },
                  }, `Skip · ${fmt(skipCost)} VP`),
                ),
          ),
          el('div.panel', { style: { padding: '1rem' } },
            el('h3', {}, 'Tickets'),
            el('p.dim', { style: { fontSize: '0.85rem', marginTop: '0.4rem' } },
              `🎟 Teammate Tickets: ${S.tickets.teammate} — a ticket covers one permanent recruit of any price.`),
          ),
        ),
      );
    }

    function confirmRecruit(spName, price) {
      const S = state();
      const useTicket = S.tickets.teammate > 0 && S.vp < price;
      const content = el('div', {},
        el('h2', {}, `Recruit ${spName}?`),
        el('p.dim', { style: { margin: '0.6rem 0' } },
          useTicket ? 'Pay with 1 Teammate Ticket 🎟' : `Pay ${fmt(price)} VP for permanent recruitment. Training unlocks immediately.`),
        el('div.row', {},
          el('button.btn.primary', {
            onclick: () => {
              if (useTicket) S.tickets.teammate--;
              else if (!spendVP(price)) return toast('Not enough VP!');
              const inst = newInstance(spName);
              if (!addToBox(inst)) return toast('Box is full!');
              S.ranch.lineup = S.ranch.lineup.filter(n => n !== spName);
              markStarterDone('recruit');
              save(); sfx.buy();
              toast(`${spName} recruited permanently!`);
              m.close(); render(body);
            },
          }, useTicket ? 'Use Teammate Ticket' : `Pay ${fmt(price)} VP`),
          S.tickets.teammate > 0 && S.vp >= price ? el('button.btn', {
            onclick: () => {
              S.tickets.teammate--;
              const inst = newInstance(spName);
              if (!addToBox(inst)) return toast('Box is full!');
              S.ranch.lineup = S.ranch.lineup.filter(n => n !== spName);
              markStarterDone('recruit');
              save(); sfx.buy();
              toast(`${spName} recruited with a ticket!`);
              m.close(); render(body);
            },
          }, 'Use Ticket instead') : null,
          el('button.btn.ghost', { onclick: () => m.close() }, 'Cancel'),
        ),
      );
      const m = modal(content);
    }
  },
  exit() { clearInterval(this.timer); this.timer = null; },
};
