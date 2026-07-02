// 18-type chart (Gen 6+ canonical, as used by Champions). CHART[atk][def] =
// multiplier; missing entries are 1. Champions labels the derived tiers:
// 4x "Extremely effective" ★, 2x "Super effective", 0.5x "Not very effective",
// 0.25x "Mostly ineffective" ▽, 0x "Has no effect".
export const TYPES = [
  'Normal','Fire','Water','Electric','Grass','Ice','Fighting','Poison','Ground',
  'Flying','Psychic','Bug','Rock','Ghost','Dragon','Dark','Steel','Fairy',
];

export const CHART = {
  Normal:   { Rock:.5, Ghost:0, Steel:.5 },
  Fire:     { Fire:.5, Water:.5, Grass:2, Ice:2, Bug:2, Rock:.5, Dragon:.5, Steel:2 },
  Water:    { Fire:2, Water:.5, Grass:.5, Ground:2, Rock:2, Dragon:.5 },
  Electric: { Water:2, Electric:.5, Grass:.5, Ground:0, Flying:2, Dragon:.5 },
  Grass:    { Fire:.5, Water:2, Grass:.5, Poison:.5, Ground:2, Flying:.5, Bug:.5, Rock:2, Dragon:.5, Steel:.5 },
  Ice:      { Fire:.5, Water:.5, Grass:2, Ice:.5, Ground:2, Flying:2, Dragon:2, Steel:.5 },
  Fighting: { Normal:2, Ice:2, Poison:.5, Flying:.5, Psychic:.5, Bug:.5, Rock:2, Ghost:0, Dark:2, Steel:2, Fairy:.5 },
  Poison:   { Grass:2, Poison:.5, Ground:.5, Rock:.5, Ghost:.5, Steel:0, Fairy:2 },
  Ground:   { Fire:2, Electric:2, Grass:.5, Poison:2, Flying:0, Bug:.5, Rock:2, Steel:2 },
  Flying:   { Electric:.5, Grass:2, Fighting:2, Bug:2, Rock:.5, Steel:.5 },
  Psychic:  { Fighting:2, Poison:2, Psychic:.5, Dark:0, Steel:.5 },
  Bug:      { Fire:.5, Grass:2, Fighting:.5, Poison:.5, Flying:.5, Psychic:2, Ghost:.5, Dark:2, Steel:.5, Fairy:.5 },
  Rock:     { Fire:2, Ice:2, Fighting:.5, Ground:.5, Flying:2, Bug:2, Steel:.5 },
  Ghost:    { Normal:0, Psychic:2, Ghost:2, Dark:.5 },
  Dragon:   { Dragon:2, Steel:.5, Fairy:0 },
  Dark:     { Fighting:.5, Psychic:2, Ghost:2, Dark:.5, Fairy:.5 },
  Steel:    { Fire:.5, Water:.5, Electric:.5, Ice:2, Rock:2, Steel:.5, Fairy:2 },
  Fairy:    { Fire:.5, Fighting:2, Poison:.5, Dragon:2, Dark:2, Steel:.5 },
};

export const TYPE_COLORS = {
  Normal:'#A8A77A', Fire:'#EE8130', Water:'#6390F0', Electric:'#F7D02C',
  Grass:'#7AC74C', Ice:'#96D9D6', Fighting:'#C22E28', Poison:'#A33EA1',
  Ground:'#E2BF65', Flying:'#A98FF3', Psychic:'#F95587', Bug:'#A6B91A',
  Rock:'#B6A136', Ghost:'#735797', Dragon:'#6F35FC', Dark:'#705746',
  Steel:'#B7B7CE', Fairy:'#D685AD',
};

// eff(moveType, defenderTypes, {superVsWater}) -> multiplier
export function eff(moveType, defTypes, flags = {}) {
  let m = 1;
  for (const t of defTypes) {
    if (flags.superVsWater && t === 'Water') { m *= 2; continue; } // Freeze-Dry
    m *= CHART[moveType]?.[t] ?? 1;
  }
  return m;
}

// Champions' transparency labels, shown on move buttons BEFORE committing.
export function effLabel(mult) {
  if (mult === 0)  return { txt: 'Has no effect',        icon: '✕', cls: 'eff-none' };
  if (mult >= 4)   return { txt: 'Extremely effective',  icon: '★', cls: 'eff-4x' };
  if (mult >= 2)   return { txt: 'Super effective',      icon: '▲', cls: 'eff-2x' };
  if (mult > 0.26 && mult < 1) return { txt: 'Not very effective', icon: '△', cls: 'eff-half' };
  if (mult <= 0.26) return { txt: 'Mostly ineffective',  icon: '▽', cls: 'eff-quarter' };
  return { txt: 'Effective', icon: '', cls: 'eff-1x' };
}
