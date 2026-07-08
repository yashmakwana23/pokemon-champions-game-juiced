// Canvas FX layer: particles, beams, projectiles, bolts, rings, slashes,
// weather, hit flashes and screen shake for the battle stage. One pooled
// particle array plus a small set of custom "drawables" (beams / orbs / rings),
// all advanced from the shared rAF loop — so hit-stop freezes them together.
//
// Coordinates for every emitter are NORMALIZED (0–1) within the canvas, so the
// battle scene can reuse its posOf() spots directly.
import { onTick } from './loop.js';

const POOL_SIZE = 480;
const pool = Array.from({ length: POOL_SIZE }, () => newParticle());
let poolIdx = 0;

function newParticle() {
  return {
    active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 0,
    size: 2, color: '#fff', grav: 0, drag: 0, shape: 'dot',
    rot: 0, spin: 0, s0: 1, s1: 1, blend: 'normal', fadePow: 1, img: null,
  };
}

// Textured effect sprites (Showdown /fx/). Drawn straight to canvas (the CDN
// sends no CORS header, so no crossOrigin — this taints the canvas for pixel
// reads but displays fine). Cached Image objects; preload the common set.
const FX_BASE = 'https://play.pokemonshowdown.com/fx/';
const imgCache = {};
export function fxImage(name) {
  if (!name) return null;
  if (!imgCache[name]) { const im = new Image(); im.src = FX_BASE + name + '.png'; imgCache[name] = im; }
  return imgCache[name];
}
export function preloadFx(names) { for (const n of names) fxImage(n); }

let canvas = null, ctx = null, stopTick = null;
let shake = { t: 0, mag: 0 };
const drawables = new Set();   // beams, orbs, rings, bolts, slashes
let weather = null;            // {kind} or null

export function attachFx(canvasEl) {
  canvas = canvasEl;
  ctx = canvas.getContext('2d');
  resize();
  window.addEventListener('resize', resize);
  stopTick = onTick(draw);
}

export function detachFx() {
  stopTick?.();
  stopTick = null;
  window.removeEventListener('resize', resize);
  for (const p of pool) p.active = false;
  drawables.clear();
  weather = null;
  canvas = null; ctx = null;
}

function resize() {
  if (!canvas) return;
  const r = canvas.getBoundingClientRect();
  canvas.width = r.width * devicePixelRatio;
  canvas.height = r.height * devicePixelRatio;
}

function dims() { return { w: canvas.width / devicePixelRatio, h: canvas.height / devicePixelRatio }; }

function spawn(props) {
  const p = pool[poolIdx];
  poolIdx = (poolIdx + 1) % POOL_SIZE;
  Object.assign(p, newParticle(), props, { active: true, maxLife: props.life });
  return p;
}

// ---- particle emitters ----------------------------------------------------

// Radial (or directional) burst at a normalized point.
export function burst(nx, ny, {
  count = 18, color = '#7df9ff', speed = 220, size = 4, grav = 300,
  shape = 'dot', spread = Math.PI * 2, dir = -Math.PI / 2, drag = 0,
  blend = 'normal', spin = 0, life = null, upBias = 0.3, s0 = 1, s1 = 0.2, spawnR = 0, img = null,
} = {}) {
  if (!canvas) return;
  const sprite = img ? fxImage(img) : null;
  const { w, h } = dims();
  for (let i = 0; i < count; i++) {
    const a = dir + (Math.random() - 0.5) * spread;
    const v = speed * (0.4 + Math.random() * 0.8);
    const ox = (Math.random() - 0.5) * spawnR, oy = (Math.random() - 0.5) * spawnR;
    spawn({
      x: nx * w + ox, y: ny * h + oy,
      vx: Math.cos(a) * v, vy: Math.sin(a) * v - speed * upBias,
      life: life ?? (0.4 + Math.random() * 0.5), size: size * (0.6 + Math.random() * 0.9),
      color, grav, drag, shape: sprite ? 'sprite' : shape, blend, s0, s1, img: sprite,
      rot: Math.random() * Math.PI, spin: spin * (Math.random() - 0.5) * 2,
    });
  }
}

