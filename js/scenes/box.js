// Box & Team Builder — 30-slot base box (grows with rank-ups), 6-mon battle
// team, held-item assignment from inventory, release.
import { el, clear, fmt } from '../engine/dom.js';
import { go } from '../engine/scenes.js';
import { SPECIES } from '../data/species.js';
import { ITEMS } from '../data/items.js';
import { MEGAS } from '../data/megas.js';
import { state, save, boxCapacity, isTrial, getMon } from '../state/store.js';
import { monToken, toast, topbar, modal } from '../ui/widgets.js';
import { inspectorPanel } from '../ui/pokecard.js';
import { sfx } from '../engine/audio.js';

export const boxScene = {
  async enter(root) {
    const S = state();
    let selected = S.box[0]?.uid ?? null;

    const body = el('div.screen-body');
    root.append(topbar('Box & Battle Team', { onBack: () => go('hub') }), el('div.screen', {}, body));
    render();

    function render() {
      const sel = getMon(selected);
      const reserves = S.box.filter(m => !S.team.includes(m.uid));
      clear(body).append(
        el('div', { style: { flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, gap: '0.7rem' } },
          el('div.panel', { style: { padding: '0.7rem 1rem' } },
            el('div.row', { style: { justifyContent: 'space-between' } },
              el('h3', {}, `Battle team — ${S.team.length}/6 ${S.team.length < 6 ? '(need 6 to queue)' : '✔'}`),
              el('small.dim', {}, `Box ${S.box.length}/${boxCapacity()}`),
            ),
            el('div.row', { style: { marginTop: '0.5rem', flexWrap: 'wrap' } },
              ...S.team.map(uid => {
                const m = getMon(uid);
                if (!m) return null;
                return el('button', { onclick: () => { selected = uid; render(); }, title: m.species, style: { position: 'relative' } },
                  monToken(m.species, { size: '5rem', animated: true }));
              }),
              ...Array.from({ length: Math.max(0, 6 - S.team.length) }, () =>
                el('div.slot-empty', { style: { width: '5rem', height: '5rem' } }, '+')),
            ),
          ),
          el('div.box-grid.panel', { style: { padding: '0.6rem' } },
            el('h3', { style: { gridColumn: '1 / -1', margin: '0 0 0.15rem' } },
              `Reserves — ${reserves.length} (not on team · tap to inspect or add)`),
            ...reserves.map(m => {
              return el('div.box-mon' + (m.uid === selected ? '.selected' : ''), {
                onclick: () => { selected = m.uid; sfx.click(); render(); },
              },
                isTrial(m) ? el('span.trial-tag', {}, 'T') : null,
                m.item ? el('span.item-dot', { title: m.item }, '🎒') : null,
                monToken(m.species, { size: '6.5rem', animated: true }),
                el('span.nm', {}, m.species),
              );
            }),
            reserves.length === 0
              ? el('p.dim', { style: { gridColumn: '1 / -1', padding: '0.6rem' } }, 'No reserves — all your Pokémon are on the team. Recruit more at the Roster Ranch.')
              : null,
          ),
        ),
        sel ? el('div', { style: { display: 'flex', flexDirection: 'column', gap: '0.6rem', minHeight: 0 } },
          inspectorPanel(sel),
          el('div.row', { style: { flexWrap: 'wrap' } },
            S.team.includes(sel.uid)
              ? el('button.btn.small', { onclick: () => { S.team = S.team.filter(u => u !== sel.uid); save(); render(); } }, '− Remove from team')
              : el('button.btn.small.primary', {
                  disabled: S.team.length >= 6,
                  onclick: () => { S.team.push(sel.uid); save(); sfx.confirm(); render(); },
                }, '+ Add to team'),
            el('button.btn.small', { onclick: () => itemPicker(sel) }, sel.item ? `Item: ${sel.item}` : 'Give held item'),
            el('button.btn.small.danger', {
              disabled: S.team.includes(sel.uid),
              onclick: () => {
                if (!confirm(`Release ${sel.species} back to the Ranch?`)) return;
                S.box = S.box.filter(m => m.uid !== sel.uid);
                selected = S.box[0]?.uid ?? null;
                save(); toast('Returned to the Roster Ranch.'); render();
              },
            }, 'Release'),
          ),
        ) : el('div.panel', { style: { padding: '2rem' } }, el('p.dim', {}, 'Box is empty — visit the Roster Ranch!')),
      );
    }

    function itemPicker(mon) {
      const S = state();
      const stones = Object.keys(S.megaStones).filter(st => (SPECIES[mon.species].mega ?? []).some(mg => MEGAS[mg].stone === st));
      const held = Object.entries(S.inventory).filter(([, n]) => n > 0);
      const content = el('div', {},
        el('h2', {}, `Held item for ${mon.species}`),
        el('p.dim', { style: { margin: '0.4rem 0 0.8rem' } }, 'One item per Pokémon. Mega Stones enable Mega Evolution (needs the Omni Ring).'),
        mon.item ? el('button.party-row', {
          onclick: () => { returnItem(mon); m.close(); render(); },
        }, `Remove ${mon.item}`) : null,
        ...stones.map(st => el('button.party-row', {
          onclick: () => { returnItem(mon); mon.item = st; delete S.megaStones[st]; save(); sfx.confirm(); m.close(); render(); },
        }, el('b', {}, `💠 ${st}`), el('small.dim', {}, 'Mega Stone'))),
        ...held.map(([name, n]) => el('button.party-row', {
          onclick: () => {
            returnItem(mon);
            mon.item = name;
            S.inventory[name]--;
            save(); sfx.confirm(); m.close(); render();
          },
        }, el('b', {}, name), el('small.dim.grow', {}, ITEMS[name]?.desc ?? ''), el('small', {}, `×${n}`))),
        held.length === 0 && stones.length === 0 && !mon.item
          ? el('p.dim', {}, 'No items in your bag — buy some at the Frontier Shop.') : null,
      );
      const m = modal(content);
    }

    function returnItem(mon) {
      if (!mon.item) return;
      if (ITEMS[mon.item]) state().inventory[mon.item] = (state().inventory[mon.item] ?? 0) + 1;
      else state().megaStones[mon.item] = true; // stones go back to the stone pouch
      mon.item = null;
      save();
    }
  },
  exit() {},
};
