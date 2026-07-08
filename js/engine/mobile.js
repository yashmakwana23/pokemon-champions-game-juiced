// Mobile UX. The game is a 16:9 LANDSCAPE experience, so on a portrait phone it
// would squish. On touch devices in portrait we cover the screen with a gate
// ("rotate to landscape / tap for full-screen") — the same mental model as
// tapping full-screen on a video. Tapping the button requests fullscreen and
// locks landscape where supported (Android Chrome); on iOS (no lock / no
// element fullscreen on iPhone) the user simply rotates the device and the gate
// clears itself via the CSS orientation media query. Desktop is untouched.
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

  async function goImmersive() {
    const el = document.documentElement;
    try {
      if (el.requestFullscreen) await el.requestFullscreen();
      else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
    } catch (_) { /* fullscreen denied / unsupported (iOS) */ }
    try {
      if (screen.orientation && screen.orientation.lock) await screen.orientation.lock('landscape');
    } catch (_) { /* orientation lock unsupported (iOS / non-fullscreen) */ }
  }
  gate.querySelector('.mg-btn').addEventListener('click', goImmersive);
}
