// Frontier Shop — held items (700 VP), berries (400 VP), Mega Stones
// (2,000 VP each). Prices from the GDD dex where recorded.
import { el, clear, fmt } from '../engine/dom.js';
import { go } from '../engine/scenes.js';
import { CONFIG } from '../data/config.js';
import { ITEMS } from '../data/items.js';
import { MEGAS } from '../data/megas.js';
import { state, save, spendVP } from '../state/store.js';
import { toast, topbar } from '../ui/widgets.js';
import { markStarterDone } from '../state/progression.js';
import { sfx } from '../engine/audio.js';

const CATS = [
  { id: 'held', label: 'Held Items', filter: (n) => !/Berry$/.test(n) },
  { id: 'berries', label: 'Berries', filter: (n) => /Berry$/.test(n) },
  { id: 'stones', label: 'Mega Stones' },
];

export const shopScene = {
  async enter(root) {
    const S = state();
    let cat = 'held';

    const catsBar = el('div.shop-cats');
    const body = el('div.screen-body');
    root.append(topbar('Frontier Shop', { onBack: () => go('hub') }), el('div.screen', {}, catsBar, body));
    render();

    function buy(price, apply) {
      if (!spendVP(price)) return toast('Not enough VP — the ladder pays!');
      apply();
      markStarterDone('item');
      save(); sfx.buy();
      render();
    }

    function render() {
      clear(catsBar).append(...CATS.map(c =>
        el('button.btn.small' + (cat === c.id ? '.sel' : ''), { onclick: () => { cat = c.id; sfx.click(); render(); } }, c.label)));

      const grid = el('div.shop-grid');
      if (cat === 'stones') {
        const ownedStones = new Set([
          ...Object.keys(S.megaStones),
          ...S.box.map(m => m.item).filter(i => i && !ITEMS[i]),
        ]);
        for (const mega of Object.values(MEGAS)) {
          const owned = ownedStones.has(mega.stone);
          grid.append(el('div.shop-item.panel', {},
            el('div.nm', {}, `💠 ${mega.stone}`),
            el('div.desc', {}, `Lets ${mega.base} Mega Evolve into ${mega.name} (requires the Omni Ring). Held item.`),
            owned ? el('span.owned', {}, '✔ Owned') : el('button.btn.small.gold', {
              disabled: S.vp < CONFIG.COST_MEGA_STONE,
              onclick: () => buy(CONFIG.COST_MEGA_STONE, () => { S.megaStones[mega.stone] = true; toast(`${mega.stone} acquired!`); }),
            }, `${fmt(CONFIG.COST_MEGA_STONE)} VP`),
          ));
        }
      } else {
        const c = CATS.find(c => c.id === cat);
        for (const item of Object.values(ITEMS)) {
          if (!c.filter(item.name)) continue;
          const owned = S.inventory[item.name] ?? 0;
          grid.append(el('div.shop-item.panel', {},
            el('div.nm', {}, item.name),
            el('div.desc', {}, item.desc),
            el('div.row', { style: { justifyContent: 'space-between' } },
              owned ? el('span.owned', {}, `✔ ×${owned} in bag`) : el('span'),
              el('button.btn.small.gold', {
                disabled: S.vp < item.price,
                onclick: () => buy(item.price, () => { S.inventory[item.name] = (S.inventory[item.name] ?? 0) + 1; toast(`${item.name} added to bag!`); }),
              }, `${fmt(item.price)} VP`),
            ),
          ));
        }
      }
      clear(body).append(grid);
    }
  },
  exit() {},
};
