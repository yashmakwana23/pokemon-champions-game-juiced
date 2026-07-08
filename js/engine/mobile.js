// Mobile UX. The game is a 16:9 LANDSCAPE experience, so on a portrait phone it
// would squish. On touch devices we:
//   1. In PORTRAIT — cover the screen with a "rotate / go full-screen" gate.
//   2. In LANDSCAPE (player rotated directly) — a tap anywhere goes full-screen.
// Fullscreen + orientation lock work on Android Chrome. On iPhone Safari there
// is NO web fullscreen API and no orientation lock, so we instead tell the user
// to "Add to Home Screen" (a PWA launch is the only chromeless full-screen on
// iOS — see manifest.webmanifest + the apple-mobile-web-app meta tags). We also
// block pinch / double-tap zoom so taps don't zoom the game. Desktop untouched.
export function initMobile() {
  if (!window.matchMedia || !matchMedia('(pointer: coarse)').matches) return; // desktop → nothing

  // Block iOS pinch-zoom (double-tap zoom is handled by CSS touch-action).
  document.addEventListener('gesturestart', (e) => e.preventDefault(), { passive: false });
  document.addEventListener('dblclick', (e) => e.preventDefault(), { passive: false });

  const ua = navigator.userAgent || '';
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  const standalone = !!navigator.standalone
    || matchMedia('(display-mode: fullscreen)').matches
    || matchMedia('(display-mode: standalone)').matches;
  const el = document.documentElement;
  const fsSupported = !!(el.requestFullscreen || el.webkitRequestFullscreen);
  const inFullscreen = () => !!(document.fullscreenElement || document.webkitFullscreenElement);

  // iPhone Safari can't go full-screen from a web page → guide to Home Screen.
  // Everyone else gets the tap-to-full-screen button.
  const action = (isIOS && !standalone && !fsSupported)
    ? '<div class="mg-ios">On iPhone, tap <b>Share</b> then <b>“Add to Home Screen”</b> — open it from there to play full-screen.</div>'
    : '<button class="mg-btn" type="button">▶ Play Full-Screen</button>';

  const gate = document.createElement('div');
  gate.id = 'mobile-gate';
  gate.innerHTML =
    '<div class="mg-card">'
    + '<div class="mg-rot">⟳</div>'
    + '<div class="mg-title">Rotate your device</div>'
    + '<div class="mg-sub">Turn your phone sideways to play in landscape.</div>'
    + action
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

  const btn = gate.querySelector('.mg-btn');
  if (btn) btn.addEventListener('click', goImmersive);

  // Rotated straight to landscape? A tap anywhere goes full-screen (Android /
  // iPad). Guarded by fsSupported so it never fires uselessly on iPhone.
  if (fsSupported) {
    document.addEventListener('pointerdown', () => {
      if (!inFullscreen() && matchMedia('(orientation: landscape)').matches) goImmersive();
    }, { passive: true });
  }
}
