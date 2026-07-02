// Training Room — the GDD's defining system: buy your competitive build.
// Stat Points (66 pool, 32/stat, 5 VP/pt), Nature (500 VP), Ability (500 VP),
// Moves (250 VP/swap). Stat reset is free. Trials cannot be trained.
// One confirm charges the whole session (or 1 Training Ticket).
import { el, clear, fmt } from '../engine/dom.js';
import { go } from '../engine/scenes.js';
import { CONFIG } from '../data/config.js';
import { SPECIES } from '../data/species.js';
import { MOVES } from '../data/moves.js';
import { NATURES, NATURE_NAMES } from '../data/natures.js';
import { ABILITIES } from '../data/abilities.js';
import { state, save, isTrial, spendVP } from '../state/store.js';
import { computeStats, STAT_KEYS, STAT_LABELS, totalStatPoints } from '../systems/stats.js';
import { missionEvent, markStarterDone } from '../state/progression.js';
import { monToken, typeBadge, toast, topbar, statBars } from '../ui/widgets.js';
import { sfx } from '../engine/audio.js';

export const trainingScene = {
  async enter(root) {
    const S = state();
    const trainable = S.box.filter(m => !isTrial(m));
    let mon = trainable[0] ?? null;
    let draft = null;

    const body = el('div.screen-body', { style: { flexDirection: 'column' } });
    root.append(topbar('Training Room', { onBack: () => go('hub') }), el('div.screen', {}, body));

    const mkDraft = () => ({
      statPoints: { ...mon.statPoints },
      nature: mon.nature,
      ability: mon.ability,
      moves: mon.moves.slice(),
    });

    const costOf = () => {
      let c = 0;
      for (const k of STAT_KEYS) {
        const diff = (draft.statPoints[k] ?? 0) - (mon.statPoints[k] ?? 0);
        if (diff > 0) c += diff * CONFIG.COST_STAT_POINT; // added points cost; removing is free
      }
      if (draft.nature !== mon.nature) c += CONFIG.COST_NATURE;
      if (draft.ability !== mon.ability) c += CONFIG.COST_ABILITY;
      c += draft.moves.filter((m, i) => m !== mon.moves[i]).length * CONFIG.COST_MOVE;
      return c;
    };

    render();

    function render() {
      if (!mon) {
        clear(body).append(el('div.panel', { style: { padding: '2rem', textAlign: 'center' } },
          el('h2', {}, 'No trainable Pokémon'),
          el('p.dim', { style: { margin: '0.6rem 0' } }, 'Trial rentals can’t be trained — recruit permanently at the Roster Ranch first.'),
          el('button.btn.primary', { onclick: () => go('ranch') }, 'To the Ranch'),
        ));
        return;
      }
      draft ??= mkDraft();
      const sp = SPECIES[mon.species];
      const stats = computeStats(sp.stats, draft.statPoints, draft.nature);
      const used = totalStatPoints(draft.statPoints);
      const bill = costOf();

      clear(body).append(
        el('div.row.scroll', { style: { gap: '0.5rem', flexWrap: 'wrap', flex: '0 0 auto' } },
          ...trainable.map(m2 => {
            const b = el('button.btn.small' + (m2.uid === mon.uid ? '.primary' : ''), {
              onclick: () => { mon = m2; draft = null; sfx.click(); render(); },
            }, `${SPECIES[m2.species].glyph} ${m2.species}`);
            return b;
          }),
        ),
        el('div.training-grid', {},
          // left: preview
          el('div.train-col.panel', {},
            el('div.row', {},
              monToken(mon.species, { size: '4.4rem' }),
              el('div', {},
                el('b', {}, mon.species),
                el('div.row', { style: { marginTop: '0.2rem' } }, ...sp.types.map(typeBadge)),
                el('small.dim', {}, `Lv 50 · ${draft.nature}`),
              ),
            ),
            statBars(stats, draft.statPoints),
            el('h3', {}, `Stat points — ${used}/${CONFIG.STAT_POINTS_TOTAL}`),
            el('div.sp-editor', {}, ...STAT_KEYS.map(k => {
              const v = draft.statPoints[k] ?? 0;
              return el('div.sp-row', {},
                el('span.dim', {}, STAT_LABELS[k]),
                el('div.bar', { style: { height: '0.5rem', background: 'var(--bg0)', borderRadius: '99px', overflow: 'hidden' } },
                  el('i', { style: { display: 'block', height: '100%', width: `${(v / CONFIG.STAT_POINTS_MAX) * 100}%`, background: 'var(--gold)' } })),
                el('div.ctrl', {},
                  el('button', { onclick: () => { draft.statPoints[k] = Math.max(0, v - 8); render(); } }, '−'),
                  el('span.val', {}, String(v)),
                  el('button', {
                    onclick: () => {
                      const room = Math.min(CONFIG.STAT_POINTS_MAX - v, CONFIG.STAT_POINTS_TOTAL - used);
                      draft.statPoints[k] = v + Math.min(8, room);
                      render();
                    },
                  }, '+'),
                ),
              );
            })),
            el('button.btn.small.ghost', {
              onclick: () => { STAT_KEYS.forEach(k => draft.statPoints[k] = 0); sfx.click(); render(); },
            }, 'Reset stat points (free)'),
          ),
          // right: nature / ability / moves + bill
          el('div.train-col.panel', {},
            el('h3', {}, `Nature — ${CONFIG.COST_NATURE} VP to change`),
            el('div.nature-grid', {}, ...NATURE_NAMES.map(n => {
              const nat = NATURES[n];
              return el('button.nature-cell' + (draft.nature === n ? '.sel' : ''), {
                title: nat.up ? `+${STAT_LABELS[nat.up]} / −${STAT_LABELS[nat.down]}` : 'Neutral',
                onclick: () => { draft.nature = n; sfx.click(); render(); },
              }, n);
            })),
            el('h3', {}, `Ability — ${CONFIG.COST_ABILITY} VP to change`),
            el('div.row', { style: { flexWrap: 'wrap' } }, ...sp.abilities.map(a =>
              el('button.btn.small' + (draft.ability === a ? '.primary' : ''), {
                title: ABILITIES[a] ?? '',
                onclick: () => { draft.ability = a; sfx.click(); render(); },
              }, a),
            )),
            el('h3', {}, `Moves — ${CONFIG.COST_MOVE} VP per swap`),
            el('div.movepool', {}, ...draft.moves.map((mvName, slotIdx) => {
              const pool = [...new Set([...sp.moves, ...sp.alts])].filter(p => !draft.moves.includes(p) || p === mvName);
              const sel = el('select', {
                style: { flex: 1, font: 'inherit', background: 'var(--panel3)', color: 'var(--ink)', border: '1px solid var(--line)', borderRadius: '7px', padding: '0.25em' },
                onchange: (e) => { draft.moves[slotIdx] = e.target.value; render(); },
              }, ...pool.map(p => el('option', { value: p, selected: p === mvName ? 'selected' : null }, p)));
              const mv = MOVES[mvName];
              return el('div.pool-row' + (mvName !== mon.moves[slotIdx] ? '.sel' : ''), {},
                typeBadge(mv?.type ?? 'Normal'), sel,
                el('small.dim', { title: mv?.desc ?? '' }, mv?.cat === 'status' ? 'Status' : `${mv?.power} pow`),
              );
            })),
            el('div.train-bill', {},
              el('b.grow', {}, 'Session total: ', el('span.gold', {}, `${fmt(bill)} VP`)),
              S.tickets.training > 0 && bill > 0 ? el('button.btn.small', {
                onclick: () => commit(true),
              }, `Use Training Ticket (${S.tickets.training})`) : null,
              el('button.btn.primary', {
                disabled: bill === 0 && used === totalStatPoints(mon.statPoints),
                onclick: () => commit(false),
              }, 'Commence Training'),
            ),
          ),
        ),
      );
    }

    function commit(useTicket) {
      const bill = costOf();
      if (useTicket) {
        if (state().tickets.training < 1) return;
        state().tickets.training--;
      } else if (bill > 0 && !spendVP(bill)) {
        return toast('Not enough VP — win battles to earn more!');
      }
      Object.assign(mon, { statPoints: { ...draft.statPoints }, nature: draft.nature, ability: draft.ability, moves: draft.moves.slice() });
      draft = null;
      if (bill > 0 || useTicket) { markStarterDone('train'); missionEvent('train'); }
      save(); sfx.buy();
      toast('Training complete!');
      render();
    }
  },
  exit() {},
};