// Dust / smoke puffs — dark, semi-transparent, rise and GROW as they fade.
export function smoke(nx, ny, { count = 8, color = 'rgba(70,60,55,0.55)', rise = 60, spreadPx = 60 } = {}) {
  if (!canvas) return;
  const { w, h } = dims();
  for (let i = 0; i < count; i++) {
    spawn({
      x: nx * w + (Math.random() - 0.5) * spreadPx, y: ny * h + (Math.random() - 0.5) * spreadPx * 0.5,
      vx: (Math.random() - 0.5) * 40, vy: -rise * (0.5 + Math.random()),
      life: 0.6 + Math.random() * 0.7, size: 8 + Math.random() * 8,
      color, grav: -20, drag: 1.2, shape: 'circle', blend: 'normal', s0: 0.5, s1: 2.4,
    });
  }
}

// ---- element-flavoured impacts -------------------------------------------
// Each element reads distinctly so different moves stop looking the same.

export function flame(nx, ny, { big = false } = {}) {                        // Fire
  burst(nx, ny, { img: 'flareball', count: big ? 15 : 10, color: '#ffae3a', speed: 150, size: 7, grav: -120, blend: 'add', drag: 1.3, life: 0.55, spin: 2, upBias: 0.5 });
  burst(nx, ny, { count: big ? 16 : 10, color: '#ff6a1a', speed: 120, size: 6, grav: -110, shape: 'glow', blend: 'add', upBias: 0.6, drag: 1.4, life: 0.55, s0: 1.3, s1: 0.1 });
  burst(nx, ny, { count: 8, color: '#fff2a8', speed: 250, size: 3, shape: 'spark', blend: 'add', life: 0.4 }); // embers
  smoke(nx, ny - 0.01, { count: big ? 7 : 4 });
}

export function splash(nx, ny, { big = false } = {}) {                       // Water
  burst(nx, ny, { img: 'waterwisp', count: big ? 15 : 10, color: '#6fd0ff', speed: 260, size: 6, grav: 480, blend: 'add', life: 0.5, spin: 2, upBias: 0.8 });
  burst(nx, ny, { count: big ? 22 : 15, color: '#eaffff', speed: 300, size: 4, grav: 700, shape: 'circle', upBias: 0.9, life: 0.5 }); // droplets
  ring(nx, ny, { color: '#8fe0ff', maxR: big ? 0.18 : 0.13, dur: 0.4, width: 5 });
}

export function sparks(nx, ny, { big = false } = {}) {                       // Electric
  burst(nx, ny, { img: 'electroball', count: big ? 12 : 8, color: '#fff27a', speed: 210, size: 6, blend: 'add', drag: 0.8, life: 0.35, spin: 5 });
  burst(nx, ny, { count: big ? 24 : 16, color: '#fff27a', speed: 380, size: 4, shape: 'spark', blend: 'add', drag: 0.6, life: 0.3 });
  ring(nx, ny, { color: '#fff27a', maxR: 0.12, dur: 0.24, width: 3 });
}

export function leaves(nx, ny, { big = false } = {}) {                       // Grass
  burst(nx, ny, { img: 'leaf1', count: big ? 12 : 8, color: '#7ee06a', speed: 230, size: 5, grav: 200, drag: 0.8, upBias: 0.5, life: 0.9, spin: 7 });
  burst(nx, ny, { img: 'leaf2', count: big ? 10 : 6, color: '#c8f5a0', speed: 170, size: 4, grav: 150, life: 0.85, spin: 9 });
}

