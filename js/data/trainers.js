// NPC cast (from the GDD's FTUE chapter), scripted tutorial opponents, starter
// bundles, AI opponent name pool, and Rotie's in-battle hint lines.

export const NPCS = {
  tatora: { name: 'Tatora', role: 'Lobby receptionist', glyph: '💁' },
  cordy:  { name: 'Cordy',  role: 'Veteran Gym Leader', glyph: '🧑‍🏫' },
  rotie:  { name: 'Rotie',  role: 'Rotom in your headset', glyph: '🤖' },
  kitt:   { name: 'Kitt',   role: 'Roster Ranch rancher', glyph: '🤠' },
  emma:   { name: 'Emma',   role: 'Placement match rival', glyph: '🧢' },
};

// Cordy's Battle Tutorial team — exactly the three the GDD records.
export const CORDY_TEAM = [
  { species: 'Venusaur',  item: 'Sitrus Berry' },
  { species: 'Blastoise', item: 'Leftovers' },
  { species: 'Heracross', item: 'Focus Sash' },
];

export const EMMA_TEAM = [
  { species: 'Pikachu',   item: 'Focus Sash' },
  { species: 'Sylveon',   item: 'Leftovers' },
  { species: 'Corviknight', item: 'Rocky Helmet' },
];

// FTUE: choose one starter bundle — a lead plus five companions (GDD: "choose
// 1 of N starters and automatically receive companions to form a team of 6").
export const STARTER_BUNDLES = [
  {
    id: 'blaze', name: 'Blaze Pack', lead: 'Charizard',
    team: ['Charizard', 'Pikachu', 'Garchomp', 'Azumarill', 'Gengar', 'Corviknight'],
    blurb: 'Aggressive special attackers backed by a bulky steel bird.',
  },
  {
    id: 'tide', name: 'Tide Pack', lead: 'Blastoise',
    team: ['Blastoise', 'Dragapult', 'Lucario', 'Sylveon', 'Torkoal', 'Tyranitar'],
    blurb: 'Setup sweepers and weather tricks for patient tacticians.',
  },
  {
    id: 'verdant', name: 'Verdant Pack', lead: 'Venusaur',
    team: ['Venusaur', 'Incineroar', 'Swampert', 'Metagross', 'Pelipper', 'Weavile'],
    blurb: 'A balanced core with pivots, hazards and priority.',
  },
];

// AI opponent identities. archetype drives teamgen: which species pools and
// held items the generated team leans toward.
export const OPPONENTS = [
  { name: 'Riku',    title: 'Stadium Regular',   archetype: 'balance' },
  { name: 'Mabel',   title: 'Ranch Hand',        archetype: 'balance' },
  { name: 'Dario',   title: 'Speed Demon',       archetype: 'offense' },
  { name: 'Wren',    title: 'Storm Chaser',      archetype: 'rain' },
  { name: 'Sol',     title: 'Sun Priest',        archetype: 'sun' },
  { name: 'Greta',   title: 'Dune Strategist',   archetype: 'sand' },
  { name: 'Ivo',     title: 'Time Bender',       archetype: 'trickroom' },
  { name: 'Nadia',   title: 'Wall Architect',    archetype: 'stall' },
  { name: 'Kofi',    title: 'Mega Enthusiast',   archetype: 'offense' },
  { name: 'Perla',   title: 'Frontier Veteran',  archetype: 'balance' },
  { name: 'Basil',   title: 'Hazard Setter',     archetype: 'stall' },
  { name: 'Yuna',    title: 'Prodigy',           archetype: 'offense' },
  { name: 'Otto',    title: 'Gym Manager',       archetype: 'balance' },
  { name: 'Sable',   title: 'Night Owl',         archetype: 'offense' },
  { name: 'Marina',  title: 'Tidecaller',        archetype: 'rain' },
  { name: 'Flint',   title: 'Ember Baron',       archetype: 'sun' },
];

