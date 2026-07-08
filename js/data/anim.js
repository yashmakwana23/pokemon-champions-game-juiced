// Move → animation choreography. The engine event stream only knows "a move
// was used"; this module decides HOW it looks. Every move resolves to an
// archetype (beam / orb / bolt / strike / slam / quake / buff / heal / hex /
// field / weather), derived from its category + type + target, with a small
// override table for signature moves so the iconic ones read exactly right.
//
// playMoveAnim() runs the DELIVERY animation (the attack leaving the user and
// reaching the target) and resolves when it lands; the battle scene handles the
// on-hit reaction (shake / flash / damage number) from the engine's hp event.
import { sleep } from '../engine/dom.js';
import { TYPE_COLORS } from './types.js';
import { beam, projectile, bolt, burst, ring, cone, slash, fountain, screenShake,
  flame, splash, sparks, leaves, shards, wisps, bubbles, sparkles, debris, energy, preloadFx } from '../engine/fx.js';
import { sfx } from '../engine/audio.js';

// Textured effect sprite (Showdown /fx/) used for each element's thrown orb.
const ORB_IMG = {
  Fire: 'fireball', Water: 'waterwisp', Electric: 'electroball', Grass: 'energyball',
  Ice: 'iceball', Ghost: 'shadowball', Poison: 'poisonwisp', Fairy: 'mistball',
  Rock: 'rock1', Ground: 'mudwisp', Dragon: 'energyball', Dark: 'blackwisp',
  Psychic: 'mistball', Steel: 'iceball', Normal: 'energyball', Flying: 'energyball',
  Fighting: 'energyball', Bug: 'energyball',
};
const orbImg = (type) => ORB_IMG[type] ?? 'energyball';

// Warm the effect-image cache so the first attack isn't a blank frame.
preloadFx(['flareball', 'fireball', 'waterwisp', 'electroball', 'leaf1', 'leaf2',
  'iceball', 'icicle', 'shadowball', 'blackwisp', 'poisonwisp', 'mistball',
  'rock1', 'rock2', 'mudwisp', 'energyball']);

// Element-flavoured impact — the key to variety: two Ghost moves and two Fire
// moves each read as their element, not just a recoloured burst.
export function elementImpact(type, pt, { big = false } = {}) {
  const c = TYPE_COLORS[type] ?? '#7df9ff';
  switch (type) {
    case 'Fire': return flame(pt.x, pt.y, { big });
    case 'Water': return splash(pt.x, pt.y, { big });
    case 'Electric': return sparks(pt.x, pt.y, { big });
    case 'Grass': return leaves(pt.x, pt.y, { big });
    case 'Ice': return shards(pt.x, pt.y, { big });
    case 'Ghost': return wisps(pt.x, pt.y, { big });
    case 'Poison': return bubbles(pt.x, pt.y, { big });
    case 'Fairy': return sparkles(pt.x, pt.y, { big });
    case 'Rock': case 'Ground': return debris(pt.x, pt.y, { big });
    default: return energy(pt.x, pt.y, { color: c, big });   // Dragon/Dark/Psychic/Steel/Fighting/Normal/Flying/Bug
  }
}

// Special-type families that read as a sustained stream/beam rather than a thrown orb.
const BEAM_TYPES = new Set(['Fire', 'Water', 'Ice']);

