// Minimal tween engine on the shared rAF loop — a dependency-free stand-in for
// GSAP at this scope. Drives numeric interpolation with easing and returns a
// Promise so battle sequences can `await` motion. Honors loop hit-stop/timeScale
// because it advances on the same scaled dt every other ticker gets.
//
// If you ever outgrow this, the public surface (tween/Easing) is small enough
// to reimplement over GSAP without touching call sites.
import { onTick } from './loop.js';

export const Easing = {
  linear: t => t,
  quadIn: t => t * t,
  quadOut: t => 1 - (1 - t) * (1 - t),
  quadInOut: t => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  cubicOut: t => 1 - Math.pow(1 - t, 3),
  expoOut: t => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  sinInOut: t => -(Math.cos(Math.PI * t) - 1) / 2,
  backOut: (t, s = 1.70158) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2),
  backIn: (t, s = 1.70158) => (s + 1) * t * t * t - s * t * t,
  elasticOut: t => {
    if (t === 0 || t === 1) return t;
    const p = 0.3;
    return Math.pow(2, -10 * t) * Math.sin((t - p / 4) * (2 * Math.PI) / p) + 1;
  },
  bounceOut: t => {
    const n = 7.5625, d = 2.75;
    if (t < 1 / d) return n * t * t;
    if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75;
    if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375;
    return n * (t -= 2.625 / d) * t + 0.984375;
  },
};

const active = new Set();
let stop = null;

function ensureTick() {
  if (stop) return;
  stop = onTick(dt => {
    for (const tw of active) {
      tw.t += dt;
      const raw = Math.min(1, tw.t / tw.dur);
      const e = tw.ease(raw);
      tw.onUpdate(tw.from + (tw.to - tw.from) * e, e, raw);
      if (raw >= 1) { active.delete(tw); tw.resolve(); }
    }
    if (!active.size) { stop(); stop = null; }
  });
}

// tween({from,to,dur,ease,onUpdate}) -> Promise<void>
export function tween({ from = 0, to = 1, dur = 0.3, ease = Easing.quadOut, onUpdate = () => {} }) {
  return new Promise(resolve => {
    active.add({ from, to, dur: Math.max(0.0001, dur), ease, onUpdate, t: 0, resolve });
    ensureTick();
  });
}

// Convenience: run tweens in sequence.
export async function timeline(steps) {
  for (const s of steps) await tween(s);
}