export function shards(nx, ny, { big = false } = {}) {                       // Ice
  burst(nx, ny, { img: 'iceball', count: big ? 12 : 8, color: '#bfefff', speed: 300, size: 5, blend: 'add', grav: 120, life: 0.5, spin: 4 });
  burst(nx, ny, { img: 'icicle', count: big ? 10 : 7, color: '#ffffff', speed: 340, size: 5, grav: 160, life: 0.45, spin: 3 });
  ring(nx, ny, { color: '#cdefff', maxR: 0.13, dur: 0.35, width: 4 });
}

export function wisps(nx, ny, { big = false } = {}) {                        // Ghost
  burst(nx, ny, { img: 'shadowball', count: big ? 12 : 8, color: '#9a6bff', speed: 120, size: 8, grav: -60, blend: 'add', drag: 0.7, life: 0.8, spin: 3 });
  burst(nx, ny, { img: 'blackwisp', count: big ? 8 : 6, color: '#4a2f7a', speed: 90, size: 7, grav: -40, life: 0.7, spin: 4 });
}

export function bubbles(nx, ny, { big = false } = {}) {                      // Poison
  burst(nx, ny, { img: 'poisonwisp', count: big ? 14 : 9, color: '#c561e0', speed: 130, size: 6, grav: -70, blend: 'add', drag: 0.9, life: 0.8, spin: 2 });
  burst(nx, ny, { count: big ? 14 : 10, color: '#8a2fb0', speed: 260, size: 4, grav: 500, shape: 'circle', upBias: 0.4, life: 0.6 }); // splatter
  smoke(nx, ny, { count: 3, color: 'rgba(120,40,150,0.4)', rise: 40 });
}

export function sparkles(nx, ny, { big = false } = {}) {                     // Fairy
  burst(nx, ny, { img: 'mistball', count: big ? 12 : 8, color: '#ffb3e6', speed: 170, size: 6, blend: 'add', grav: -20, drag: 0.6, life: 0.8, spin: 3 });
  burst(nx, ny, { count: big ? 18 : 12, color: '#ffd6f2', speed: 220, size: 4, shape: 'star', blend: 'add', grav: -20, life: 0.8, spin: 6 });
  ring(nx, ny, { color: '#ffc9ee', maxR: 0.14, dur: 0.4, width: 4 });
}

export function debris(nx, ny, { big = false } = {}) {                       // Rock / Ground
  burst(nx, ny, { img: 'rock1', count: big ? 11 : 7, color: '#a07a4a', speed: 260, size: 6, grav: 900, upBias: 0.7, spin: 5, life: 0.7 });
  burst(nx, ny, { img: 'rock2', count: big ? 9 : 6, color: '#8a6a40', speed: 220, size: 5, grav: 850, upBias: 0.6, spin: 6, life: 0.7 });
  smoke(nx, ny, { count: big ? 8 : 5, color: 'rgba(120,100,80,0.5)', rise: 50, spreadPx: 90 });
  ring(nx, ny, { color: '#caa46a', maxR: big ? 0.17 : 0.12, dur: 0.4, width: 5 });
}

// generic energy burst (Dragon / Psychic / Dark / Steel / Normal / Flying / Bug)
export function energy(nx, ny, { color = '#b26bff', big = false } = {}) {
  burst(nx, ny, { img: 'energyball', count: big ? 12 : 8, color, speed: 260, size: 6, blend: 'add', drag: 0.7, life: 0.5, spin: 3 });
  burst(nx, ny, { count: big ? 14 : 10, color, speed: 340, size: 3, shape: 'spark', blend: 'add', life: 0.35 });
  ring(nx, ny, { color, maxR: big ? 0.16 : 0.12, dur: 0.36, width: 5 });
}

// Cone spray from `from` toward `to` (flamethrower / water pump feel).
export function cone(from, to, { count = 26, color = '#EE8130', speed = 320, size = 5, shape = 'glow', spread = 0.5, life = 0.5 } = {}) {
  const dir = Math.atan2(to.y - from.y, to.x - from.x);
  burst(from.x, from.y, { count, color, speed, size, grav: 30, shape, spread, dir, blend: 'add', drag: 1.5, life, upBias: 0 });
}

