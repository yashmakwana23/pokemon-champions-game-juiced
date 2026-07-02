// Scene manager. A scene is {enter(root, params), exit()}; exit must clean up
// its own timers/listeners. Screen transitions use a CSS fade/slide veil.
import { $, clear } from './dom.js';

const registry = new Map();
let current = null;
let currentName = null;
let switching = false;

export function register(name, scene) { registry.set(name, scene); }
export function activeScene() { return currentName; }

export async function go(name, params = {}) {
  if (switching) return;
  const next = registry.get(name);
  if (!next) throw new Error(`unknown scene: ${name}`);
  switching = true;

  const veil = $('#veil');
  veil.classList.add('on');
  await transitionEnd(veil, 260);

  try { current?.exit?.(); } catch (e) { console.error('scene exit', e); }
  const root = clear($('#app'));
  root.dataset.scene = name;
  current = next;
  currentName = name;
  await next.enter(root, params);

  veil.classList.remove('on');
  switching = false;
}

function transitionEnd(node, timeout) {
  return new Promise(res => {
    let done = false;
    const fin = () => { if (!done) { done = true; node.removeEventListener('transitionend', fin); res(); } };
    node.addEventListener('transitionend', fin);
    setTimeout(fin, timeout);
  });
}
