// Full Pokémon inspector panel — used by Box, Ranch and Training screens.
import { el } from '../engine/dom.js';
import { SPECIES } from '../data/species.js';
import { MEGAS } from '../data/megas.js';
import { ABILITIES } from '../data/abilities.js';
import { computeStats } from '../systems/stats.js';
import { monToken, typeBadge, statBars, moveRow } from './widgets.js';
import { isTrial } from '../state/store.js';

export function inspectorPanel(inst, { title = null } = {}) {
  const sp = SPECIES[inst.species];
  const stats = computeStats(sp.stats, inst.statPoints, inst.nature);
  const trial = isTrial(inst);
  const megaNames = sp.mega ?? [];

  return el('div.inspector.panel', {},
    title ? el('h3', {}, title) : null,
    el('div.head', {},
      monToken(inst.species, { size: '6.5rem', animated: true }),
      el('div', {},
        el('div.row', {}, el('b', {}, inst.species), trial ? el('span.type-badge', { style: { background: 'var(--magenta)' } }, 'Trial') : null),
        el('div.row', { style: { marginTop: '0.25rem' } }, ...sp.types.map(typeBadge)),
        el('small.dim', {}, `Lv 50 · ${inst.nature} nature`),
      ),
    ),
    el('div', {},
      el('small.dim', {}, 'Ability'),
      el('div', { title: ABILITIES[inst.ability] ?? '' }, el('b', {}, inst.ability),
        el('small.dim', {}, '  ' + (ABILITIES[inst.ability] ?? ''))),
    ),
    el('div', {},
      el('small.dim', {}, 'Held item'),
      el('div', {}, inst.item ? el('b', {}, inst.item) : el('span.dim', {}, '— none —')),
    ),
    statBars(stats, inst.statPoints),
    el('div', {},
      el('small.dim', {}, 'Moves'),
      el('div.moves-list', {}, ...inst.moves.map(moveRow)),
    ),
    megaNames.length ? el('small.dim', {}, `Mega Evolution: hold ${megaNames.map(m => MEGAS[m].stone).join(' or ')}`) : null,
  );
}
