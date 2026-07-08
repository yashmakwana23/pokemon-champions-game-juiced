// FX Lab — a standalone playground for battle animations, decoupled from the
// battle flow. Pick an attacker/target, fire any move archetype or signature
// move in isolation, replay, and slow-mo. It reuses the SAME engine the battle
// uses (fx.js + anim.js + tween.js) plus the battle's own CSS, and replicates
// the battle's full "delivery + on-hit reaction" so what you see here is what
// you get in a real turn.
import { el, clear } from './engine/dom.js';
import { startLoop, hitStop, setTimeScale } from './engine/loop.js';
import { tween, Easing } from './engine/tween.js';
import { attachFx, burst, ring, screenShake, flashStage, weatherStart, weatherStop } from './engine/fx.js';
import { playMoveAnim, archetypeOf, tintOf, isMelee } from './data/anim.js';
import { showdownUrl, showdownBg, BATTLE_SCENES } from './data/sprites.js';
import { TYPE_COLORS } from './data/types.js';

// ---- demo roster (Showdown ids resolve automatically) ----------------------
const ROSTER = [
  'Charizard', 'Venusaur', 'Blastoise', 'Pikachu', 'Gengar',
  'Garchomp', 'Gyarados', 'Lucario', 'Tyranitar', 'Greninja', 'Dragonite', 'Alakazam',
];

// ---- move catalogue: archetypes + signature moves --------------------------
// Each entry becomes a synthetic move; anim.js derives the archetype from
// name/type/cat/target exactly as it does for real battle moves.
const mv = (name, type, cat, extra = {}) => ({ name, type, cat, target: 'foe', ...extra });
const ARCHETYPES = [
  mv('Tackle', 'Normal', 'phys', { contact: true }),          // strike
  mv('Rock Slide', 'Rock', 'phys', { contact: false }),       // slam
  mv('Earthquake', 'Ground', 'phys', { contact: false }),     // quake
  mv('Flamethrower', 'Fire', 'spec'),                         // beam
  mv('Surf', 'Water', 'spec'),                               // wave
  mv('Ice Beam', 'Ice', 'spec'),                             // beam
  mv('Thunderbolt', 'Electric', 'spec'),                     // bolt
  mv('Shadow Ball', 'Ghost', 'spec'),                        // orb
  mv('Sludge Bomb', 'Poison', 'spec'),                       // orb
  mv('Draco Meteor', 'Dragon', 'spec'),                      // meteor
  mv('Moonblast', 'Fairy', 'spec'),                          // orb
  mv('Aura Sphere', 'Fighting', 'spec'),                     // orb
  mv('Swords Dance', 'Normal', 'status', { target: 'self' }), // buff
  mv('Recover', 'Normal', 'status', { target: 'self' }),      // heal
  mv('Toxic', 'Poison', 'status'),                           // hex
  mv('Stealth Rock', 'Rock', 'status', { target: 'foeSide' }),// field
  mv('Reflect', 'Psychic', 'status', { target: 'allySide' }), // screen
];
const WEATHERS = [
  { label: '☀ Sun', kind: 'sun' }, { label: '🌧 Rain', kind: 'rain' },
  { label: '🌪 Sand', kind: 'sand' }, { label: '❄ Snow', kind: 'snow' },
];

// ---- layout ----------------------------------------------------------------
const POS = { ally: { x: 0.20, y: 0.70 }, foe: { x: 0.80, y: 0.42 } };
let attacker = 'Charizard', target = 'Venusaur', dir = 'ally';   // dir = who attacks
let busy = false, lastMove = null;

const root = document.querySelector('#lab');

const arena = el('div.arena');
function setScene(scene) { arena.style.setProperty('--bg', `url("${showdownBg(scene)}")`); }
setScene('meadow');
const stage = el('div.battle-stage', {}, arena, el('canvas', { id: 'fx-canvas' }));
const allySpot = el('div.combatant.ally');
const foeSpot = el('div.combatant.foe');
stage.append(allySpot, foeSpot);
const logLine = el('div.log-line', {}, 'FX Lab — pick a move.');

function spriteImg(name, back) {
  const img = el('img.art.anim', { alt: name, draggable: 'false' });
  const chain = [showdownUrl(name, { back, style: 'ani' }), showdownUrl(name, { back, style: 'xyani' })];
  let i = 0;
  const next = () => { if (i < chain.length) img.src = chain[i++]; };
  img.addEventListener('error', next); next();
  return img;
}
function renderMons() {
  clear(allySpot).append(el('div.token', {}, spriteImg(attacker, true)), el('div.platform'));
  clear(foeSpot).append(el('div.token', {}, spriteImg(target, false)), el('div.platform'));
}

// ---- battle-equivalent juice helpers (mirrors battle.js) -------------------
function posAtk() { return dir === 'ally' ? POS.ally : POS.foe; }
function posTgt() { return dir === 'ally' ? POS.foe : POS.ally; }
function spotAtk() { return dir === 'ally' ? allySpot : foeSpot; }
function spotTgt() { return dir === 'ally' ? foeSpot : allySpot; }

