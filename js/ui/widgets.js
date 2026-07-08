// Reusable UI pieces: type badges, mon tokens (placeholder holo-orb art),
// stat bars, toasts, dialogue sequences, modals, topbar.
import { el, $ } from '../engine/dom.js';
import { TYPE_COLORS } from '../data/types.js';
import { SPECIES } from '../data/species.js';
import { spriteUrl, animatedUrl, showdownUrl } from '../data/sprites.js';
import { MOVES } from '../data/moves.js';
import { STAT_KEYS, STAT_LABELS } from '../systems/stats.js';
import { state } from '../state/store.js';
import { rankInfo } from '../state/progression.js';
import { fmt } from '../engine/dom.js';
import { sfx } from '../engine/audio.js';

export function typeBadge(type) {
  return el('span.type-badge', { style: { background: TYPE_COLORS[type] ?? '#666' } }, type);
}

// Mon token: type-gradient holo orb with real artwork. In battle we prefer the
// Gen-5 ANIMATED sprite (opt-in via `animated`, `back` for the player's mon),
// and walk a source chain animated → static → glyph so anything missing (Megas,
// Gen 6+, offline) degrades gracefully instead of showing a broken image.
export function monToken(speciesName, { size = '4rem', mega = false, types = null, glyph = null, form = null, animated = false, back = false } = {}) {
  const sp = SPECIES[speciesName];
  const t = types ?? sp?.types ?? ['Normal'];
  const c1 = TYPE_COLORS[t[0]] ?? '#666';
  const c2 = TYPE_COLORS[t[1] ?? t[0]] ?? c1;
  const glyphSpan = el('span.glyph', {}, glyph ?? sp?.glyph ?? '❓');
  const node = el('div.token' + (mega ? '.mega' : ''), {
    style: {
      width: size, height: size, fontSize: `calc(${size} * 0.52)`,
      '--tk-c1': c1, '--tk-c2': c2,
    },
    title: speciesName,
  }, glyphSpan);

  // Ordered source candidates; first that loads wins, rest are skipped.
  // Prefer the Showdown CDN (proper CDN, no GitHub-raw rate limits) for BASE
  // forms everywhere — this keeps every screen's sprites reliable instead of
  // falling back to the emoji glyph. Mega/regional forms have no clean Showdown
  // id, so they use PokeAPI's dedicated form artwork. Order:
  //   Showdown animated (back→front→xyani) → PokeAPI animated → static → glyph
  const sources = [];
  if (!form) {
    if (animated && back) sources.push(showdownUrl(speciesName, { back: true, style: 'ani' }));
    sources.push(showdownUrl(speciesName, { style: 'ani' }));
    sources.push(showdownUrl(speciesName, { style: 'xyani' }));
  }
  if (animated) {
    if (back) sources.push(animatedUrl(speciesName, { form, back: true }));
    sources.push(animatedUrl(speciesName, { form }));
  }
  sources.push(spriteUrl(speciesName, { form }));
  const chain = sources.filter(Boolean);

  if (chain.length) {
    const img = el('img.art' + (animated ? '.anim' : ''), {
      alt: speciesName, draggable: 'false',
      onload: () => { glyphSpan.style.display = 'none'; },
    });
    let i = 0;
    const next = () => { if (i < chain.length) img.src = chain[i++]; else img.remove(); };
    img.addEventListener('error', next);
    node.append(img);
    next();
  }
  return node;
}

export function statBars(stats, statPoints = null) {
  const wrap = el('div.statbars');
  for (const k of STAT_KEYS) {
    const v = stats[k];
    const pct = Math.min(100, (v / 220) * 100);
    wrap.append(el('div.statbar', {},
      el('span.dim', {}, STAT_LABELS[k]),
      el('b', {}, String(v)),
      el('div.bar', {}, el('i', { style: { width: pct + '%' } })),
      statPoints?.[k] ? el('span.sp-tag', {}, `+${statPoints[k]}`) : null,
    ));
  }
  return wrap;
}

export function moveRow(name) {
  const mv = MOVES[name];
  if (!mv) return el('div.move-row', {}, name);
  return el('div.move-row', { title: mv.desc ?? '' },
    typeBadge(mv.type),
    el('b.grow', {}, name),
    el('small.dim', {}, mv.cat === 'status' ? 'Status' : `${mv.power} pow`),
    el('small.dim', {}, `${mv.pp} PP`),
  );
}

export function toast(text) {
  const t = el('div.toast', {}, text);
  $('#toasts').append(t);
  setTimeout(() => t.remove(), 3100);
}

// Standard screen topbar with back button + VP chip.
export function topbar(title, { onBack = null, extras = [] } = {}) {
  const S = state();
  return el('div.topbar', {},
    onBack ? el('button.btn.small.backbtn', { onclick: () => { sfx.cancel(); onBack(); } }, '‹ Back') : null,
    el('h2', {}, title),
    el('div.spacer'),
    ...extras,
    el('span.chip.vp', {}, '◆ ', el('b', {}, fmt(S.vp)), ' VP'),
  );
}

export function rankChip() {
  const r = rankInfo();
  return el('span.chip', {}, '🏆 ', r.label);
}

// Sequential NPC dialogue overlay. Resolves when all lines are clicked through.
export function playDialogue(lines, npcs) {
  return new Promise(resolve => {
    let i = 0;
    const box = el('div.dialogue.panel', { onclick: advance });
    const who = el('div.who');
    const txt = el('div.txt');
    box.append(who, txt, el('span.cue', {}, '▼'));
    document.querySelector('#app').append(box);
    const onKey = (e) => { if (e.key === 'Enter' || e.key === ' ') advance(); };
    window.addEventListener('keydown', onKey);
    show();
    function show() {
      const line = lines[i];
      const npc = npcs[line.who];
      who.textContent = `${npc?.glyph ?? ''} ${npc?.name ?? line.who} — ${npc?.role ?? ''}`;
      txt.textContent = line.text;
      sfx.click();
    }
    function advance() {
      i++;
      if (i >= lines.length) {
        window.removeEventListener('keydown', onKey);
        box.remove();
        resolve();
      } else show();
    }
  });
}

// Modal helper — returns {close}. content is a node.
export function modal(content, { onClose = null } = {}) {
  const back = el('div.modal-back', {
    onclick: (e) => { if (e.target === back) close(); },
  }, el('div.modal.panel', {}, content));
  document.querySelector('#app').append(back);
  function close() { back.remove(); onClose?.(); }
  return { close, node: back };
}
