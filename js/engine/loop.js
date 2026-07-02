// Single requestAnimationFrame loop with delta time. Subscribers register
// tick callbacks; scene changes unsubscribe their own tickers.
const tickers = new Set();
let last = 0;
let running = false;

function frame(now) {
  if (!running) return;
  const dt = Math.min((now - last) / 1000, 0.1); // clamp long tab-away frames
  last = now;
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