function cameraPunch(pt, amt = 0.05) {
  stage.style.transformOrigin = `${pt.x * 100}% ${pt.y * 100}%`;
  tween({ from: amt, to: 0, dur: 0.3, ease: Easing.expoOut, onUpdate: v => stage.style.setProperty('--cam', String(1 + v)) });
}
function flashType(color) {
  stage.style.setProperty('--flash-col', color);
  stage.classList.remove('flash-type'); void stage.offsetWidth; stage.classList.add('flash-type');
}
function floatDmg(pt, amount, heal = false) {
  const n = el('div.dmg-float' + (heal ? '.heal' : ''), {
    style: { left: `calc(${pt.x * 100}% - 1rem)`, top: `${pt.y * 100 - 12}%` },
  }, `${heal ? '+' : '−'}${amount}`);
  stage.append(n); setTimeout(() => n.remove(), 950);
}

async function perform(move) {
  if (busy) return;
  busy = true; lastMove = move;
  const arch = archetypeOf(move);
  const color = tintOf(move);
  const selfCast = ['buff', 'heal', 'screen', 'weather'].includes(arch) || move.target === 'self';
  const from = posAtk(), to = selfCast ? posAtk() : posTgt();
  logLine.textContent = `${attacker} used ${move.name}!  ·  [${arch}]`;

  const sp = spotAtk();
  sp.classList.remove('attack-ally', 'attack-foe', 'cast'); void sp.offsetWidth;
  if (isMelee(move)) sp.classList.add(dir === 'ally' ? 'attack-ally' : 'attack-foe');
  else sp.classList.add('cast');

  await playMoveAnim(move, { from, to }, { color });
  sp.classList.remove('cast');

  // on-hit reaction (skip for self-target moves)
  if (!selfCast) {
    const big = move.type === 'Dragon' || move.cat !== 'status';
    const ts = spotTgt();
    ts.classList.remove('hurt'); void ts.offsetWidth; ts.classList.add('hurt');
    flashType(color);
    cameraPunch(to, big ? 0.07 : 0.04);
    hitStop(big ? 0.07 : 0.035);
    screenShake(big ? 8 : 4);
    burst(to.x, to.y, { count: big ? 20 : 12, color, speed: 260, size: 4, shape: 'spark', blend: 'add', life: 0.35 });
    if (move.cat !== 'status') floatDmg(to, 20 + Math.floor(Math.abs(Math.sin(from.x * 99)) * 60));
  } else if (arch === 'heal') {
    floatDmg(from, 48, true);
  }
  await new Promise(r => setTimeout(r, 500));
  busy = false;
}

// ---- controls --------------------------------------------------------------
function picker(label, value, onChange) {
  const sel = el('select.lab-sel', { onchange: e => onChange(e.target.value) },
    ...ROSTER.map(n => el('option', { value: n, selected: n === value ? 'selected' : null }, n)));
  return el('label.lab-field', {}, el('span', {}, label), sel);
}

const controls = el('div.lab-controls', {},
  el('div.lab-row', {},
    picker('Attacker', attacker, v => { attacker = v; renderMons(); }),
    el('button.lab-btn.swap', { onclick: () => { dir = dir === 'ally' ? 'foe' : 'ally'; logLine.textContent = `Direction: ${dir === 'ally' ? 'You → Foe' : 'Foe → You'}`; } }, '⇄ Flip direction'),
    picker('Target', target, v => { target = v; renderMons(); }),
    el('label.lab-field', {}, el('span', {}, 'Scene'),
      el('select.lab-sel', { onchange: e => setScene(e.target.value) },
        ...BATTLE_SCENES.map(s => el('option', { value: s, selected: s === 'meadow' ? 'selected' : null }, s)))),
  ),
  el('div.lab-label', {}, 'Archetypes & signature moves'),
  el('div.lab-grid', {}, ...ARCHETYPES.map(m =>
    el('button.lab-move', { style: { '--c': TYPE_COLORS[m.type] }, onclick: () => perform(m) },
      el('b', {}, m.name), el('small', {}, `${m.type} · ${archetypeOf(m)}`)))),
  el('div.lab-label', {}, 'Weather (persistent)'),
  el('div.lab-row', {},
    ...WEATHERS.map(w => el('button.lab-btn', { onclick: () => { weatherStart(w.kind); stage.className = 'battle-stage w-' + w.kind; logLine.textContent = `Weather: ${w.label}`; } }, w.label)),
    el('button.lab-btn', { onclick: () => { weatherStop(); stage.className = 'battle-stage'; logLine.textContent = 'Weather cleared.'; } }, '✕ Clear'),
  ),
  el('div.lab-row', {},
    el('button.lab-btn', { onclick: () => lastMove && perform(lastMove) }, '↻ Replay last'),
    el('button.lab-btn', { onclick: () => runShowreel() }, '▶ Play all'),
    el('label.lab-field', {}, el('span', {}, 'Speed'),
      el('input', { type: 'range', min: '15', max: '100', value: '100',
        oninput: e => setTimeScale(Number(e.target.value) / 100) })),
  ),
);

async function runShowreel() {
  for (const m of ARCHETYPES) { await perform(m); await new Promise(r => setTimeout(r, 250)); }
}

root.append(el('div.battle', {}, stage, el('div.dock', {}, logLine, controls)));
attachFx(stage.querySelector('#fx-canvas'));
renderMons();
startLoop();

// Dev hook: freeze/resume the sim so a specific animation frame can be inspected.
window.__lab = {
  setTimeScale, hitStop,
  fire: (name) => { const m = ARCHETYPES.find(a => a.name === name); if (m) perform(m); return !!m; },
  freeze: () => setTimeScale(0),
  resume: () => setTimeScale(1),
};