// Exact-name overrides — the moves whose look people expect to be specific.
const SIGNATURE = {
  // beams / streams
  'Surf': 'wave', 'Hydro Pump': 'beam', 'Scald': 'beam', 'Muddy Water': 'wave',
  'Flamethrower': 'beam', 'Fire Blast': 'beam', 'Heat Wave': 'wave', 'Overheat': 'beam',
  'Ice Beam': 'beam', 'Blizzard': 'wave', 'Freeze-Dry': 'beam',
  'Hyper Beam': 'beam', 'Giga Impact': 'strike', 'Solar Beam': 'beam',
  'Dragon Pulse': 'beam', 'Flash Cannon': 'beam', 'Signal Beam': 'beam',
  // bolts
  'Thunderbolt': 'bolt', 'Thunder': 'bolt', 'Volt Switch': 'bolt', 'Thunder Shock': 'bolt',
  'Wild Charge': 'strike', 'Zap Cannon': 'bolt',
  // thrown orbs
  'Shadow Ball': 'orb', 'Sludge Bomb': 'orb', 'Energy Ball': 'orb', 'Focus Blast': 'orb',
  'Dark Pulse': 'orb', 'Aura Sphere': 'orb', 'Moonblast': 'orb', 'Power Gem': 'orb',
  'Psychic': 'orb', 'Psyshock': 'orb', 'Sludge Wave': 'wave', 'Draco Meteor': 'meteor',
  // ground / rock (physical, non-contact)
  'Earthquake': 'quake', 'Bulldoze': 'quake', 'Magnitude': 'quake',
  'Rock Slide': 'slam', 'Stone Edge': 'slam', 'Rock Tomb': 'slam', 'Rock Blast': 'slam',
  // self buffs
  'Swords Dance': 'buff', 'Nasty Plot': 'buff', 'Calm Mind': 'buff', 'Bulk Up': 'buff',
  'Dragon Dance': 'buff', 'Iron Defense': 'buff', 'Agility': 'buff', 'Belly Drum': 'buff',
  'Shell Smash': 'buff', 'Quiver Dance': 'buff', 'Curse': 'buff',
  // heals
  'Recover': 'heal', 'Roost': 'heal', 'Soft-Boiled': 'heal', 'Synthesis': 'heal',
  'Moonlight': 'heal', 'Morning Sun': 'heal', 'Rest': 'heal', 'Wish': 'heal',
  // status vs foe
  'Toxic': 'hex', 'Will-O-Wisp': 'hex', 'Thunder Wave': 'hex', 'Spore': 'hex',
  'Sleep Powder': 'hex', 'Stun Spore': 'hex', 'Poison Powder': 'hex', 'Confuse Ray': 'hex',
  'Yawn': 'hex', 'Taunt': 'hex', 'Leech Seed': 'hex',
  // field
  'Stealth Rock': 'field', 'Spikes': 'field', 'Toxic Spikes': 'field', 'Sticky Web': 'field',
  'Reflect': 'screen', 'Light Screen': 'screen', 'Aurora Veil': 'screen', 'Protect': 'screen',
  // weather
  'Sunny Day': 'weather', 'Rain Dance': 'weather', 'Sandstorm': 'weather', 'Hail': 'weather', 'Snowscape': 'weather',
};

export function archetypeOf(move) {
  if (!move) return 'strike';
  if (SIGNATURE[move.name]) return SIGNATURE[move.name];
  const { cat, type, contact, target } = move;
  if (cat === 'status') {
    if (target === 'self') return 'buff';
    if (target === 'field' || target === 'allySide' || target === 'foeSide') return 'field';
    return 'hex';
  }
  if (cat === 'phys') return contact ? 'strike' : 'slam';
  // special
  if (type === 'Electric') return 'bolt';
  if (BEAM_TYPES.has(type)) return 'beam';
  return 'orb';
}

// True when the user should physically lunge into the target (CSS handles the lunge).
export function isMelee(move) {
  const a = archetypeOf(move);
  return a === 'strike';
}

export function tintOf(move) { return TYPE_COLORS[move?.type] ?? '#7df9ff'; }

