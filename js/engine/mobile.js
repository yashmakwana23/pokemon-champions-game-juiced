// Mobile UX. The game is a LANDSCAPE experience, so on a portrait phone it
// would squish. On touch devices we:
//   1. In PORTRAIT — cover the screen with a "rotate your device" gate.
//   2. In LANDSCAPE — the game fills the whole viewport (see base.css); on
//      Android/iPad a tap also requests true fullscreen + landscape lock.
// On iOS EVERY browser (Safari, Chrome, Firefox…) is forced onto WebKit, which
// has no web Fullscreen API and no orientation lock — so there we just fill the
// landscape viewport and let the slim browser bar be. We also block pinch /
// double-tap zoom so taps don't zoom the game. Desktop is untouched.
export function initMobile() {
  if (!window.matchMedia || !matchMedia('(pointer: coarse)').matches) return; // desktop → nothing

  // Stop zoom-on-tap (double-tap zoom is also handled by CSS touch-action).
  document.addEventListener('gesturestart', (e) => e.preventDefault(), { passive: false });
  document.addEventListener('dblclick', (e) => e.preventDefault(), { passive: false });

  const el = document.documentElement;
  const fsSupported = !!(el.requestFullscreen || el.webkitRequestFullscreen); // false on all iOS browsers
  const inFullscreen = () => !!(document.fullscreenElement || document.webkitFullscreenElement);

  const gate = document.createElement('div');
  gate.id = 'mobile-gate';
  gate.innerHTML =
    '<div class="mg-card">'
    + '<div class="mg-brand">Pokémon</div>'
    + '<div class="mg-rot">⟳</div>'
    + '<div class="mg-title">Ready, Champion?</div>'
    + '<div class="mg-sub">' + (fsSupported
        ? 'Tap to start — we’ll flip to full-screen landscape.'
        : 'Rotate your device to landscape to play.') + '</div>'
    + (fsSupported ? '<button class="mg-btn" type="button">▶ Tap to Start</button>' : '')
    + '</div>';
  document.body.appendChild(gate);

  async function goImmersive() {
    try {
      if (el.requestFullscreen) await el.requestFullscreen();
      else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
    } catch (_) { /* denied / unsupported */ }
    try {
      if (screen.orientation && screen.orientation.lock) await screen.orientation.lock('landscape');
    } catch (_) { /* unsupported */ }
  }

  if (fsSupported) {
    // tap anywhere on the gate (not just the button) starts in full-screen
    gate.addEventListener('click', goImmersive);
    // Rotated straight to landscape? A tap anywhere goes full-screen — once,
    // while not already full-screen, and only in landscape.
    document.addEventListener('pointerdown', () => {
      if (!inFullscreen() && matchMedia('(orientation: landscape)').matches) goImmersive();
    }, { passive: true });
  }
}