// Rising fountain of sparkles (self-buff / heal).
export function fountain(nx, ny, { color = '#ffd76b', count = 26, shape = 'star', spin = false } = {}) {
  if (!canvas) return;
  const { w, h } = dims();
  for (let i = 0; i < count; i++) {
    spawn({
      x: nx * w + (Math.random() - 0.5) * 96, y: ny * h + Math.random() * 44,
      vx: (Math.random() - 0.5) * 40, vy: -90 - Math.random() * 150,
      life: 0.7 + Math.random() * 0.6, size: 2 + Math.random() * 3.5,
      color, grav: -40, shape, blend: 'add', spin: spin ? 6 : 0, s1: 0.4,
    });
  }
}

// Kept for API compatibility (heal sparkle).
export function sparkleRise(nx, ny, color = '#ffd76b') { fountain(nx, ny, { color }); }

// Quick slash streaks (physical contact impact).
export function slash(nx, ny, { color = '#ffffff', count = 3 } = {}) {
  push(0.26, (k) => {
    if (k > 0.6) return;
    const { w, h } = dims();
    const cx = nx * w, cy = ny * h, R = Math.min(w, h) * 0.12;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = color; ctx.lineCap = 'round';
    ctx.globalAlpha = 1 - k / 0.6;
    for (let i = 0; i < count; i++) {
      const a = -0.7 + i * 0.5;
      ctx.lineWidth = 3 + (1 - k) * 5;
      ctx.beginPath();
      ctx.moveTo(cx - Math.cos(a) * R * (1 + k), cy - Math.sin(a) * R * (1 + k));
      ctx.lineTo(cx + Math.cos(a) * R * (1 + k), cy + Math.sin(a) * R * (1 + k));
      ctx.stroke();
    }
    ctx.restore();
  });
  burst(nx, ny, { count: 10, color, speed: 260, size: 3, shape: 'spark', blend: 'add', life: 0.3 });
}

