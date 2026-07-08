// Main Hub — Frontier City gym rendered as a pixel scene strip + classic RPG
// command menu (arrow keys / enter work, mouse too), with rank card, team
// bench and an NPC dialogue window on the side.
import { el, clear } from '../engine/dom.js';
import { go } from '../engine/scenes.js';
import { state, save, teamMons, boxCapacity, sweepTrials } from '../state/store.js';
import { rankInfo, ensureDailies, STARTER_MISSIONS } from '../state/progression.js';
import { NPCS, DIALOGUE } from '../data/trainers.js';
import { showdownBg } from '../data/sprites.js';
import { monToken, toast, topbar, playDialogue } from '../ui/widgets.js';
import { sfx, setAudioEnabled } from '../engine/audio.js';
import { pick } from '../engine/rng.js';

const FLAVOR = [
  ['tatora', 'The ladder resets monthly — every season is a fresh climb.'],
  ['tatora', 'Rank-ups pay VP and expand your Box. The ladder is a faucet!'],
  ['kitt',   'Ranch lineup rotates on a timer. Come see what wandered in!'],
  ['cordy',  'Burn halves physical attacks. Statuses win championships.'],
  ['rotie',  'Bzzt! Team preview shows the enemy team — scout before you pick three!'],
  ['cordy',  'One Mega Evolution per battle. Save it for the pivotal turn.'],
];

