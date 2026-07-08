// Mobile UX. The game is a 16:9 LANDSCAPE experience, so on a portrait phone it
// would squish. On touch devices we:
//   1. In PORTRAIT — cover the screen with a "rotate / Play Full-Screen" gate
//      (the same mental model as tapping full-screen on a video).
//   2. In LANDSCAPE (e.g. the player rotated the phone directly, skipping the
//      gate) — the first tap anywhere takes them full-screen, again like a video.
// Fullscreen + orientation lock work on Android Chrome; on iOS (no element
// fullscreen / no orientation lock on iPhone) these are graceful no-ops and the
// game simply plays in the rotated landscape view. Desktop is untouched.
export function initMobile() {
  if (!window.matchMedia || !matchMedia('(pointer: coarse)').matches) return; // desktop → nothing

  const gate = document.createElement('div');
  gate.id = 'mobile-gate';
  gate.innerHTML =
    '<div class="mg-card">'
    + '<div class="mg-rot">⟳</div>'
    + '<div class="mg-title">Rotate your device</div>'
    + '<div class="mg-sub">Turn your phone sideways to play — or tap below to go full-screen in landscape.</div>'
    + '<button class="mg-btn" type="button">▶ Play Full-Screen</button>'
    + '</div>';
  document.body.appendChild(gate);

  const el = document.documentElement;
  const fsSupported = !!(el.requestFullscreen || el.webkitRequestFullscreen);
  const inFullscreen = () => !!(document.fullscreenElement || document.webkitFullscreenElement);

  async function goImmersive() {
    try {
      if (el.requestFullscreen) await el.requestFullscreen();
      else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
    } catch (_) { /* fullscreen denied / unsupported (iOS) */ }
    try {
      if (screen.orientation && screen.orientation.lock) await screen.orientation.lock('landscape');
    } catch (_) { /* orientation lock unsupported (iOS / non-fullscreen) */ }
  }

  gate.querySelector('.mg-btn').addEventListener('click', goImmersive);

  // Rotated straight to landscape (gate never showed)? A tap anywhere goes
  // full-screen. Only fires while NOT already full-screen and while landscape,
  // so it triggers once and never hijacks portrait taps (the gate owns those).
  if (fsSupported) {
    const tapToFullscreen = () => {
      if (!inFullscreen() && matchMedia('(orientation: landscape)').matches) goImmersive();
    };
    document.addEventListener('pointerdown', tapToFullscreen, { passive: true });
  }
}