// Run the delivery animation. geo = {from:{x,y}, to:{x,y}} in normalized coords.
export async function playMoveAnim(move, geo, { color } = {}) {
  const a = archetypeOf(move);
  const c = color ?? tintOf(move);
  const { from, to } = geo;
  switch (a) {
    case 'strike': {
      // CSS lunges the attacker; land a slash + element impact when it connects.
      await sleep(150); sfx.whoosh();
      slash(to.x, to.y, { color: '#fff' });
      elementImpact(move.type, to, { big: true });
      screenShake(6);
      await sleep(210);
      break;
    }
    case 'slam': {
      // heavy object crashing down onto the target
      sfx.whoosh();
      burst(to.x, to.y - 0.2, { count: 14, color: c, speed: 120, size: 6, grav: 900, shape: 'dot', spread: 0.8, dir: Math.PI / 2, life: 0.5 });
      await sleep(240);
      screenShake(8);
      elementImpact(move.type, to, { big: true });
      await sleep(160);
      break;
    }
    case 'quake': {
      sfx.rumble(); screenShake(12, 0.55);
      ring(to.x, to.y, { color: c, maxR: 0.28, dur: 0.5, width: 6 });
      ring(from.x, from.y, { color: c, maxR: 0.28, dur: 0.5, width: 6 });
      debris(to.x, 0.72, { big: true });
      debris(from.x, 0.72, { big: false });
      await sleep(420);
      break;
    }
    case 'beam': {
      sfx.beam();
      burst(from.x, from.y, { count: 8, color: c, speed: 120, size: 5, shape: 'glow', blend: 'add', life: 0.3 });
      await beam(from, to, { color: c, dur: 0.5, width: 13 });
      elementImpact(move.type, to, { big: true });
      break;
    }
    case 'wave': {
      // wide spray (Surf / Heat Wave / Blizzard)
      sfx.beam();
      cone(from, to, { count: 40, color: c, speed: 360, size: 6, spread: 0.75, life: 0.6 });
      await sleep(300);
      elementImpact(move.type, to, { big: true });
      await sleep(160);
      break;
    }
    case 'orb': {
      sfx.whoosh();
      burst(from.x, from.y, { count: 6, color: c, speed: 90, size: 5, shape: 'glow', blend: 'add', life: 0.25 });
      await projectile(from, to, { color: c, dur: 0.36, size: 14, img: orbImg(move.type) });
      sfx.impactPop();
      elementImpact(move.type, to, { big: false });
      break;
    }
    case 'meteor': {
      // several orbs raining onto the target
      sfx.beam();
      for (let i = 0; i < 4; i++) {
        const start = { x: to.x + (Math.random() - 0.5) * 0.4, y: -0.1 };
        projectile(start, { x: to.x + (Math.random() - 0.5) * 0.12, y: to.y }, { color: c, dur: 0.4, size: 12, img: orbImg(move.type) })
          .then(() => elementImpact(move.type, to, { big: false }));
        await sleep(120);
      }
      screenShake(8); await sleep(240);
      break;
    }
    case 'bolt': {
      sfx.zap();
      burst(from.x, from.y, { count: 6, color: c, speed: 120, size: 4, shape: 'spark', blend: 'add', life: 0.2 });
      // strike from above the target as well as a line from the user
      await bolt({ x: to.x, y: -0.05 }, to, { color: c, dur: 0.34, segments: 8, strikes: 3 });
      elementImpact(move.type, to, { big: true });
      break;
    }
    case 'buff': {
      sfx.buff();
      fountain(from.x, from.y, { color: c, count: 30, spin: true });
      ring(from.x, from.y, { color: c, maxR: 0.16, dur: 0.5, width: 5 });
      await sleep(520);
      break;
    }
    case 'heal': {
      sfx.heal();
      fountain(from.x, from.y, { color: '#3ddb97', count: 30 });
      ring(from.x, from.y, { color: '#3ddb97', maxR: 0.15, dur: 0.5, width: 5 });
      await sleep(520);
      break;
    }
    case 'hex': {
      sfx.status();
      await projectile(from, to, { color: c, dur: 0.4, size: 11, img: orbImg(move.type) });
      elementImpact(move.type, to, { big: false });
      await sleep(200);
      break;
    }
    case 'screen': {
      sfx.buff();
      ring(from.x, from.y, { color: c, maxR: 0.2, dur: 0.6, width: 8 });
      await sleep(400);
      break;
    }
    case 'field': {
      sfx.whoosh();
      burst(to.x, 0.72, { count: 16, color: c, speed: 120, size: 4, upBias: 0.4, grav: 500, spread: 1.2 });
      await sleep(360);
      break;
    }
    case 'weather': {
      sfx.buff();
      for (const x of [0.2, 0.4, 0.6, 0.8]) burst(x, 0.12, { count: 8, color: c, speed: 140, size: 4, shape: 'glow', blend: 'add', life: 0.5 });
      await sleep(420);
      break;
    }
    default: await sleep(200);
  }
}