export const hubScene = {
  onKey: null,
  async enter(root) {
    const S = state();
    const removed = sweepTrials();
    if (removed > 0) toast(`${removed} trial rental${removed > 1 ? 's' : ''} expired and returned to the Ranch.`);
    ensureDailies();
    save();

    const r = rankInfo();
    const team = teamMons();
    const dailyClaimable = S.missions.daily.tasks.filter(t => !t.claimed && t.progress >= t.need).length
      + STARTER_MISSIONS.filter(m => S.missions.starterDone.includes(m.id) && !S.missions.starterClaimed.includes(m.id) && m.vp > 0).length;
    const [npcKey, npcLine] = pick(FLAVOR);

    const CMDS = [
      { t: 'Battle', d: 'Queue for Ranked or Casual ladders — win VP and rank points.', ic: '⚔️', to: 'battle-select' },
      { t: 'Roster Ranch', d: 'Kitt’s gacha — trial rentals and permanent recruits.', ic: '🤠', to: 'ranch' },
      { t: 'Training Room', d: 'Buy your build: stat points, nature, moves, ability.', ic: '💪', to: 'training' },
      { t: 'Box & Team', d: `Manage storage (${S.box.length}/${boxCapacity()}) and your battle team of 6.`, ic: '📦', to: 'box' },
      { t: 'Frontier Shop', d: 'Held items, berries and 2,000 VP Mega Stones.', ic: '🛒', to: 'shop' },
      { t: 'Missions & Pass', d: 'Daily VP faucets and the season pass track.', ic: '📋', to: 'missions', badge: dailyClaimable || null },
    ];

    let sel = 0;
    const hint = el('div.cmd-hint', {}, CMDS[0].d);
    const items = CMDS.map((c, i) => el('button.nav-btn' + (i === 0 ? '.primary' : ''), {
      onclick: () => { sfx.confirm(); go(c.to); },
      onmouseenter: () => setSel(i),
    },
      el('span.ic', {}, c.ic),
      el('span.lbl', {}, c.t),
      c.badge ? el('span.badge', {}, `${c.badge}`) : null,
    ));
    const setSel = (i) => {
      sel = (i + CMDS.length) % CMDS.length;
      items.forEach((it, j) => it.classList.toggle('sel', j === sel));
      hint.textContent = CMDS[sel].d;
    };
    setSel(0);

    this.onKey = (e) => {
      if (document.querySelector('.dialogue, .modal-back')) return;
      if (e.key === 'ArrowDown' || e.key === 's') { setSel(sel + 1); sfx.click(); }
      else if (e.key === 'ArrowUp' || e.key === 'w') { setSel(sel - 1); sfx.click(); }
      else if (e.key === 'Enter' || e.key === ' ') { sfx.confirm(); go(CMDS[sel].to); }
    };
    window.addEventListener('keydown', this.onKey);

    // scene strip: gym sign, NPCs and the lead Pokémon hanging around
    const sceneNpcs = [
      { glyph: NPCS.tatora.glyph, left: '12%' },
      { glyph: NPCS.cordy.glyph, left: '78%' },
      { glyph: NPCS.kitt.glyph, left: '64%' },
    ];
    // Interactive lobby cast: the team stands on the platform; tap any teammate
    // (on stage or in the roster) to feature it centre-stage, or poke the lead.
    let featured = 0;
    const castWrap = el('div.hero-cast');
    const rosterSlots = el('div.slots');
    function castMon(m, i, cls) {
      const node = el('div.cast-mon.' + cls, {
        title: `${m.species} — tap to feature`,
        onclick: () => {
          sfx.confirm();
          node.classList.remove('poke'); void node.offsetWidth; node.classList.add('poke');
          if (i !== featured) feature(i);
        },
      }, monToken(m.species, { size: cls === 'lead' ? '11rem' : '7rem', animated: true }));
      return node;
    }
    function renderCast() {
      // whole team lined up on the platform; the featured one is enlarged
      clear(castWrap).append(
        ...team.map((m, i) => castMon(m, i, i === featured ? 'lead' : 'side')),
      );
    }
    function renderRoster() {
      clear(rosterSlots).append(
        ...team.map((m, i) => el('button.roster-slot' + (i === featured ? '.on' : ''), {
          title: `Feature ${m.species}`, onclick: () => { sfx.click(); feature(i); },
        }, monToken(m.species, { size: '2.9rem', animated: true }))),
        ...Array.from({ length: Math.max(0, 6 - team.length) }, () => el('div.slot-empty', { style: { width: '2.9rem', height: '2.9rem' } }, '+')),
      );
    }
    function feature(i) { featured = i; renderCast(); renderRoster(); }
    if (team.length) { renderCast(); renderRoster(); }

    root.append(
      topbar(`Frontier City — ${S.trainer.name}'s Gym`, {
        extras: [
          el('span.chip', { title: 'Teammate / Training tickets' }, `🎟${S.tickets.teammate} 🛠${S.tickets.training}`),
          S.omniRing ? el('span.chip', { title: 'Omni Ring — enables Mega Evolution' }, '💍') : null,
          el('button.btn.small', {
            onclick: () => { S.settings.sound = !S.settings.sound; setAudioEnabled(S.settings.sound); save(); toast(`Sound ${S.settings.sound ? 'on' : 'off'}`); },
            title: 'Toggle sound',
          }, S.settings.sound ? '🔊' : '🔇'),
        ],
      }),
      el('div.hub', { style: { '--bg': `url("${showdownBg('city')}")` } },
        el('div.hub-hero', {},
          el('div.gym-sign', {}, '★ FRONTIER CITY GYM ★'),
          // rank badge — top-left overlay
          el('div.rank-badge', {},
            el('div.tier', {}, `🏆 ${r.label}`),
            el('div.gauge', {}, el('i', { style: { width: `${r.pts}%` } })),
            el('small.dim', {}, `${r.pts}/${r.gauge} to next${S.streak > 1 ? `  ·  🔥 ${S.streak}` : ''}`),
          ),
          // the team stands here on a lit platform; tap to feature (interactive)
          el('div.hero-platform'),
          castWrap,
          // NPC speech bubble — bottom-left
          el('div.hero-say', {},
            el('span.who', {}, `${NPCS[npcKey].glyph} ${NPCS[npcKey].name}`),
            el('div', {}, npcLine),
          ),
          // team roster — bottom-right overlay (tap to feature, Edit → box)
          el('div.hero-team', {},
            el('div.row', { style: { justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' } },
              el('small.dim', {}, 'TEAM · tap to feature'),
              el('button.btn.small', { onclick: () => { sfx.confirm(); go('box'); } }, '✎ Edit'),
            ),
            rosterSlots,
          ),
        ),
        hint,
        el('div.hub-nav', {}, ...items),
      ),
    );

    // one-time Kitt intro after the tutorial reward flow (detached so the
    // scene transition veil lifts before the dialogue starts)
    if (S.flags.tutorial && !S.flags.kittIntro) {
      S.flags.kittIntro = true;
      save();
      playDialogue(DIALOGUE.postTutorial, NPCS);
    }
  },
  exit() {
    if (this.onKey) window.removeEventListener('keydown', this.onKey);
    this.onKey = null;
  },
};
