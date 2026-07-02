// Curated move overlay for Pokémon Champions recreation.
// The GDD's dex_db.json provides Power/PP/Accuracy/effect text, but the scrape
// lost Type and Category (they were image icons on the source wiki). Those are
// canonical franchise data, filled here and cross-checked by a verification pass.
// Effects use a small DSL consumed by systems/battle-core.js.
//
// Effect kinds:
//  stage {who:'self'|'target', stat, delta, chance}   status {status, chance}
//  flinch {chance}   confuse {chance}   heal {pct of max}   drain {pct of dmg}
//  recoil {pct of dmg}   recoilMax {pct of max HP}   multihit {min,max}
//  pivot   protect   rest   yawn   taunt   leechseed   bellydrum   knockoff
//  suckerpunch   firstTurnOnly   hazard {hazard}   clearHazards   screen {screen}
//  weather {w}   field {f}
// Flags: rainPerfect, snowPerfect, superVsWater (Freeze-Dry), neverMiss,
//  defCategory:'def' (Psyshock), offenseStat:'def' (Body Press), pulse, punch,
//  sound, requiresSnow (Aurora Veil), chargeSolar, hexBoost, breaksScreens

export const MOVES = {
  // ---------- Normal ----------
  'Quick Attack':  { type:'Normal', cat:'phys', power:40, acc:100, pp:24, priority:1, contact:true },
  'Extreme Speed': { type:'Normal', cat:'phys', power:80, acc:100, pp:8,  priority:2, contact:true },
  'Fake Out':      { type:'Normal', cat:'phys', power:40, acc:100, pp:12, priority:3, contact:true, firstTurnOnly:true, effects:[{kind:'flinch', chance:100}] },
  'Body Slam':     { type:'Normal', cat:'phys', power:85, acc:100, pp:16, contact:true, effects:[{kind:'status', status:'par', chance:30}] },
  'Double-Edge':   { type:'Normal', cat:'phys', power:120, acc:100, pp:16, contact:true, effects:[{kind:'recoil', pct:33}] },
  'Hyper Voice':   { type:'Normal', cat:'spec', power:90, acc:100, pp:12, sound:true },
  'Swords Dance':  { type:'Normal', cat:'status', pp:16, target:'self', effects:[{kind:'stage', who:'self', stat:'atk', delta:2}] },
  'Belly Drum':    { type:'Normal', cat:'status', pp:8, target:'self', effects:[{kind:'bellydrum'}] },
  'Protect':       { type:'Normal', cat:'status', pp:8, priority:4, target:'self', effects:[{kind:'protect'}] },
  'Recover':       { type:'Normal', cat:'status', pp:8, target:'self', effects:[{kind:'heal', pct:50}] },
  'Slack Off':     { type:'Normal', cat:'status', pp:8, target:'self', effects:[{kind:'heal', pct:50}] },
  'Yawn':          { type:'Normal', cat:'status', pp:8, effects:[{kind:'yawn'}] },
  'Rapid Spin':    { type:'Normal', cat:'phys', power:50, acc:100, pp:24, contact:true, override:{ power:50 }, effects:[{kind:'clearHazards'},{kind:'stage', who:'self', stat:'spe', delta:1}] },
  'Shell Smash':   { type:'Normal', cat:'status', pp:16, target:'self', effects:[
    {kind:'stage', who:'self', stat:'def', delta:-1},{kind:'stage', who:'self', stat:'spd', delta:-1},
    {kind:'stage', who:'self', stat:'atk', delta:2},{kind:'stage', who:'self', stat:'spa', delta:2},{kind:'stage', who:'self', stat:'spe', delta:2}] },
  'Rest':          { type:'Psychic', cat:'status', pp:8, target:'self', effects:[{kind:'rest'}] },

  // ---------- Fire ----------
  'Flamethrower':  { type:'Fire', cat:'spec', power:90, acc:100, pp:16, effects:[{kind:'status', status:'brn', chance:10}] },
  'Fire Blast':    { type:'Fire', cat:'spec', power:110, acc:85, pp:8, effects:[{kind:'status', status:'brn', chance:10}] },
  'Heat Wave':     { type:'Fire', cat:'spec', power:95, acc:90, pp:8, effects:[{kind:'status', status:'brn', chance:10}] },
  'Flare Blitz':   { type:'Fire', cat:'phys', power:120, acc:100, pp:16, contact:true, effects:[{kind:'recoil', pct:33},{kind:'status', status:'brn', chance:10}] },
  'Fire Punch':    { type:'Fire', cat:'phys', power:75, acc:100, pp:16, contact:true, punch:true, effects:[{kind:'status', status:'brn', chance:10}] },
  'Overheat':      { type:'Fire', cat:'spec', power:130, acc:90, pp:8, effects:[{kind:'stage', who:'self', stat:'spa', delta:-2}] },
  'Fiery Dance':   { type:'Fire', cat:'spec', power:80, acc:100, pp:8, effects:[{kind:'stage', who:'self', stat:'spa', delta:1, chance:50}] },
  'Will-O-Wisp':   { type:'Fire', cat:'status', pp:16, acc:85, effects:[{kind:'status', status:'brn', chance:100}] },
  'Sunny Day':     { type:'Fire', cat:'status', pp:8, target:'field', effects:[{kind:'weather', w:'sun'}] },

  // ---------- Water ----------
  'Hydro Pump':    { type:'Water', cat:'spec', power:110, acc:80, pp:8 },
  'Surf':          { type:'Water', cat:'spec', power:90, acc:100, pp:16 },
  'Scald':         { type:'Water', cat:'spec', power:80, acc:100, pp:16, effects:[{kind:'status', status:'brn', chance:30}] },
  'Liquidation':   { type:'Water', cat:'phys', power:85, acc:100, pp:16, contact:true, effects:[{kind:'stage', who:'target', stat:'def', delta:-1, chance:20}] },
  'Waterfall':     { type:'Water', cat:'phys', power:80, acc:100, pp:16, contact:true, effects:[{kind:'flinch', chance:20}] },
  'Aqua Jet':      { type:'Water', cat:'phys', power:40, acc:100, pp:20, priority:1, contact:true },
  'Water Shuriken':{ type:'Water', cat:'spec', power:15, acc:100, pp:20, priority:1, effects:[{kind:'multihit', min:2, max:5}] },
  'Rain Dance':    { type:'Water', cat:'status', pp:8, target:'field', effects:[{kind:'weather', w:'rain'}] },

  // ---------- Electric ----------
  'Thunderbolt':   { type:'Electric', cat:'spec', power:90, acc:100, pp:16, effects:[{kind:'status', status:'par', chance:10}] },
  'Thunder':       { type:'Electric', cat:'spec', power:110, acc:70, pp:8, rainPerfect:true, effects:[{kind:'status', status:'par', chance:30}] },
  'Volt Switch':   { type:'Electric', cat:'spec', power:70, acc:100, pp:20, effects:[{kind:'pivot'}] },
  'Wild Charge':   { type:'Electric', cat:'phys', power:90, acc:100, pp:16, contact:true, effects:[{kind:'recoil', pct:25}] },
  'Volt Tackle':   { type:'Electric', cat:'phys', power:120, acc:100, pp:16, contact:true, effects:[{kind:'recoil', pct:33},{kind:'status', status:'par', chance:10}] },
  'Thunder Punch': { type:'Electric', cat:'phys', power:75, acc:100, pp:16, contact:true, punch:true, effects:[{kind:'status', status:'par', chance:10}] },
  'Nuzzle':        { type:'Electric', cat:'phys', power:20, acc:100, pp:20, contact:true, effects:[{kind:'status', status:'par', chance:100}] },
  'Thunder Wave':  { type:'Electric', cat:'status', pp:20, acc:90, effects:[{kind:'status', status:'par', chance:100}] },

  // ---------- Grass ----------
  'Energy Ball':   { type:'Grass', cat:'spec', power:90, acc:100, pp:12, effects:[{kind:'stage', who:'target', stat:'spd', delta:-1, chance:10}] },
  'Giga Drain':    { type:'Grass', cat:'spec', power:75, acc:100, pp:12, effects:[{kind:'drain', pct:50}] },
  'Leaf Storm':    { type:'Grass', cat:'spec', power:130, acc:90, pp:8, effects:[{kind:'stage', who:'self', stat:'spa', delta:-2}] },
  'Power Whip':    { type:'Grass', cat:'phys', power:120, acc:85, pp:12, contact:true },
  'Wood Hammer':   { type:'Grass', cat:'phys', power:120, acc:100, pp:16, contact:true, effects:[{kind:'recoil', pct:33}] },
  'Solar Beam':    { type:'Grass', cat:'spec', power:120, acc:100, pp:12, chargeSolar:true },
  'Leech Seed':    { type:'Grass', cat:'status', pp:12, acc:90, effects:[{kind:'leechseed'}] },
  'Sleep Powder':  { type:'Grass', cat:'status', pp:16, acc:75, effects:[{kind:'status', status:'slp', chance:100}] },

  // ---------- Ice ----------
  'Ice Beam':      { type:'Ice', cat:'spec', power:90, acc:100, pp:12, effects:[{kind:'status', status:'frz', chance:10}] },
  'Blizzard':      { type:'Ice', cat:'spec', power:110, acc:70, pp:8, snowPerfect:true, effects:[{kind:'status', status:'frz', chance:10}] },
  'Freeze-Dry':    { type:'Ice', cat:'spec', power:70, acc:100, pp:16, superVsWater:true, effects:[{kind:'status', status:'frz', chance:10}] },
  'Ice Shard':     { type:'Ice', cat:'phys', power:40, acc:100, pp:24, priority:1 },
  'Icicle Crash':  { type:'Ice', cat:'phys', power:85, acc:90, pp:12, effects:[{kind:'flinch', chance:30}] },
  'Ice Punch':     { type:'Ice', cat:'phys', power:75, acc:100, pp:16, contact:true, punch:true, effects:[{kind:'status', status:'frz', chance:10}] },
  'Icy Wind':      { type:'Ice', cat:'spec', power:55, acc:95, pp:16, effects:[{kind:'stage', who:'target', stat:'spe', delta:-1, chance:100}] },
  'Aurora Veil':   { type:'Ice', cat:'status', pp:20, target:'allySide', requiresSnow:true, effects:[{kind:'screen', screen:'auroraveil'}] },

  // ---------- Fighting ----------
  'Close Combat':  { type:'Fighting', cat:'phys', power:120, acc:100, pp:8, contact:true, effects:[{kind:'stage', who:'self', stat:'def', delta:-1},{kind:'stage', who:'self', stat:'spd', delta:-1}] },
  'Drain Punch':   { type:'Fighting', cat:'phys', power:75, acc:100, pp:12, contact:true, punch:true, effects:[{kind:'drain', pct:50}] },
  'Aura Sphere':   { type:'Fighting', cat:'spec', power:80, acc:null, pp:20, pulse:true, neverMiss:true },
  'Focus Blast':   { type:'Fighting', cat:'spec', power:120, acc:70, pp:8, effects:[{kind:'stage', who:'target', stat:'spd', delta:-1, chance:10}] },
  'Brick Break':   { type:'Fighting', cat:'phys', power:75, acc:100, pp:16, contact:true, breaksScreens:true },
  'Body Press':    { type:'Fighting', cat:'phys', power:80, acc:100, pp:12, contact:true, offenseStat:'def' },
  'Bulk Up':       { type:'Fighting', cat:'status', pp:20, target:'self', effects:[{kind:'stage', who:'self', stat:'atk', delta:1},{kind:'stage', who:'self', stat:'def', delta:1}] },

  // ---------- Poison ----------
  'Sludge Bomb':   { type:'Poison', cat:'spec', power:90, acc:100, pp:12, effects:[{kind:'status', status:'psn', chance:30}] },
  'Poison Jab':    { type:'Poison', cat:'phys', power:80, acc:100, pp:20, contact:true, effects:[{kind:'status', status:'psn', chance:30}] },
  'Gunk Shot':     { type:'Poison', cat:'phys', power:120, acc:80, pp:8, effects:[{kind:'status', status:'psn', chance:30}] },
  'Toxic':         { type:'Poison', cat:'status', pp:12, acc:90, effects:[{kind:'status', status:'tox', chance:100}] },
  'Toxic Spikes':  { type:'Poison', cat:'status', pp:20, target:'foeSide', effects:[{kind:'hazard', hazard:'tspikes'}] },

  // ---------- Ground ----------
  'Earthquake':    { type:'Ground', cat:'phys', power:100, acc:100, pp:12 },
  'Earth Power':   { type:'Ground', cat:'spec', power:90, acc:100, pp:12, effects:[{kind:'stage', who:'target', stat:'spd', delta:-1, chance:10}] },

  // ---------- Flying ----------
  'Brave Bird':    { type:'Flying', cat:'phys', power:120, acc:100, pp:16, contact:true, effects:[{kind:'recoil', pct:33}] },
  'Hurricane':     { type:'Flying', cat:'spec', power:110, acc:70, pp:12, rainPerfect:true, effects:[{kind:'confuse', chance:30}] },
  'Air Slash':     { type:'Flying', cat:'spec', power:75, acc:95, pp:16, effects:[{kind:'flinch', chance:30}] },
  'Dual Wingbeat': { type:'Flying', cat:'phys', power:40, acc:90, pp:12, contact:true, effects:[{kind:'multihit', min:2, max:2}] },
  'Roost':         { type:'Flying', cat:'status', pp:8, target:'self', effects:[{kind:'heal', pct:50}] },
  'Tailwind':      { type:'Flying', cat:'status', pp:12, target:'allySide', effects:[{kind:'field', f:'tailwind'}] },

  // ---------- Psychic ----------
  'Psychic':       { type:'Psychic', cat:'spec', power:90, acc:100, pp:12, effects:[{kind:'stage', who:'target', stat:'spd', delta:-1, chance:10}] },
  'Psyshock':      { type:'Psychic', cat:'spec', power:80, acc:100, pp:12, defCategory:'def' },
  'Zen Headbutt':  { type:'Psychic', cat:'phys', power:80, acc:90, pp:16, contact:true, effects:[{kind:'flinch', chance:20}] },
  'Calm Mind':     { type:'Psychic', cat:'status', pp:20, target:'self', effects:[{kind:'stage', who:'self', stat:'spa', delta:1},{kind:'stage', who:'self', stat:'spd', delta:1}] },
  'Trick Room':    { type:'Psychic', cat:'status', pp:8, priority:-7, target:'field', effects:[{kind:'field', f:'trickroom'}] },
  'Hypnosis':      { type:'Psychic', cat:'status', pp:20, acc:60, effects:[{kind:'status', status:'slp', chance:100}] },

  // ---------- Ghost ----------
  'Shadow Ball':   { type:'Ghost', cat:'spec', power:80, acc:100, pp:16, effects:[{kind:'stage', who:'target', stat:'spd', delta:-1, chance:20}] },
  'Shadow Claw':   { type:'Ghost', cat:'phys', power:70, acc:100, pp:16, contact:true },
  'Shadow Sneak':  { type:'Ghost', cat:'phys', power:40, acc:100, pp:24, priority:1, contact:true },
  'Hex':           { type:'Ghost', cat:'spec', power:65, acc:100, pp:12, hexBoost:true },

  // ---------- Bug ----------
  'Bug Buzz':      { type:'Bug', cat:'spec', power:90, acc:100, pp:12, sound:true, effects:[{kind:'stage', who:'target', stat:'spd', delta:-1, chance:10}] },
  'Megahorn':      { type:'Bug', cat:'phys', power:120, acc:85, pp:12, contact:true },
  'X-Scissor':     { type:'Bug', cat:'phys', power:80, acc:100, pp:16, contact:true },
  'U-turn':        { type:'Bug', cat:'phys', power:70, acc:100, pp:20, contact:true, effects:[{kind:'pivot'}] },
  'Quiver Dance':  { type:'Bug', cat:'status', pp:20, target:'self', effects:[{kind:'stage', who:'self', stat:'spa', delta:1},{kind:'stage', who:'self', stat:'spd', delta:1},{kind:'stage', who:'self', stat:'spe', delta:1}] },

  // ---------- Rock ----------
  'Stone Edge':    { type:'Rock', cat:'phys', power:100, acc:80, pp:8 },
  'Rock Slide':    { type:'Rock', cat:'phys', power:75, acc:90, pp:12, effects:[{kind:'flinch', chance:30}] },
  'Rock Tomb':     { type:'Rock', cat:'phys', power:60, acc:95, pp:16, effects:[{kind:'stage', who:'target', stat:'spe', delta:-1, chance:100}] },
  'Stealth Rock':  { type:'Rock', cat:'status', pp:20, target:'foeSide', effects:[{kind:'hazard', hazard:'rocks'}] },

  // ---------- Steel ----------
  'Iron Head':     { type:'Steel', cat:'phys', power:80, acc:100, pp:16, contact:true, override:{ desc:'Has a 30% chance of making the target flinch.' }, effects:[{kind:'flinch', chance:30}] },
  'Bullet Punch':  { type:'Steel', cat:'phys', power:40, acc:100, pp:24, priority:1, contact:true, punch:true },
  'Meteor Mash':   { type:'Steel', cat:'phys', power:90, acc:90, pp:12, contact:true, punch:true, effects:[{kind:'stage', who:'self', stat:'atk', delta:1, chance:20}] },
  'Flash Cannon':  { type:'Steel', cat:'spec', power:80, acc:100, pp:12, effects:[{kind:'stage', who:'target', stat:'spd', delta:-1, chance:10}] },
  'Steel Beam':    { type:'Steel', cat:'spec', power:140, acc:95, pp:8, effects:[{kind:'recoilMax', pct:50}] },
  'Make It Rain':  { type:'Steel', cat:'spec', power:120, acc:100, pp:8, override:{ desc:'Lowers the user’s Sp. Atk stat by 1 stage after use.' }, effects:[{kind:'stage', who:'self', stat:'spa', delta:-1}] },
  'Iron Defense':  { type:'Steel', cat:'status', pp:16, target:'self', effects:[{kind:'stage', who:'self', stat:'def', delta:2}] },

  // ---------- Dragon ----------
  'Dragon Claw':   { type:'Dragon', cat:'phys', power:80, acc:100, pp:16, contact:true },
  'Dragon Darts':  { type:'Dragon', cat:'phys', power:50, acc:100, pp:12, effects:[{kind:'multihit', min:2, max:2}] },
  'Draco Meteor':  { type:'Dragon', cat:'spec', power:130, acc:90, pp:8, effects:[{kind:'stage', who:'self', stat:'spa', delta:-2}] },
  'Dragon Pulse':  { type:'Dragon', cat:'spec', power:85, acc:100, pp:12, pulse:true },
  'Dragon Dance':  { type:'Dragon', cat:'status', pp:20, target:'self', effects:[{kind:'stage', who:'self', stat:'atk', delta:1},{kind:'stage', who:'self', stat:'spe', delta:1}] },

  // ---------- Dark ----------
  'Knock Off':     { type:'Dark', cat:'phys', power:65, acc:100, pp:20, contact:true, effects:[{kind:'knockoff'}] },
  'Crunch':        { type:'Dark', cat:'phys', power:80, acc:100, pp:16, contact:true, effects:[{kind:'stage', who:'target', stat:'def', delta:-1, chance:20}] },
  'Sucker Punch':  { type:'Dark', cat:'phys', power:70, acc:100, pp:8, priority:1, contact:true, effects:[{kind:'suckerpunch'}] },
  'Dark Pulse':    { type:'Dark', cat:'spec', power:80, acc:100, pp:16, pulse:true, effects:[{kind:'flinch', chance:20}] },
  'Nasty Plot':    { type:'Dark', cat:'status', pp:20, target:'self', effects:[{kind:'stage', who:'self', stat:'spa', delta:2}] },
  'Kowtow Cleave': { type:'Dark', cat:'phys', power:85, acc:null, pp:16, contact:true, neverMiss:true },
  'Darkest Lariat':{ type:'Dark', cat:'phys', power:85, acc:100, pp:16, contact:true },
  'Parting Shot':  { type:'Dark', cat:'status', pp:20, acc:100, effects:[{kind:'stage', who:'target', stat:'atk', delta:-1},{kind:'stage', who:'target', stat:'spa', delta:-1},{kind:'pivot'}] },
  'Taunt':         { type:'Dark', cat:'status', pp:20, acc:100, effects:[{kind:'taunt'}] },

  // ---------- Fairy ----------
  'Moonblast':     { type:'Fairy', cat:'spec', power:95, acc:100, pp:16, override:{ desc:'Has a 30% chance of lowering the target’s Sp. Atk stat by 1 stage.' }, effects:[{kind:'stage', who:'target', stat:'spa', delta:-1, chance:30}] },
  'Play Rough':    { type:'Fairy', cat:'phys', power:90, acc:90, pp:12, contact:true, effects:[{kind:'stage', who:'target', stat:'atk', delta:-1, chance:10}] },
  'Dazzling Gleam':{ type:'Fairy', cat:'spec', power:80, acc:100, pp:12 },
  'Charm':         { type:'Fairy', cat:'status', pp:20, acc:100, effects:[{kind:'stage', who:'target', stat:'atk', delta:-2, chance:100}] },

  // ---------- Screens (Psychic) ----------
  'Reflect':       { type:'Psychic', cat:'status', pp:20, target:'allySide', override:{ desc:'Halves damage from physical moves against the user’s side for 5 turns.' }, effects:[{kind:'screen', screen:'reflect'}] },
  'Light Screen':  { type:'Psychic', cat:'status', pp:20, target:'allySide', effects:[{kind:'screen', screen:'lightscreen'}] },
  'Sticky Web':    { type:'Bug', cat:'status', pp:20, target:'foeSide', effects:[{kind:'hazard', hazard:'web'}] },
};
