// 25 Natures ("Stat Alignments" in Champions): one stat x1.1, another x0.9.
// Neutral natures multiply nothing.
export const NATURES = {
  Hardy:   { up: null,  down: null },
  Docile:  { up: null,  down: null },
  Serious: { up: null,  down: null },
  Bashful: { up: null,  down: null },
  Quirky:  { up: null,  down: null },
  Lonely:  { up: 'atk', down: 'def' },
  Brave:   { up: 'atk', down: 'spe' },
  Adamant: { up: 'atk', down: 'spa' },
  Naughty: { up: 'atk', down: 'spd' },
  Bold:    { up: 'def', down: 'atk' },
  Relaxed: { up: 'def', down: 'spe' },
  Impish:  { up: 'def', down: 'spa' },
  Lax:     { up: 'def', down: 'spd' },
  Timid:   { up: 'spe', down: 'atk' },
  Hasty:   { up: 'spe', down: 'def' },
  Jolly:   { up: 'spe', down: 'spa' },
  Naive:   { up: 'spe', down: 'spd' },
  Modest:  { up: 'spa', down: 'atk' },
  Mild:    { up: 'spa', down: 'def' },
  Quiet:   { up: 'spa', down: 'spe' },
  Rash:    { up: 'spa', down: 'spd' },
  Calm:    { up: 'spd', down: 'atk' },
  Gentle:  { up: 'spd', down: 'def' },
  Sassy:   { up: 'spd', down: 'spe' },
  Careful: { up: 'spd', down: 'spa' },
};

export const NATURE_NAMES = Object.keys(NATURES);
