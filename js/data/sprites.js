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
