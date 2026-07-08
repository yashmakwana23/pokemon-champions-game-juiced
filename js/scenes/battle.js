// Battle scene — consumes battle-core events and renders the stage, HUD
// (opponent HP % only / own HP absolute+% per GDD), move buttons with
// pre-commit effectiveness labels, Mega toggle, 45s move timer, Rotie hints.
import { el, clear, sleep } from '../engine/dom.js';
import { go } from '../engine/scenes.js';
import { CONFIG } from '../data/config.js';
import { MOVES } from '../data/moves.js';
import { SPECIES } from '../data/species.js';
import { effLabel } from '../data/types.js';
import { state, save } from '../state/store.js';
import { createBattle, runTurn, legalActions, STRUGGLE } from '../systems/battle-core.js';
import { switchInAbilities } from '../systems/battle-effects.js';
import { typeMult } from '../systems/damage.js';
import { chooseAction, chooseSwitch } from '../systems/battle-ai.js';
import { scriptedTeam, generateOpponent } from '../systems/teamgen.js';
import { CORDY_TEAM, NPCS, ROTIE_TIPS } from '../data/trainers.js';
import { monToken, typeBadge, toast } from '../ui/widgets.js';
import { showdownBg, BATTLE_SCENES } from '../data/sprites.js';
import { attachFx, detachFx, burst, sparkleRise, screenShake, flashStage, ring, weatherStart, weatherStop } from '../engine/fx.js';
import { hitStop, setTimeScale } from '../engine/loop.js';
import { tween, Easing } from '../engine/tween.js';
import { playMoveAnim, archetypeOf, isMelee, tintOf } from '../data/anim.js';
import { TYPE_COLORS } from '../data/types.js';
import { sfx } from '../engine/audio.js';
import { pick } from '../engine/rng.js';

