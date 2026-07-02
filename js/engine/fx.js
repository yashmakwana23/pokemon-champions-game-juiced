// Canvas FX layer: particles, hit flashes and screen shake for the battle
// stage. One pooled particle array, drawn from the shared rAF loop.
import { onTick } from './loop.js';

const POOL_SIZE = 256;
const pool = Array.from({ length: POOL_SIZE }, () => ({
  active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 0,
  size: 2, color: '#fff', grav: 0, shape: 'dot',
}));
let poolIdx = 0;

let canvas = null, ctx = null, stopTick = null;
let shake = { t: 0, mag: 0 };

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
  canvas = null; ctx = null;
}

function resize() {
  if (!canvas) return;
  const r = canvas.getBoundingClientRect();
  canvas.width = r.width * devicePixelRatio;
  canvas.height = r.height * devicePixelRatio;
}

function spawn(props) {
  const p = pool[poolIdx];
  poolIdx = (poolIdx + 1) % POOL_SIZE;
  Object.assign(p, { active: true, grav: 0, shape: 'dot' }, props, { maxLife: props.life });
  return p;
}

// burst at normalized coords (0–1 within canvas)
export function burst(nx, ny, { count = 18, color = '#7df9ff', speed = 220, size = 4, grav = 300, shape = 'dot' } = {}) {
  if (!canvas) return;
  const w = canvas.width / devicePixelRatio, h = canvas.height / devicePixelRatio;
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const v = speed * (0.4 + Math.random() * 0.8);
    spawn({
      x: nx * w, y: ny * h,
      vx: Math.cos(a) * v, vy: Math.sin(a) * v - speed * 0.3,
      life: 0.4 + Math.random() * 0.5, size: size * (0.6 + Math.random() * 0.9),
      color, grav, shape,
    });
  }
}

export function sparkleRise(nx, ny, color = '#ffd76b') {
  if (!canvas) return;
  const w = canvas.width / devicePixelRatio, h = canvas.height / devicePixelRatio;
  for (let i = 0; i < 24; i++) {
    spawn({
      x: nx * w + (Math.random() - 0.5) * 90, y: ny * h + Math.random() * 40,
      vx: (Math.random() - 0.5) * 40, vy: -80 - Math.random() * 140,
      life: 0.7 + Math.random() * 0.6, size: 2 + Math.random() * 3.5,
      color, grav: -40, shape: 'star',
    });
  }
}

export function screenShake(mag = 8, dur = 0.3) {
  shake.mag = mag; shake.t = dur;
}

export function flashStage(cls = 'flash-hit') {
  const stage = document.querySelector('.battle-stage');
  if (!stage) return;
  stage.classList.remove('flash-hit', 'flash-heal', 'flash-mega');
  void stage.offsetWidth; // restart animation
  stage.classList.add(cls);
}

function draw(dt) {
  if (!ctx || !canvas) return;
  ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (shake.t > 0) {
    shake.t -= dt;
    const stage = document.querySelector('.battle-stage');
    if (stage) {
      const m = shake.mag * (shake.t > 0 ? shake.t : 0) * 3;
      stage.style.transform = shake.t > 0
        ? `translate(${(Math.random() - 0.5) * m}px, ${(Math.random() - 0.5) * m}px)` : '';
    }
  }

  for (const p of pool) {
    if (!p.active) continue;
    p.life -= dt;
    if (p.life <= 0) { p.active = false; continue; }
    p.vy += p.grav * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    const alpha = Math.min(1, p.life / (p.maxLife * 0.5));
    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.color;
    if (p.shape === 'star') {
      ctx.font = `${p.size * 3.4}px serif`;
      ctx.fillText('✦', p.x, p.y);
    } else {
      // square pixels for the retro look
      const s = Math.max(2, Math.round(p.size * 1.6));
      ctx.fillRect(Math.round(p.x - s / 2), Math.round(p.y - s / 2), s, s);
    }
  }
  ctx.globalAlpha = 1;
}
