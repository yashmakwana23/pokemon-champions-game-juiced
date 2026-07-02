# Pokémon Champions — Browser Recreation

A complete, playable single-player recreation of **Pokémon Champions** (the
competitive battle-sim spin-off), built faithfully from the project's Game
Design Document — the field guide reconstructed from 292 YouTube videos
(`payload_A.json`) plus the scraped Champions dex database (`dex_db.json`).

Vanilla JavaScript + ES modules. No build step, no frameworks, no assets to
install — Pokémon artwork streams from a public sprite CDN keyed by the
National Dex numbers recorded in the GDD's dex (with styled emoji-orb
fallbacks when offline).

## Run it

ES modules need a static server (any will do):

```
cd pokemon-champions-game
npx http-server -p 8123        # or: python -m http.server 8123
# open http://localhost:8123
```

## Controls

Mouse / touch everywhere. `Enter`/`Space` advances dialogue. In battle:
click a move to attack (each button shows type, power, accuracy, PP,
priority and the pre-commit effectiveness label — ★ 4× down to ▽ 0.25×),
**🧬 MEGA EVOLVE** arms Mega Evolution for that turn, **Pokémon** switches
(uses your turn), **Forfeit** concedes. Ranked runs a 45-second move timer;
expiry auto-picks. Progress saves to `localStorage` automatically.

## What's implemented (from the GDD)

- **The full loop**: Recruit (Roster Ranch gacha: free daily 7-day Trial that
  can't be trained, or permanent recruit at 1,000–8,000 VP by rarity; 22 h
  lineup refresh skippable at 100 VP/hour; Teammate Tickets) → **Train**
  (66-point stat pool, 32/stat, 5 VP/pt, free reset · 25 natures ±10 %,
  500 VP · ability swap 500 VP · move swaps 250 VP · Training Tickets) →
  **Equip** (held items 700 VP, berries 400 VP, Mega Stones 2,000 VP) →
  **Battle** (ranked/casual 3v3 singles, bring-6-pick-3 with full team
  preview) → **Earn** (300/100 VP win/loss, streak bonuses, rank points,
  season pass SP, missions) → repeat.
- **Battle engine at level 50, IVs fixed 31**, using the GDD's exact
  formulas: HP = ⌊((2B+31)·50)/100⌋+60+SP; Stat = ⌊(⌊((2B+31)·50)/100⌋+5+SP)·N⌋;
  damage roll 0.85–1.00; crit 1/24 at 1.5× ignoring the right stages; STAB;
  18-type chart with the Champions 4-tier labels; **rebalanced statuses**
  (para full-stop 12.5 %, freeze 25 % thaw + hard 3-turn cap, sleep 33 %
  wake turn 2 / guaranteed turn 3, burn 1/16 + halved physical, toxic
  escalation); stat stages ±6 with on-plate multiplier chips; priority
  brackets; switching consumes the turn; entry hazards (Stealth Rock scaled
  by Rock weakness, Sticky Web, Toxic Spikes); weather (5 turns, +50 %/−50 %
  boosts, sand chip, weather rocks → 8); Tailwind (4) and Trick Room (5);
  screens; ~28 held items incl. Choice lock, Focus Sash, Weakness Policy,
  Life Orb, resist berries; ~35 implemented abilities incl. the
  Champions-custom **Piercing Drill** (hits through Protect at ¼) straight
  from the dex.
- **Mega Evolution** exactly per GDD: Omni Ring (tutorial reward) + held
  stone, armed at move select, resolves before moves, free action, once per
  team per battle, stats/type/ability swap (all 25 Mega stat lines read from
  the dex, including Champions-new Mega Dragonite / Greninja / Excadrill).
- **FTUE**: name → starter pack (1 of 3 six-mon bundles) → guided intro with
  Tatora/Cordy/Rotie → Cordy's tutorial battle (her GDD-recorded
  Venusaur/Blastoise/Heracross) → 10,000 VP + Omni Ring → Emma placement
  match → Poké Ball Tier.
- **Ranked ladder**: Beginner → Poké Ball → Great Ball → Ultra Ball →
  Master Ball → Champion, Ranks ×4, 100-pt gauge, +25/win, protected-tier
  loss trickle (+5) vs −10 above, rank-up VP + box expansions (30 → 50).
- **Rotie** pops up in battle with type hints; optional Battle Details HUD
  shows weather/field turn counters; opponent HP is **% only**, yours is
  absolute + % — the GDD's transparency conventions.
- Missions (starter one-time + 3 rotating dailies), 20-level free season
  pass, AI opponents with archetype teams (rain/sun/sand/Trick Room/stall…)
  whose build quality and AI depth scale with your tier.

## Data provenance

`tools/build-data.mjs` merges `dex_db.json` (base stats, Mega stats,
ability texts, move power/PP/accuracy, item effects + VP prices, National
Dex numbers) with two curated overlays (`tools/overlay-*.mjs`) supplying
what the scrape lost — types, move categories, effect logic, movepools.
Every curated field was cross-checked against canon by an adversarial
multi-agent verification pass; re-run the script to regenerate `js/data/`.

## Design decisions & deviations

Assumptions where the GDD was silent/ambiguous, and cuts (breadth, not depth):

- **Single-player vs AI** — Champions is an online PvP game; matchmaking is
  recreated as tier-scaled AI opponents with a VS splash. (No server.)
- **Singles only** — GDD documents doubles (4v4) as the competitive format;
  singles 3v3 is implemented deeply instead. *Deferred: doubles, spread
  damage, redirection.*
- **Roster: 41 species + 25 Megas** of the dex's 393 — chosen for type
  coverage, Mega availability, and meta relevance. Adding one = one overlay
  entry + rebuild.
- **Rank points** — GDD gives the 100-pt gauge, "big jump" wins and one
  observed +5 loss; exact values unrecorded → win +25, protected-tier loss
  +5, higher-tier loss −10 (floor 0, no demotion).
- **Trials** are real 7-day timestamps; expired rentals leave the box on
  hub entry, exactly one free trial per day.
- **Leech Seed drains 1/16** (mainline is 1/8) — following the Champions
  wiki text recorded in the dex.
- **Make It Rain accuracy 95** — kept as scraped from the Champions wiki
  (mainline is 100). Rapid Spin corrected to 50 power (scrape had the
  pre-Gen-8 20 with the Gen-8 effect).
- **Champions-new Megas keep base typing**; their abilities come from the
  dex (Piercing Drill implemented as written).
- **Move timer** 45 s per decision implemented; the 10-minute match clock
  and timeout-draw rule are skipped (AI turns resolve instantly, so it
  can't bind). Tutorial battles are untimed.
- **Artwork** — the dex scrape has no images; its National Dex numbers key
  into the PokeAPI official-artwork CDN (online), with type-gradient orb +
  emoji fallback (offline). Champions-new Megas show base art + a mega aura.
- **Deferred entirely** (out of single-player scope or GDD-contradictory):
  Pokémon HOME import, real-money layer (Battle Pass premium track,
  Membership, Starter Pack), team-ID share codes, tournaments/private
  lobbies/spectating, Battle Data analytics screens, cosmetics/Locker Room,
  Z-Moves/Dynamax/Terastallization (the GDD itself records Tera as absent
  and Mega-only as the safe reading), shiny variants.

*Fan-made recreation for study. Not affiliated with Nintendo / Game Freak /
The Pokémon Company.*
