// Single requestAnimationFrame loop with delta time. Subscribers register
// tick callbacks; scene changes unsubscribe their own tickers.
//
// A global timeScale + hard-freeze lets the battle layer do "hit-stop":
// briefly freeze the simulation on a heavy impact for a punchy arcade feel,
// then snap back. tickers receive the SCALED dt so particles and tweens freeze
// together, while wall-clock pacing (setTimeout) keeps running.
const tickers = new Set();
let last = 0;
let running = false;

let timeScale = 1;
let holdT = 0;        // seconds of hard-freeze remaining (dt forced to 0)

function frame(now) {
  if (!running) return;
  let dt = Math.min((now - last) / 1000, 0.1); // clamp long tab-away frames
  last = now;
  if (holdT > 0) { holdT = Math.max(0, holdT - dt); dt = 0; }
  else dt *= timeScale;
  for (const fn of tickers) {
    try { fn(dt, now); } catch (e) { console.error('ticker', e); }
  }
  requestAnimationFrame(frame);
}

export function startLoop() {
  if (running) return;
  running = true;
  last = performance.now();
  requestAnimationFrame(frame);
}

export function onTick(fn) {
  tickers.add(fn);
  return () => tickers.delete(fn);
}

// Hard-freeze the sim for `sec` seconds (hit-stop). Wall-clock keeps ticking.
export function hitStop(sec = 0.08) { holdT = Math.max(holdT, sec); }
export function setTimeScale(s = 1) { timeScale = s; }