export const ARCHETYPE_POOLS = {
  balance:   ['Garchomp','Metagross','Incineroar','Sylveon','Corviknight','Toxapex','Gyarados','Mimikyu','Snorlax','Gardevoir','Swampert','Mawile'],
  offense:   ['Dragapult','Weavile','Blaziken','Gengar','Greninja','Hydreigon','Volcarona','Kingambit','Lucario','Aerodactyl','Absol','Alakazam'],
  rain:      ['Pelipper','Greninja','Swampert','Gyarados','Azumarill','Scizor','Hydreigon','Dragonite','Toxapex','Manectric'],
  sun:       ['Torkoal','Charizard','Venusaur','Houndoom','Volcarona','Blaziken','Gardevoir','Heracross','Sylveon','Aerodactyl'],
  sand:      ['Tyranitar','Excadrill','Garchomp','Aerodactyl','Corviknight','Toxapex','Mawile','Hydreigon','Kingambit','Snorlax'],
  trickroom: ['Snorlax','Mawile','Metagross','Torkoal','Gholdengo','Sylveon','Azumarill','Gardevoir','Toxapex','Kangaskhan'],
  stall:     ['Toxapex','Corviknight','Snorlax','Sylveon','Gholdengo','Venusaur','Mawile','Alolan Ninetales','Swampert','Metagross'],
};

// Rotie pops up with type hints and reminders (GDD: "your in-battle assistant").
export const ROTIE_TIPS = {
  superEffective: [
    'Bzzt! That move hits {mult}× — the type matchup favors you!',
    'Zzzap — {move} is {label} against {target}. Go for it!',
  ],
  resisted: [
    'Careful! {target} resists {move} — maybe there’s a better pick?',
    'Bzzt… that one only deals {mult}× damage. Check your other moves!',
  ],
  immune: [
    '{target} is completely immune to {move}! Pick something else!',
  ],
  lowHp: [
    'Your partner is under 25% HP! Switching out could save it.',
    'Danger zone! A Sitrus Berry or a switch might keep you alive.',
  ],
  megaReady: [
    'Your Mega Stone is reacting to your Omni Ring! You can Mega Evolve this turn!',
  ],
  statusHint: [
    'Status moves can swing a battle — burns halve physical damage!',
  ],
  hazardHint: [
    'Watch out — hazards on your side damage every Pokémon you send in.',
  ],
};

export const DIALOGUE = {
  intro: [
    { who: 'tatora', text: 'Welcome home, Champion! This is Frontier City — the stage where the world’s best trainers settle it in the arena.' },
    { who: 'tatora', text: 'You’re registered as a Gym Manager. Your gym, your roster, your climb up the ranked ladder.' },
    { who: 'tatora', text: 'No wild grass, no badges, no breeding grinds here. Every Pokémon arrives at level 50, tournament-ready.' },
    { who: 'cordy',  text: 'I’m Cordy — I run the Battle Tutorials. Pick your starter pack and let’s see what you’ve got!' },
  ],
  preTutorial: [
    { who: 'cordy', text: 'Rules are simple: bring six, pick three at team preview. Faster Pokémon act first, priority moves jump the queue.' },
    { who: 'cordy', text: 'The move buttons tell you how effective each attack will be BEFORE you commit. Use that.' },
    { who: 'rotie', text: 'Bzzt! I’m Rotie — I live in your headset. I’ll chime in with hints during battle!' },
  ],
  postTutorial: [
    { who: 'cordy', text: 'Well fought! Here’s your tutorial reward: 10,000 VP and the Omni Ring.' },
    { who: 'cordy', text: 'The Omni Ring lets any Pokémon holding its Mega Stone unleash Mega Evolution — once per battle, so time it well.' },
    { who: 'kitt',  text: 'Howdy! Kitt here, from the Roster Ranch. Come see me when you want new teammates — first scout’s on the house.' },
  ],
  preEmma: [
    { who: 'emma', text: 'You’re the new Gym Manager? I’m Emma. Beat me and they’ll bump you straight into Poké Ball Tier.' },
  ],
  postEmma: [
    { who: 'emma',   text: 'Not bad at all. See you on the ladder!' },
    { who: 'tatora', text: 'Placement complete — welcome to Poké Ball Tier! Ranked, the Ranch, Training and the Frontier Shop are all open now.' },
  ],
};
