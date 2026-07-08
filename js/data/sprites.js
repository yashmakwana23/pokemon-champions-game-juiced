// Official artwork resolution. The GDD dex records each species' National Dex
// number; PokeAPI's sprite CDN is keyed by the same numbers, so real artwork
// loads when online. monToken keeps the type-orb + glyph as offline fallback.
import { SPECIES } from './species.js';
import { MEGAS } from './megas.js';

// 96px in-game pixel sprites (not the smooth official artwork) — rendered
// with image-rendering: pixelated for the retro look.
const CDN = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/';

// PokeAPI form ids for Mega artwork. Champions-new Megas (Dragonite, Greninja,
// Excadrill) have no official art — they fall back to the base species with
// the magenta mega ring from CSS.
const MEGA_IDS = {
  'Mega Venusaur': 10033, 'Mega Charizard X': 10034, 'Mega Charizard Y': 10035,
  'Mega Blastoise': 10036, 'Mega Alakazam': 10037, 'Mega Gengar': 10038,
  'Mega Kangaskhan': 10039, 'Mega Gyarados': 10041, 'Mega Aerodactyl': 10042,
  'Mega Scizor': 10046, 'Mega Heracross': 10047, 'Mega Houndoom': 10048,
  'Mega Tyranitar': 10049, 'Mega Blaziken': 10050, 'Mega Gardevoir': 10051,
  'Mega Mawile': 10052, 'Mega Manectric': 10055, 'Mega Absol': 10057,
  'Mega Garchomp': 10058, 'Mega Lucario': 10059, 'Mega Swampert': 10064,
  'Mega Metagross': 10076,
};

// Regional-form artwork ids (the dex number points at the base form).
const FORM_IDS = { 'Alolan Ninetales': 10104 };

export function spriteUrl(speciesName, { form = null } = {}) {
  if (form && MEGA_IDS[form]) return `${CDN}${MEGA_IDS[form]}.png`;
  if (form && MEGAS[form]) return spriteUrl(MEGAS[form].base); // Champions-new mega → base art
  if (FORM_IDS[speciesName]) return `${CDN}${FORM_IDS[speciesName]}.png`;
  const dex = SPECIES[speciesName]?.dex;
  return dex ? `${CDN}${dex}.png` : null;
}

// Gen-5 (Black/White) animated sprites — the mon visibly breathes/idles with no
// animation code of our own. Only National Dex ≤ 649 has these frames, and
// Mega/regional forms don't, so those callers fall back to the static art via
// the monToken source chain. `back` gives the over-the-shoulder view for the
// player's own Pokémon.
const ANIM = `${CDN}versions/generation-v/black-white/animated/`;
export function animatedUrl(speciesName, { form = null, back = false } = {}) {
  if (form) return null; // no animated frames for Megas / regional forms
  const dex = SPECIES[speciesName]?.dex;
  if (!dex || dex > 649) return null;
  return `${ANIM}${back ? 'back/' : ''}${dex}.gif`;
}

// Pokémon Showdown animated-sprite CDN — a proper CDN (no GitHub-raw rate
// limits), covers every gen incl. Megas, and serves back sprites. Keyed by a
// lowercase alphanumeric "showdown id" rather than dex number.
const SHOWDOWN = 'https://play.pokemonshowdown.com/sprites/';
export function showdownId(name) {
  return String(name).toLowerCase()
    .replace(/[.'’:]/g, '')
    .replace(/\s+/g, '')
    .replace(/♀/g, 'f').replace(/♂/g, 'm');
}
// style: 'ani' (Gen-5 BW animated) or 'xyani' (X/Y animated, wider coverage).
export function showdownUrl(name, { back = false, style = 'ani' } = {}) {
  const dir = back ? `${style}-back` : style;
  return `${SHOWDOWN}${dir}/${showdownId(name)}.gif`;
}

// Scenic battle backgrounds (real pixel-art scenes, same CDN). e.g. 'meadow',
// 'beach', 'forest', 'city', 'desert', 'earthycave', 'icecave', 'mountain'.
// Only full-scene backgrounds. (The gen3/gen4 bgs are structured DS battle
// backdrops with baked-in bases + side bars, so they look broken stretched.)
export const BATTLE_SCENES = [
  'meadow', 'forest', 'beach', 'beachshore', 'deepsea', 'city',
  'desert', 'mountain', 'earthycave', 'icecave', 'dampcave',
];
export function showdownBg(scene = 'meadow') {
  return `${SHOWDOWN.replace('sprites/', '')}fx/bg-${scene}.png`;
}
