// Small RNG helpers. Battle uses Math.random via these wrappers so a seeded
// implementation could be swapped in for replays.
export const rand = () => Math.random();
export const chance = (p) => Math.random() < p;               // p in [0,1]
export const roll = (pct) => Math.random() * 100 < pct;       // pct in [0,100]
export const randInt = (min, max) => min + Math.floor(Math.random() * (max - min + 1));
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

export function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function pickN(arr, n) {
  return shuffle(arr).slice(0, n);
}
