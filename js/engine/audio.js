// Synth SFX via WebAudio — no asset files. Degrades to silence if the
// AudioContext is unavailable or not yet user-activated.
let ctx = null;
let enabled = true;

function ac() {
  if (!enabled) return null;
  try {
    ctx ??= new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  } catch { enabled = false; return null; }
}

function tone({ freq = 440, dur = 0.12, type = 'square', vol = 0.06, slide = 0, delay = 0 }) {
  const a = ac(); if (!a) return;
  const t0 = a.currentTime + delay;
  const osc = a.createOscillator();
  const gain = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t0 + dur);
  gain.gain.setValueAtTime(vol, t0);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain).connect(a.destination);
  osc.start(t0); osc.stop(t0 + dur + 0.02);
}

export const sfx = {
  click:   () => tone({ freq: 660, dur: 0.05, type: 'triangle', vol: 0.05 }),
  confirm: () => { tone({ freq: 523, dur: 0.08 }); tone({ freq: 784, dur: 0.1, delay: 0.07 }); },
  cancel:  () => tone({ freq: 240, dur: 0.09, type: 'sawtooth', vol: 0.04 }),
  hit:     () => tone({ freq: 180, dur: 0.12, type: 'sawtooth', vol: 0.08, slide: -120 }),
  superHit:() => { tone({ freq: 160, dur: 0.16, type: 'sawtooth', vol: 0.1, slide: -130 }); tone({ freq: 90, dur: 0.2, type: 'square', vol: 0.07, delay: 0.05, slide: -60 }); },
  weakHit: () => tone({ freq: 300, dur: 0.07, type: 'triangle', vol: 0.05, slide: -80 }),
  heal:    () => { tone({ freq: 523, dur: 0.1, type: 'sine' }); tone({ freq: 659, dur: 0.1, type: 'sine', delay: 0.09 }); tone({ freq: 784, dur: 0.14, type: 'sine', delay: 0.18 }); },
  faint:   () => tone({ freq: 320, dur: 0.5, type: 'sawtooth', vol: 0.07, slide: -280 }),
  mega:    () => { for (let i = 0; i < 5; i++) tone({ freq: 330 * Math.pow(1.25, i), dur: 0.12, type: 'square', vol: 0.06, delay: i * 0.07 }); },
  win:     () => { [523, 659, 784, 1047].forEach((f, i) => tone({ freq: f, dur: 0.16, type: 'triangle', vol: 0.08, delay: i * 0.13 })); },
  lose:    () => { [392, 330, 262, 196].forEach((f, i) => tone({ freq: f, dur: 0.2, type: 'triangle', vol: 0.07, delay: i * 0.16 })); },
  buy:     () => { tone({ freq: 880, dur: 0.06 }); tone({ freq: 1174, dur: 0.09, delay: 0.06 }); },
  rankup:  () => { [440, 554, 659, 880, 1108].forEach((f, i) => tone({ freq: f, dur: 0.14, type: 'square', vol: 0.06, delay: i * 0.1 })); },
  status:  () => tone({ freq: 200, dur: 0.18, type: 'square', vol: 0.05, slide: 60 }),
};

export function setAudioEnabled(v) { enabled = v; }
export function audioEnabled() { return enabled; }