// Expanding shockwave ring.
export function ring(nx, ny, { color = '#ffffff', maxR = 0.22, dur = 0.4, width = 5 } = {}) {
  push(dur, (k) => {
    const { w, h } = dims();
    const R = Math.min(w, h) * maxR * ease(k);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 1 - k;
    ctx.strokeStyle = color;
    ctx.lineWidth = width * (1 - k * 0.6);
    ctx.beginPath();
    ctx.arc(nx * w, ny * h, R, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  });
}

// ---- travelling / sustained effects (return Promises) ---------------------

// Glowing orb travelling from → to, leaving a trail. Resolves on arrival.
// With `img`, the orb is a textured effect sprite (fireball / shadowball / …).
export function projectile(from, to, { color = '#b26bff', dur = 0.34, size = 12, trail = true, img = null } = {}) {
  const { w, h } = dims();
  const sprite = img ? fxImage(img) : null;
  return new Promise(resolve => {
    push(dur, (k) => {
      const e = ease(k);
      const x = from.x + (to.x - from.x) * e;
      const y = from.y + (to.y - from.y) * e - Math.sin(k * Math.PI) * 0.06; // slight arc
      if (trail && Math.random() < 0.8) {
        spawn({
          x: x * w + (Math.random() - 0.5) * 6, y: y * h + (Math.random() - 0.5) * 6,
          vx: 0, vy: 0, life: 0.35, size: size * 0.45, color, grav: 0, shape: 'glow', blend: 'add', s1: 0,
        });
      }
      if (sprite && sprite.complete && sprite.naturalWidth) {
        const s = size * 5.5;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.translate(x * w, y * h); ctx.rotate(k * 9);
        ctx.drawImage(sprite, -s / 2, -s / 2, s, s);
        ctx.restore();
      } else {
        glowBlob(x * w, y * h, size, color);
      }
    }, resolve);
  });
}

// Sustained additive beam from → to for `dur`. Resolves when it ends.
export function beam(from, to, { color = '#EE8130', dur = 0.5, width = 12, core = '#fff' } = {}) {
  const { w, h } = dims();
  return new Promise(resolve => {
    push(dur, (k) => {
      const grow = Math.min(1, k / 0.25);              // extend out
      const fade = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;  // fade out tail
      const x0 = from.x * w, y0 = from.y * h;
      const x1 = from.x * w + (to.x - from.x) * w * grow;
      const y1 = from.y * h + (to.y - from.y) * h * grow;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = fade;
      ctx.lineCap = 'round';
      const wob = 1 + Math.sin(k * 40) * 0.12;
      ctx.strokeStyle = color; ctx.lineWidth = width * wob;
      ctx.shadowColor = color; ctx.shadowBlur = width * 1.4;
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = core; ctx.lineWidth = width * 0.4 * wob;
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
      ctx.restore();
      if (grow >= 1 && Math.random() < 0.9) burst(to.x, to.y, { count: 3, color, speed: 160, size: 4, shape: 'glow', blend: 'add', life: 0.3 });
    }, resolve);
  });
}

// Jagged lightning bolt from → to, flickering a few times.
export function bolt(from, to, { color = '#F7D02C', dur = 0.36, segments = 7, strikes = 3 } = {}) {
  const { w, h } = dims();
  return new Promise(resolve => {
    push(dur, (k) => {
      const strike = Math.floor(k * strikes);
      if ((k * strikes) % 1 > 0.55) return; // flicker gaps
      const seed = strike * 13.13;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = color; ctx.shadowColor = color; ctx.shadowBlur = 14;
      ctx.lineWidth = 3 + Math.random() * 2; ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(from.x * w, from.y * h);
      for (let i = 1; i < segments; i++) {
        const t = i / segments;
        const jx = Math.sin(seed + i * 2.7) * 0.04;
        const jy = Math.cos(seed + i * 1.9) * 0.04;
        ctx.lineTo((from.x + (to.x - from.x) * t + jx) * w, (from.y + (to.y - from.y) * t + jy) * h);
      }
      ctx.lineTo(to.x * w, to.y * h);
      ctx.stroke();
      ctx.restore();
    }, resolve);
  });
}

// ---- weather ---------------------------------------------------------------

export function weatherStart(kind) { weather = kind ? { kind } : null; }
export function weatherStop() { weather = null; }

function tickWeather() {
  if (!weather || !canvas) return;
  const { w, h } = dims();
  const k = weather.kind;
  if (k === 'rain') for (let i = 0; i < 3; i++) spawn({ x: Math.random() * w, y: -10, vx: -60, vy: 900, life: 0.9, size: 2, color: '#8fd3ff', shape: 'spark', blend: 'add' });
  else if (k === 'snow') for (let i = 0; i < 2; i++) spawn({ x: Math.random() * w, y: -10, vx: (Math.random() - 0.5) * 30, vy: 90 + Math.random() * 60, life: 3, size: 3, color: '#e9f6ff', shape: 'circle', spin: 2, drag: 0.2 });
  else if (k === 'sand') for (let i = 0; i < 3; i++) spawn({ x: -10, y: Math.random() * h, vx: 520 + Math.random() * 200, vy: (Math.random() - 0.5) * 60, life: 1.1, size: 2, color: '#d8b171', shape: 'dot', blend: 'normal' });
  else if (k === 'sun' && Math.random() < 0.25) spawn({ x: Math.random() * w, y: Math.random() * h * 0.5, vx: 20, vy: 30, life: 1.4, size: 3, color: '#ffe08a', shape: 'star', blend: 'add', s1: 0 });
}

// ---- shared drawable + effects ---------------------------------------------

function push(dur, onDraw, resolve) { drawables.add({ t: 0, dur: Math.max(0.01, dur), onDraw, resolve }); }
function ease(t) { return 1 - Math.pow(1 - t, 3); } // cubicOut

function glowBlob(x, y, size, color) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(x, y, 0, x, y, size);
  g.addColorStop(0, color); g.addColorStop(0.4, color); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(x, y, size, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

export function screenShake(mag = 8, dur = 0.3) { shake.mag = mag; shake.t = dur; }

export function flashStage(cls = 'flash-hit') {
  const stage = document.querySelector('.battle-stage');
  if (!stage) return;
  stage.classList.remove('flash-hit', 'flash-heal', 'flash-mega');
  void stage.offsetWidth; // restart animation
  stage.classList.add(cls);
}

// ---- draw ------------------------------------------------------------------

function draw(dt) {
  if (!ctx || !canvas) return;
  ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (shake.t > 0) {
    shake.t -= dt;
    const stage = document.querySelector('.battle-stage');
    if (stage) {
      const m = shake.mag * (shake.t > 0 ? shake.t : 0) * 3;
      stage.style.setProperty('--shk-x', (shake.t > 0 ? (Math.random() - 0.5) * m : 0) + 'px');
      stage.style.setProperty('--shk-y', (shake.t > 0 ? (Math.random() - 0.5) * m : 0) + 'px');
    }
  }

  tickWeather();

  // custom drawables (beams / orbs / rings / bolts)
  for (const d of drawables) {
    d.t += dt;
    const k = Math.min(1, d.t / d.dur);
    try { d.onDraw(k, dt); } catch (e) { console.error('fx drawable', e); drawables.delete(d); continue; }
    if (k >= 1) { drawables.delete(d); d.resolve?.(); }
  }

  // particles
  for (const p of pool) {
    if (!p.active) continue;
    p.life -= dt;
    if (p.life <= 0) { p.active = false; continue; }
    if (p.drag) { const f = Math.max(0, 1 - p.drag * dt); p.vx *= f; p.vy *= f; }
    p.vy += p.grav * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.rot += p.spin * dt;
    const lifeK = p.life / p.maxLife;
    const alpha = Math.min(1, Math.pow(lifeK, p.fadePow) * 1.6);
    const scl = p.s0 + (p.s1 - p.s0) * (1 - lifeK);
    ctx.globalAlpha = alpha;
    if (p.blend === 'add') ctx.globalCompositeOperation = 'lighter';
    drawParticle(p, scl);
    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.globalAlpha = 1;
}

function drawParticle(p, scl) {
  const size = Math.max(1, p.size * scl);
  if (p.shape === 'sprite') {
    if (p.img && p.img.complete && p.img.naturalWidth) {
      const s = size * 6.5;
      ctx.save();
      ctx.translate(p.x, p.y); ctx.rotate(p.rot);
      ctx.drawImage(p.img, -s / 2, -s / 2, s, s);
      ctx.restore();
    } else { // image not ready yet → soft glow stand-in
      glowBlob(p.x, p.y, size * 2, p.color);
    }
  } else if (p.shape === 'star') {
    ctx.fillStyle = p.color;
    ctx.font = `${size * 3.4}px serif`;
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
    ctx.fillText('✦', -size * 1.7, size * 1.2); ctx.restore();
  } else if (p.shape === 'glow') {
    glowBlob(p.x, p.y, size * 2.2, p.color);
  } else if (p.shape === 'circle') {
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, size, 0, Math.PI * 2); ctx.fill();
  } else if (p.shape === 'spark') {
    const len = Math.max(6, Math.hypot(p.vx, p.vy) * 0.02);
    const a = Math.atan2(p.vy, p.vx);
    ctx.strokeStyle = p.color; ctx.lineWidth = Math.max(1.5, size * 0.6); ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x - Math.cos(a) * len, p.y - Math.sin(a) * len);
    ctx.stroke();
  } else {
    // square pixels for the retro look
    const s = Math.max(2, Math.round(size * 1.6));
    ctx.fillStyle = p.color;
    ctx.fillRect(Math.round(p.x - s / 2), Math.round(p.y - s / 2), s, s);
  }
}