export const battleScene = {
  cleanup: null,
  async enter(root, params) {
    const S = state();
    const scene = this;
    let { mode = 'casual', opp = null, picks = null } = params;

    // --- scripted / fallback setups ---
    if (mode === 'tutorial') {
      opp = { trainer: { name: 'Cordy', title: 'Veteran Gym Leader' }, team: scriptedTeam(CORDY_TEAM), aiLevel: 0, hasOmniRing: false };
      const mine = S.team.map(uid => S.box.find(m => m.uid === uid)).filter(Boolean);
      picks = mine.slice(0, 3);
    }
    if (!opp) opp = generateOpponent({ tierIdx: S.rank.tier, mode });
    const aiPicks = opp.team.slice(0, CONFIG.SINGLES_PICK);

    const B = createBattle({
      playerPicks: picks,
      aiPicks,
      playerTrainer: { name: S.trainer.name },
      aiTrainer: opp.trainer,
      mode,
      playerOmni: S.omniRing,
      aiOmni: opp.hasOmniRing,
      aiLevel: opp.aiLevel ?? 1,
    });

    // ---------- DOM scaffold ----------
    const arena = el('div.arena');
    let sceneIdx = Math.floor(Math.random() * BATTLE_SCENES.length);
    const applyScene = () => arena.style.setProperty('--bg', `url("${showdownBg(BATTLE_SCENES[sceneIdx])}")`);
    applyScene();
    const sceneBtn = el('button.top-btn', {
      title: 'Change background',
      onclick: () => { sceneIdx = (sceneIdx + 1) % BATTLE_SCENES.length; applyScene(); sfx.click(); },
    }, '🏞');
    const quitBtn = el('button.top-btn.quit', {
      title: 'Leave battle',
      onclick: () => {
        sfx.cancel();
        if (confirm('Leave the battle and return to the gym?')) { scene.cleanup(); go('hub'); }
      },
    }, '✕ Quit');
    const topCtl = el('div.topctl', {}, quitBtn, sceneBtn);
    const stage = el('div.battle-stage', {},
      arena,
      el('canvas', { id: 'fx-canvas' }),
    );
    const fieldInfo = el('div.field-info');
    const foePlate = el('div.plate.foe');
    const allyPlate = el('div.plate.ally');
    const foeSpot = el('div.combatant.foe');
    const allySpot = el('div.combatant.ally');

    // Input + message live ON the scene now (no separate dock panel): the move
    // cluster sits beside the player's Pokémon, the message reads along the base.
    const logLine = el('div.log-line', {}, ' ');
    const dockRow = el('div.dock-row');
    stage.append(fieldInfo, foePlate, allyPlate, foeSpot, allySpot, dockRow, logLine, topCtl);
    root.append(el('div.battle', {}, stage));
    attachFx(stage.querySelector('#fx-canvas'));
    // cinematic 3D camera sweep on battle open (settles before you can act)
    stage.classList.add('intro-cam');
    setTimeout(() => stage.classList.remove('intro-cam'), 1600);

    let timerId = null;
    let rotieNode = null;
    scene.cleanup = () => { clearInterval(timerId); weatherStop(); setTimeScale(1); detachFx(); };

    // ---------- render helpers ----------
    const spotOf = (mon) => (mon.side.idx === 0 ? allySpot : foeSpot);
    const plateOf = (mon) => (mon.side.idx === 0 ? allyPlate : foePlate);
    const posOf = (mon) => (mon.side.idx === 0 ? { x: 0.17, y: 0.58 } : { x: 0.80, y: 0.34 });

    function renderCombatant(mon) {
      const spot = spotOf(mon);
      clear(spot);
      if (!mon || mon.hp <= 0) return;
      spot.className = `combatant ${mon.side.idx === 0 ? 'ally' : 'foe'}`;
      spot.append(
        monToken(mon.inst.species, {
          size: mon.side.idx === 0 ? '18rem' : '14rem',
          mega: mon.isMega,
          types: mon.types,
          glyph: SPECIES[mon.inst.species].glyph,
          form: mon.isMega ? mon.name : null,
          animated: true,
          back: mon.side.idx === 0,
        }),
        el('div.platform'),
      );
    }

    function renderPlate(mon) {
      const plate = plateOf(mon);
      clear(plate);
      if (!mon || mon.hp <= 0) { plate.style.opacity = '0'; return; }
      plate.style.opacity = '1';
      const pct = Math.round((mon.hp / mon.maxHp) * 100);
      const stageChips = Object.entries(mon.stages)
        .filter(([, v]) => v !== 0)
        .map(([k, v]) => el('span.stage-chip' + (v > 0 ? '.up' : '.dn'), {},
          `${k.toUpperCase()} ${v > 0 ? '+' : ''}${v}`));
      plate.append(...[
        el('div.nm-row', {},
          el('b', {}, mon.name),
          el('span.lv', {}, 'Lv 50'),
          ...mon.types.map(typeBadge),
          mon.status ? el('span.status-tag.' + mon.status, {}, mon.status) : null,
        ),
        el('div.hp-shell', {}, el('i.hp-fill' + (pct <= 25 ? '.low' : pct <= 55 ? '.mid' : ''), { style: { width: pct + '%' } })),
        el('div.hp-nums', {},
          el('span.pct', {}, `${pct}%`),
          // GDD: opponent shows % ONLY; own shows absolute + %
          mon.side.idx === 0 ? el('span', {}, `${mon.hp} / ${mon.maxHp}`) : el('span', {}, ''),
        ),
        stageChips.length ? el('div.stage-chips', {}, ...stageChips) : null,
      ].filter(Boolean));
    }

    function renderField() {
      clear(fieldInfo);
      if (!state().settings.battleInfo) return;
      const chips = [];
      if (B.weather.kind) {
        const names = { sun: '☀ Harsh Sunlight', rain: '🌧 Rain', sand: '🌪 Sandstorm', snow: '❄ Snow' };
        chips.push(`${names[B.weather.kind]} · ${B.weather.turns}`);
      }
      if (B.field.trickroom > 0) chips.push(`🔮 Trick Room · ${B.field.trickroom}`);
      for (const side of B.sides) {
        const who = side.idx === 0 ? 'You' : 'Foe';
        if (side.tailwind > 0) chips.push(`💨 Tailwind (${who}) · ${side.tailwind}`);
        for (const [k, v] of Object.entries(side.screens)) {
          if (v > 0) chips.push(`🛡 ${k === 'auroraveil' ? 'Aurora Veil' : k === 'reflect' ? 'Reflect' : 'Light Screen'} (${who}) · ${v}`);
        }
        if (side.hazards.rocks) chips.push(`🪨 Rocks (${who} side)`);
        if (side.hazards.web) chips.push(`🕸 Web (${who} side)`);
        if (side.hazards.tspikes) chips.push(`☠ T-Spikes ×${side.hazards.tspikes} (${who} side)`);
      }
      stage.className = 'battle-stage' + (B.weather.kind ? ` w-${B.weather.kind}` : '') + (B.field.trickroom > 0 ? ' trickroom' : '');
      fieldInfo.append(...chips.map(c => el('span.field-chip', {}, c)));

      // Sync live weather particles to the current condition.
      const wk = B.weather.kind || null;
      if (wk !== curWeather) { curWeather = wk; if (wk) weatherStart(wk); else weatherStop(); }
    }

    function renderAll() {
      renderCombatant(B.active(0)); renderCombatant(B.active(1));
      renderPlate(B.active(0)); renderPlate(B.active(1));
      renderField();
    }

    function floatDmg(mon, amount, { heal = false, crit = false } = {}) {
      const p = posOf(mon);
      const n = el('div.dmg-float' + (heal ? '.heal' : '') + (crit ? '.crit' : ''), {
        style: { left: `calc(${p.x * 100}% - 1rem)`, top: `${p.y * 100 - 12}%` },
      }, `${heal ? '+' : '−'}${amount}`);
      stage.append(n);
      setTimeout(() => n.remove(), 950);
    }

    function rotie(text) {
      rotieNode?.remove();
      rotieNode = el('div.rotie', {}, el('div.who', {}, '🤖 ROTIE'), el('div', {}, text));
      stage.append(rotieNode);
      setTimeout(() => { rotieNode?.remove(); rotieNode = null; }, 4200);
    }

    // Cinematic camera — drives --cam (zoom) / transform-origin, composited with
    // the FX shake in CSS (no transition, so shake stays crisp). camZoom is the
    // held baseline; punches overshoot around it, then settle back.
    let camZoom = 1;
    const camOrigin = (pt) => { stage.style.transformOrigin = `${pt.x * 100}% ${pt.y * 100}%`; };
    const setCam = (v) => { camZoom = v; stage.style.setProperty('--cam', String(v)); };
    function cameraZoom(pt, z = 1.06, dur = 0.35) {         // push in toward a point
      camOrigin(pt);
      tween({ from: camZoom, to: z, dur, ease: Easing.quadOut, onUpdate: setCam });
    }
    function cameraReset(dur = 0.45) {                       // ease back to neutral
      tween({ from: camZoom, to: 1, dur, ease: Easing.quadOut, onUpdate: setCam });
    }
    function cameraPunch(pt, amt = 0.05) {                   // quick impact overshoot
      camOrigin(pt);
      const base = camZoom;
      tween({ from: base + amt, to: base, dur: 0.3, ease: Easing.expoOut, onUpdate: v => stage.style.setProperty('--cam', String(v)) });
    }

    // Full-stage color wash tinted to the move's type (::after overlay in CSS).
    function flashType(color) {
      stage.style.setProperty('--flash-col', color);
      stage.classList.remove('flash-type'); void stage.offsetWidth;
      stage.classList.add('flash-type');
    }

    // Chip-chip-chip ticks while an HP bar drains.
    function drainTicks(n = 6) {
      for (let i = 0; i < n; i++) setTimeout(() => sfx.tick(), i * 55);
    }

    let curWeather = null;          // reflected into fx weather particles by renderField
    let lastMoveTint = '#ffffff';   // type color of the in-flight move, for hit reactions

    // ---------- engine event consumer ----------
    const SPEED = 1;
    B.E = async (ev) => {
      switch (ev.t) {
        case 'usemove': {
          if (ev.text) logLine.textContent = ev.text;
          const mon = ev.mon;
          lastMoveTint = tintOf(ev.move);
          const arch = archetypeOf(ev.move);
          const selfCast = ['buff', 'heal', 'screen', 'weather'].includes(arch) || ev.move.target === 'self';
          const target = selfCast ? mon : (B.activeFoe(mon) ?? mon);

          // distinct attacker motion per move archetype
          const ACT = {
            strike: mon.side.idx === 0 ? 'attack-ally' : 'attack-foe',
            slam: 'act-stomp', quake: 'act-stomp',
            orb: 'act-throw', meteor: 'act-throw', hex: 'act-throw',
            beam: 'act-charge', wave: 'act-charge', bolt: 'act-charge',
            buff: 'cast', heal: 'cast', screen: 'cast', field: 'cast', weather: 'cast',
          };
          const actClass = ACT[arch] || 'act-charge';
          const spot = spotOf(mon);
          spot.classList.remove('attack-ally', 'attack-foe', 'cast', 'act-stomp', 'act-throw', 'act-charge');
          void spot.offsetWidth;
          spot.classList.add(actClass);

          await playMoveAnim(ev.move, { from: posOf(mon), to: posOf(target) }, { color: lastMoveTint });
          spot.classList.remove(actClass);
          await sleep(120 * SPEED);
          break;
        }
        case 'msg': case 'eff': case 'status': case 'stage':
        case 'weather': case 'field': {
          if (ev.text) logLine.textContent = ev.text;
          if (ev.t === 'msg' && ev.text === 'A critical hit!') {
            sfx.crit(); flashType('#ffd76b'); screenShake(9);
          }
          if (ev.t === 'eff') {
            if (ev.mult >= 2) { sfx.superHit(); screenShake(ev.mult >= 4 ? 14 : 9); hitStop(ev.mult >= 4 ? 0.1 : 0.07); }
            else if (ev.mult < 1) sfx.weakHit();
          }
          if (ev.t === 'status') { sfx.status(); renderPlate(ev.mon); }
          if (ev.t === 'stage') renderPlate(ev.mon);
          if (ev.t === 'weather' || ev.t === 'field') renderField();
          await sleep((ev.t === 'msg' && !ev.text ? 60 : 620) * SPEED);
          break;
        }
        case 'hp': {
          const diff = ev.to - ev.from;
          if (ev.text) logLine.textContent = ev.text;
          if (diff < 0) {
            const mon = ev.mon;
            const p = posOf(mon);
            const frac = Math.abs(diff) / mon.maxHp;
            const mult = ev.mult ?? 1;
            const big = mult >= 2 || frac > 0.34;
            spotOf(mon).classList.remove('hurt'); void spotOf(mon).offsetWidth;
            spotOf(mon).classList.add('hurt');
            flashType(lastMoveTint);
            cameraPunch(p, big ? 0.075 : 0.038);
            hitStop(big ? 0.07 : 0.035);
            screenShake(big ? 8 : 4);
            burst(p.x, p.y, { count: big ? 20 : 12, color: lastMoveTint, speed: 260, size: 4, shape: 'spark', blend: 'add', life: 0.35 });
            if (!ev.heal) sfx.hit();
            floatDmg(mon, -diff, { crit: false });
            drainTicks(big ? 8 : 5);
          } else if (diff > 0) {
            flashStage('flash-heal');
            sfx.heal();
            floatDmg(ev.mon, diff, { heal: true });
            const p = posOf(ev.mon);
            sparkleRise(p.x, p.y, '#3ddb97');
            drainTicks(5);
          }
          renderPlate(ev.mon);
          await sleep(560 * SPEED);
          break;
        }
        case 'switch': case 'recall': {
          if (ev.text) logLine.textContent = ev.text;
          renderAll();
          if (ev.t === 'switch') {
            spotOf(ev.mon).classList.add('enter');
            const p = posOf(ev.mon);
            ring(p.x, p.y, { color: '#ffffff', maxR: 0.13, dur: 0.4, width: 4 });
            burst(p.x, p.y, { color: '#ffffff', count: 16, speed: 170, size: 3 });
            sfx.click();
          }
          await sleep(520 * SPEED);
          break;
        }
        case 'faint': {
          logLine.textContent = ev.text;
          sfx.faint();
          const p = posOf(ev.mon);
          setTimeScale(0.4);
          screenShake(7);
          burst(p.x, p.y, { count: 28, color: '#ffffff', speed: 220, size: 4, shape: 'glow', blend: 'add' });
          ring(p.x, p.y, { color: '#ffffff', maxR: 0.2, dur: 0.55, width: 5 });
          spotOf(ev.mon).classList.add('fainted');
          renderPlate(ev.mon);
          setTimeout(() => setTimeScale(1), 480);
          await sleep(760 * SPEED);
          renderAll();
          break;
        }
        case 'mega': {
          logLine.textContent = ev.text;
          flashStage('flash-mega');
          sfx.mega();
          const p = posOf(ev.mon);
          cameraPunch(p, 0.06);
          sparkleRise(p.x, p.y, '#b26bff');
          ring(p.x, p.y, { color: '#b26bff', maxR: 0.22, dur: 0.6, width: 6 });
          burst(p.x, p.y, { color: '#b26bff', count: 36, speed: 280, size: 4, shape: 'glow', blend: 'add' });
          renderAll();
          if (ev.mon.side.idx === 0) B.counters.megaUsed = true;
          await sleep(900 * SPEED);
          break;
        }
        default: await sleep(60);
      }
    };

    B.getSwitch = async (sideIdx, forced) => {
      if (sideIdx === 1) return chooseSwitch(B, 1);
      return await promptSwitch(forced);
    };

    // ---------- player input ----------
    function promptSwitch(forced) {
      return new Promise(resolve => {
        const side = B.sides[0];
        clear(dockRow).append(
          el('div', { style: { flex: 1 } },
            el('h3', { style: { marginBottom: '0.4rem' } }, forced ? 'Choose your next Pokémon!' : 'Switch to:'),
            ...side.party.map((m, i) => {
              const dis = m.hp <= 0 || i === side.activeIdx;
              return el('button.party-row', {
                disabled: dis,
                onclick: () => { sfx.confirm(); resolve(i); },
              },
                monToken(m.inst.species, { size: '3.8rem', mega: m.isMega, types: m.types, animated: true }),
                el('b', {}, m.name),
                m.status ? el('span.status-tag.' + m.status, {}, m.status) : null,
                el('div.hpmini', {}, el('i', { style: { width: `${(m.hp / m.maxHp) * 100}%` } })),
                el('small.dim', {}, `${Math.round((m.hp / m.maxHp) * 100)}%`),
              );
            }),
          ),
        );
      });
    }

    function promptAction() {
      return new Promise(resolve => {
        const mon = B.active(0);
        const foe = B.active(1);
        const legal = legalActions(B, 0);
        let megaArmed = false;

        if (legal.charging) { resolve({ type: 'move', idx: 0 }); return; }

        // Rotie coaching: best/worst matchup hints, mega reminder, low HP
        const usable = legal.moves.filter(m => !m.disabled && (MOVES[m.name] ?? STRUGGLE).cat !== 'status');
        if (usable.length && foe) {
          const best = usable.map(m => ({ m, mult: typeMult(MOVES[m.name] ?? STRUGGLE, mon, foe) })).sort((a, b) => b.mult - a.mult)[0];
          if (legal.canMega && chance08()) rotie(pick(ROTIE_TIPS.megaReady));
          else if (best.mult >= 2 && chance08()) {
            rotie(pick(ROTIE_TIPS.superEffective).replace('{mult}', best.mult).replace('{move}', best.m.name)
              .replace('{label}', effLabel(best.mult).txt.toLowerCase()).replace('{target}', foe.name));
          } else if (mon.hp / mon.maxHp < 0.25 && chance08()) rotie(pick(ROTIE_TIPS.lowHp));
        }

        const timerLabel = el('span.timer-ring', {}, String(CONFIG.MOVE_TIMER_S));
        let remain = CONFIG.MOVE_TIMER_S;
        clearInterval(timerId);
        if (state().settings.timer && mode !== 'tutorial') {
          timerId = setInterval(() => {
            remain--;
            timerLabel.textContent = String(remain);
            if (remain <= 10) timerLabel.classList.add('low');
            if (remain <= 0) {
              clearInterval(timerId);
              const first = legal.moves.find(m => !m.disabled);
              toast('Time! Auto-move selected.');
              done({ type: 'move', idx: first ? first.idx : 0 });
            }
          }, 1000);
        } else timerLabel.textContent = '—';

        const megaBtn = legal.canMega ? el('button.mega-toggle', {
          onclick: () => {
            megaArmed = !megaArmed;
            megaBtn.classList.toggle('armed', megaArmed);
            sfx.click();
          },
        }, '🧬 MEGA EVOLVE') : null;

        const moveGrid = el('div.move-grid', {}, ...legal.moves.map(lm => {
          const mv = MOVES[lm.name] ?? STRUGGLE;
          const mult = foe && mv.cat !== 'status' ? typeMult(mv, mon, foe) : null;
          const effTag = mult !== null ? effLabel(mult) : null;
          return el('button.move-btn', {
            disabled: !!lm.disabled,
            title: lm.disabled ?? mv.desc ?? '',
            style: { '--mv-color': TYPE_COLORS[mv.type] },
            onclick: () => { sfx.confirm(); done({ type: 'move', idx: lm.idx, mega: megaArmed }); },
          },
            el('div.mv-top', {},
              el('span.mv-nm', {}, lm.name),
              el('small.dim', {}, `${lm.pp}/${lm.maxPp}`),
            ),
            el('div.mv-meta', {},
              el('span', {}, mv.type),
              el('span', {}, mv.cat === 'status' ? 'Status' : mv.cat === 'phys' ? `Phys ${mv.power}` : `Spec ${mv.power}`),
              el('span', {}, mv.acc === null ? '—' : `${mv.acc}%`),
              mv.priority ? el('span', {}, `${mv.priority > 0 ? '+' : ''}${mv.priority} Priority`) : null,
            ),
            effTag ? el('span.mv-eff.' + effTag.cls, {}, `${effTag.icon} ${effTag.txt}`) : null,
          );
        }));

        clear(dockRow).append(
          moveGrid,
          el('div.side-actions', {},
            el('div.row', { style: { justifyContent: 'space-between' } },
              el('small.dim', {}, `Turn ${B.turn + 1}`),
              el('span', {}, '⏱ ', timerLabel),
            ),
            megaBtn,
            el('button.btn.small', {
              disabled: !legal.switches.length,
              onclick: async () => {
                sfx.click();
                const i = await promptSwitchCancelable();
                if (i === null) { done.rearm(); return; }
                done({ type: 'switch', idx: i });
              },
            }, '🔄 Pokémon'),
            el('button.btn.small.danger.ghost', {
              onclick: () => { if (confirm('Forfeit the match?')) done({ type: 'forfeit' }); },
            }, '🏳 Forfeit'),
          ),
        );

        let resolved = false;
        function done(action) {
          if (resolved) return;
          resolved = true;
          clearInterval(timerId);
          resolve(action);
        }
        done.rearm = () => { promptAction().then(r => done(r)); };
      });

      function chance08() { return Math.random() < 0.65; }
    }

    function promptSwitchCancelable() {
      return new Promise(resolve => {
        const side = B.sides[0];
        clear(dockRow).append(
          el('div', { style: { flex: 1 } },
            ...side.party.map((m, i) => {
              const dis = m.hp <= 0 || i === side.activeIdx;
              return el('button.party-row', {
                disabled: dis,
                onclick: () => resolve(i),
              },
                monToken(m.inst.species, { size: '3.8rem', mega: m.isMega, types: m.types, animated: true }),
                el('b', {}, m.name),
                el('div.hpmini', {}, el('i', { style: { width: `${(m.hp / m.maxHp) * 100}%` } })),
                el('small.dim', {}, `${Math.round((m.hp / m.maxHp) * 100)}%`),
              );
            }),
          ),
          el('div.side-actions', {}, el('button.btn.small', { onclick: () => resolve(null) }, 'Cancel')),
        );
      });
    }

    // Run detached: enter() must return promptly so the scene manager can
    // drop the transition veil; the battle paces itself via events.
    (async function run() {
      logLine.textContent = `${opp.trainer.name} wants to battle!`;
      renderAll();
      await sleep(500);
      for (const i of [1, 0]) {
        const mon = B.active(i);
        await B.E({ t: 'switch', mon, side: i, text: `${B.sides[i].trainer.name} sent out ${mon.name}!` });
      }
      // entry abilities for leads
      for (const mon of [B.active(0), B.active(1)]) await switchInAbilities(B, mon);
      renderAll();

      while (B.winner === null) {
        const playerAction = await promptAction();
        clear(dockRow).append(el('div.grow', { style: { display: 'grid', placeItems: 'center', color: 'var(--dim)' } }, '— resolving turn —'));
        const aiAction = chooseAction(B, 1);
        await runTurn(B, [playerAction, aiAction]);
        cameraReset();
        renderAll();
        save();
      }

      scene.cleanup();
      await sleep(600);
      go('results', {
        won: B.winner === 0,
        mode,
        opp,
        counters: B.counters,
        forfeited: B.forfeited,
      });
    })().catch(e => { console.error('battle loop', e); toast('Battle error — returning to gym.'); go('hub'); });
  },
  exit() { this.cleanup?.(); this.cleanup = null; },
};
