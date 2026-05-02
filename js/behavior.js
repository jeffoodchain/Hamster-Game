/*
 * behavior.js
 *
 * The "AI" of the game: ticks the world forward one frame at a time, decides
 * what the hamster is doing, and runs the state machine of `ham.mode`.
 *
 * The mode field in state.ham is the heart of this file. Possible values
 * (and what hamPos() returns for each):
 *
 *   wander       free-roaming with random heading; hits walls, retargets.
 *   happy        being petted — sits in place with hearts above it.
 *   eating       eats a dragged seed at its current spot.
 *   climbing     going up the wheel from a side-view climb.
 *   onwheel      running on the wheel.
 *   descending   coming back down off the wheel.
 *   todrink      walking to the bottle.
 *   drinking     sipping from the bottle.
 *   fromdink     walking back from the bottle.
 *   tohut        walking to the sleep hut.
 *   napping      asleep in the hut (no sprite drawn).
 *   fromhut      stepping out of the hut.
 *   toball       walking toward the ball.
 *   playball     pushing/headbutting the ball, applies impulses to its physics.
 *   tochew       walking to the chew log.
 *   chewing      gnawing the chew log.
 *   tobath       walking to the sand bath.
 *   bathing      rolling around in sand (sparkles emit from items.js).
 *   totreat      walking to the treat jar after a treat is purchased.
 *   eattreat     eating that treat (applies TREAT_EFFECTS on completion).
 *
 * Stat decay runs every other frame (so a 60fps loop ≈ 30 decays/sec).
 * The autonomous-behavior picker (`pickAutonomous`) periodically looks at
 * stats and chooses what to do next when the hamster is idle.
 *
 * `addCoins` is here rather than in hud.js because most coin awards come
 * from in-game events (poop cleaned, wheel finished, ball played), and
 * keeping the bookkeeping next to those events makes the rules easier
 * to follow.
 */

import { ham, ball, view, save, drag, entities } from './state.js';
import {
  WCX, WCY, WR, BCX, BCY, HUT_X, CHEW_X, SAND_X, JAR_X,
  LADDER_X, LADDER_TOP, LADDER_BOTTOM,
  GY_TOP, GY_BOT, FBOT, feetY,
} from './layout.js';
import { TREAT_EFFECTS, HAMS, POOP_INTERVAL } from './config.js';
import { snd } from './audio.js';
import { spawnHearts, spawnCoinFly, spawnSparkles } from './particles.js';
import { tickBall, initBasket } from './items.js';
import { st } from './canvas.js';
import { persist } from './save.js';
import { onTrigger, bumpCounter, noteTreat, checkAll } from './achievements.js';
import { resetMinigame } from './minigame.js';
import { resetVisitor, getVisitorPosition } from './visitor.js';
import { resetRoomba } from './roomba.js';
import { bumpStat } from './stats.js';

// ---------- Helpers ----------

function setTgt() {
  ham.tgt = Math.random() * Math.PI * 2;
  ham.timer = 80 + Math.random() * 120;
}
setTgt();

function say(s) { st.textContent = s; }

// Position helpers used by hamPos() — each maps a "where the hamster lives
// when it's at this station" to an {x, y} in world space.
function wpos()        { return { x: WCX(),    y: WCY() + WR() - 26 }; }
function bpos()        { return { x: BCX() - 34, y: BCY() + 26 }; }
function hutPos()      { return { x: HUT_X(),  y: GY_BOT() - 10 }; }
function chewPos()     { return { x: CHEW_X(), y: GY_TOP() + 18 }; }
function sandPos()     { return { x: SAND_X(), y: GY_TOP() + 14 }; }
function jarPos()      { return { x: JAR_X() + 30, y: GY_TOP() + 20 }; }
function ballChasePos() {
  return { x: ball.x, y: Math.min(GY_BOT() - 2, ball.y + 18) };
}
// Ladder base: where the hamster stands at the foot of the ladder before
// starting the climb (and where they land when they slide back down).
function ladderBasePos() {
  return { x: LADDER_X() + 18, y: GY_BOT() - 4 };
}
function lerp2(a, b, t) { return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }; }

// Single source of truth for "where is the hamster right now". Read by the
// renderer in main.js. The function is a long switch on ham.mode because
// each mode has its own meaning of "position" — usually a lerp between the
// previous spot and a fixed target.
export function hamPos() {
  switch (ham.mode) {
    case 'onwheel':    return wpos();
    case 'climbing':   return lerp2({ x: ham.csx, y: ham.csy }, wpos(), ham.climbT);
    case 'descending': return lerp2(wpos(), { x: ham.csx, y: ham.csy }, ham.climbT);
    case 'todrink':    return lerp2({ x: ham.dsx, y: ham.dsy }, bpos(), ham.drnkT);
    case 'drinking':   return bpos();
    case 'fromdink':   return lerp2(bpos(), { x: ham.dsx, y: ham.dsy }, ham.drnkT);
    case 'tohut':      return lerp2({ x: ham.hutSX, y: ham.hutSY }, hutPos(), ham.toHutT);
    case 'napping':    return hutPos();
    case 'fromhut':    return lerp2(hutPos(), { x: ham.hutSX, y: ham.hutSY }, ham.fromHutT);
    case 'toball':     return lerp2({ x: ham.csx, y: ham.csy }, ballChasePos(), ham.toBallT);
    case 'playball':   return ballChasePos();
    case 'tochew':     return lerp2({ x: ham.csx, y: ham.csy }, chewPos(), ham.toBallT);
    case 'chewing':    return chewPos();
    case 'tobath':     return lerp2({ x: ham.csx, y: ham.csy }, sandPos(), ham.toBallT);
    case 'bathing':    return sandPos();
    case 'totreat':    return lerp2({ x: ham.csx, y: ham.csy }, jarPos(), ham.toBallT);
    case 'eattreat':   return jarPos();
    // Ladder modes share an X (the rail line) but differ in Y, which is
    // tracked in ham.ladderY (climb/slide interpolate it; perch holds it).
    case 'toLadder':         return lerp2({ x: ham.csx, y: ham.csy }, ladderBasePos(), ham.toBallT);
    case 'climbingLadder':
    case 'onLadder':
    case 'slidingDown':      return { x: LADDER_X() + 6, y: ham.ladderY };
    default:           return { x: ham.x, y: ham.y };
  }
}

// ---------- Mode entry helpers (called from input.js and pickAutonomous) ----------

const HINT = 'Click hamster · wheel · water · seed · ball · log · sand · jar';

export function goWheel() {
  if (ham.mode !== 'wander') return;
  ham.csx = ham.x; ham.csy = ham.y;
  ham.climbT = 0;
  ham.mode = 'climbing';
  ham.wTimer = 300 + Math.floor(Math.random() * 360);
  ham.runSpd = 0;
  ham.runTgt = 0.052 + Math.random() * 0.038; // each run gets a slightly different top speed
  say('Running on the wheel!');
  snd('squeak');
}

export function goDrink() {
  if (ham.mode !== 'wander') return;
  ham.dsx = ham.x; ham.dsy = ham.y;
  ham.drnkT = 0;
  ham.mode = 'todrink';
  say('Taking a sip...');
}

export function goNap() {
  if (ham.mode !== 'wander') return;
  ham.hutSX = ham.x; ham.hutSY = ham.y;
  ham.toHutT = 0;
  ham.mode = 'tohut';
  ham.napDuration = 600 + Math.floor(Math.random() * 600);
  say(HAMS[save.selected].name + ' is heading to nap...');
}

export function goBall() {
  if (ham.mode !== 'wander' || !ball.active) return;
  ham.csx = ham.x; ham.csy = ham.y;
  ham.toBallT = 0;
  ham.mode = 'toball';
  say(HAMS[save.selected].name + ' wants to play ball!');
}

export function goChew() {
  if (ham.mode !== 'wander') return;
  ham.csx = ham.x; ham.csy = ham.y;
  ham.toBallT = 0;
  ham.mode = 'tochew';
  say(HAMS[save.selected].name + ' is going to chew!');
}

export function goBath() {
  if (ham.mode !== 'wander') return;
  ham.csx = ham.x; ham.csy = ham.y;
  ham.toBallT = 0;
  ham.mode = 'tobath';
  say(HAMS[save.selected].name + ' is going for a sand bath!');
}

export function goLadder() {
  if (ham.mode !== 'wander') return;
  if (!save.owned.ladder) return;
  ham.csx = ham.x; ham.csy = ham.y;
  ham.toBallT = 0;
  ham.mode = 'toLadder';
  say(HAMS[save.selected].name + ' is heading to the ladder!');
}

export function goTreat(treatType) {
  if (ham.mode !== 'wander') return;
  ham.csx = ham.x; ham.csy = ham.y;
  ham.toBallT = 0;
  ham.mode = 'totreat';
  ham.treatT = 0;
  drag.treatType = treatType;
  say('Treat time! (' + treatType + ')');
}

// Pick a random idle micro-animation. Called from the wander block when
// nextIdle hits zero. Each idle finishes back into wander after a fixed
// number of frames; the next idle is scheduled 6-15s out so the cage
// doesn't feel like a slideshow.
function startIdle() {
  if (ham.mode !== 'wander') return;
  const types = ['yawn', 'stretch', 'lookAround'];
  ham.idleType = types[Math.floor(Math.random() * types.length)];
  ham.idleTimer = ham.idleType === 'lookAround' ? 75 : 60;
  ham.idleScale = 1;
  ham.mode = 'idle';
  ham.vx *= 0.4; ham.vy *= 0.4; // ease the wander velocity to a near-stop
}

// Triggered when the user pets the hamster.
export function petHamster() {
  if (ham.mode !== 'wander' && ham.mode !== 'happy') return;
  ham.mode = 'happy';
  ham.timer = 90 + Math.floor(Math.random() * 60);
  const p = hamPos();
  spawnHearts(p.x, p.y - 20);
  save.stats.happy = Math.min(100, save.stats.happy + 8);
  say(HAMS[save.selected].name + ' is happy! ♥');
  onTrigger('pet');
  bumpCounter('pets');
}

// Triggered when a seed is dropped onto the hamster.
export function feedSeed(seedIdx, dropX) {
  const s = entities.basketSeeds[seedIdx];
  if (!s) return;
  const p = hamPos();
  s.eaten = true;
  s.dragging = false;
  // Sunflower seeds leave a shell on the ground (the user can clean it up).
  if (s.type === 'sunflower') {
    entities.shells.push({
      x: p.x + (Math.random() - 0.5) * 24,
      y: feetY(p.y) + 4 + Math.random() * 6,
      angle: (Math.random() - 0.5) * 1.5,
    });
  }
  save.stats.hunger = Math.min(100, save.stats.hunger + 15);
  save.stats.happy  = Math.min(100, save.stats.happy + 5);
  ham.mode = 'eating';
  ham.eatTimer = 150;
  ham.dir = dropX < p.x ? -1 : 1;
  // Brief "!" bubble for the first half-second — reads as the hamster
  // reacting to the food before settling in to chew.
  ham.excitedT = 30;
  say('Nom nom nom!');
  snd('eat');
  onTrigger('feed');
  // After ~8s the basket "regenerates" the seed slot. This makes the basket
  // self-refilling without needing an explicit refill UI.
  setTimeout(() => { s.eaten = false; }, 8000);
}

// ---------- Stat-max sparkle watcher ----------

// Snapshot of last-frame stats. We fire a sparkle burst when any stat
// transitions from below 100 to exactly 100 — the "fully cared for"
// micro-celebration. Lives in a module-local; it's only meaningful as a
// single-frame diff so it doesn't belong on the save.
const _prevStats = { hunger: 0, thirst: 0, energy: 0, happy: 0, clean: 0 };
// Cooldown for the proximity-greeting hearts so the player can't spam by
// dragging the visitor and hamster close together every frame.
let _nextGreetingFrame = 0;
function checkStatMaxFlashes() {
  const s = save.stats;
  for (const key in _prevStats) {
    if (s[key] >= 100 && _prevStats[key] < 100) {
      const p = hamPos();
      spawnSparkles(p.x, p.y - 20, 10);
    }
    _prevStats[key] = s[key];
  }
}

// ---------- Coin / poop helpers ----------

export function addCoins(n, x, y) {
  save.coins += n;
  bumpStat('coinsEarned', n); // lifetime-earned counter for the Stats panel
  if (x !== undefined) spawnCoinFly(x, y, n);
  snd('coin');
  persist();
  // The coin-pop animation is triggered by hud.js by toggling a class — this
  // module avoids importing the DOM by deferring that to the HUD update.
}

export function spawnPoop() {
  // Hamster only poops when active in the cage area, not while doing chores.
  if (ham.mode !== 'wander' && ham.mode !== 'happy') return;
  const p = hamPos();
  let px = p.x + (Math.random() - 0.5) * 20;
  let py = feetY(p.y) + (Math.random() - 0.5) * 6;
  px = Math.max(80, Math.min(view.W - 120, px));
  py = Math.min(py, FBOT() - 10);
  const count = 2 + Math.floor(Math.random() * 3);
  const pellets = [];
  for (let i = 0; i < count; i++) {
    pellets.push({
      dx: (Math.random() - 0.5) * 14,
      dy: (Math.random() - 0.5) * 8,
      rx: 3.5 + Math.random() * 2,
      ry: 2 + Math.random() * 1.2,
      angle: (Math.random() - 0.5) * 0.8,
    });
  }
  entities.poops.push({ x: px, y: py, pellets, age: 0 });
  // Mess decreases cleanliness — the user can recover it by binning poops
  // or sending the hamster for a sand bath.
  save.stats.clean = Math.max(0, save.stats.clean - 3);
}

// ---------- Stats decay + autonomy ----------

// Per-frame loss, tuned so a fully neglected hamster bottoms out a stat in
// roughly 4–6 minutes. Decay only every other frame to halve the cost.
function decayStats() {
  if (view.frame % 2 !== 0) return;
  save.stats.hunger = Math.max(0, save.stats.hunger - 0.012);
  save.stats.thirst = Math.max(0, save.stats.thirst - 0.014);
  save.stats.energy = Math.max(0, save.stats.energy - 0.009);
  save.stats.happy  = Math.max(0, save.stats.happy  - 0.008);
  save.stats.clean  = Math.max(0, save.stats.clean  - 0.006);
}

// What the hamster does when left alone. Critical needs come first; if
// nothing's urgent the hamster picks a recreational activity weighted by
// how happy it is. Returning early without picking means "keep wandering".
function pickAutonomous() {
  if (save.stats.thirst < 22) return goDrink();
  if (save.stats.energy < 18) return goNap();
  if (save.stats.clean  < 22) return goBath();

  const r = Math.random();
  if (save.stats.happy < 55) {
    // Bored hamster — more likely to seek stimulation.
    if (r < 0.20 && ball.active) return goBall();
    if (r < 0.35 && save.owned.ladder) return goLadder();
    if (r < 0.55) return goChew();
    if (r < 0.78) return goWheel();
  } else {
    // Content hamster — only occasionally bothers with toys.
    if (r < 0.10) return goWheel();
    if (r < 0.15 && ball.active) return goBall();
    if (r < 0.20 && save.owned.ladder) return goLadder();
    if (r < 0.25) return goChew();
  }
}

// ---------- Reset ----------

export function resetGame() {
  ham.mode = 'wander';
  ham.x = view.W * 0.45;
  ham.y = GY_TOP() + (GY_BOT() - GY_TOP()) * 0.4;
  ham.vx = 0.8; ham.vy = 0.4;
  ham.dir = 1; ham.tgt = 0; ham.timer = 120;
  ham.bob = 0; ham.leg = 0; ham.blink = false; ham.blinkT = 90;
  ham.cheek = 0; ham.cheekD = 1;
  ham.runSpd = 0; ham.runTgt = 0; ham.wTimer = 0; ham.wAngle = 0;
  ham.csx = 0; ham.csy = 0; ham.climbT = 0;
  ham.dsx = 0; ham.dsy = 0; ham.drnkT = 0; ham.dframes = 0;
  ham.eatTimer = 0;
  ham.toHutT = 0; ham.fromHutT = 0; ham.hutSX = 0; ham.hutSY = 0;
  ham.napTimer = 0; ham.napDuration = 0;
  ham.nextNap = 1800 + Math.floor(Math.random() * 1800);
  ham.toBallT = 0; ham.ballPlayT = 0; ham.chewT = 0; ham.sandT = 0; ham.treatT = 0;
  ham.ladderT = 0; ham.ladderY = 0; ham.ladderTimer = 0;
  ham.idleType = null; ham.idleTimer = 0; ham.idleScale = 1;
  ham.nextIdle = 360 + Math.floor(Math.random() * 540);
  ham.excitedT = 0; ham.happyHopT = 0; ham.celebrationPending = false;
  ham.nextBehavior = 300;

  view.frame = 0;
  view.dayTime = 0.3;

  entities.poops = []; entities.flyingPoops = []; entities.flyingItems = [];
  entities.shells = []; entities.hearts = []; entities.sparkles = []; entities.coinFlies = [];
  entities.gifts = [];
  entities.poopTick = 0; entities.binCount = 0;

  drag.active = false; drag.seedIdx = -1; drag.jarTreat = false;
  drag.treatType = ''; drag.x = 0; drag.y = 0; drag.type = ''; drag.angle = 0;

  initBasket();
  resetMinigame();
  resetVisitor();
  resetRoomba();

  // Place the ball back in the cage and sync visibility with ownership.
  ball.x = view.W * 0.55;
  ball.y = GY_TOP() + (GY_BOT() - GY_TOP()) * 0.55;
  ball.vx = 0; ball.vy = 0; ball.spin = 0; ball.dragging = false;
  ball.active = save.owned.ball;

  setTgt();
}

// ---------- Main tick ----------

export function tick() {
  view.frame++;
  entities.poopTick++;
  view.dayTime = (view.dayTime + 0.00012) % 1;

  // Reactive feedback: tick down the brief "!" bubble (excitedT) every
  // frame regardless of mode, and watch for stats hitting their cap.
  if (ham.excitedT > 0) ham.excitedT--;
  checkStatMaxFlashes();

  // Achievement-unlock celebration — fire effects at the hamster's actual
  // render position. The flag is set by achievements.js's unlock() and
  // consumed here so the call stays in this module (avoids importing
  // hamPos into the achievement layer).
  if (ham.celebrationPending) {
    ham.celebrationPending = false;
    const cp = hamPos();
    spawnSparkles(cp.x, cp.y - 22, 16);
    ham.happyHopT = 25;
  }

  // Proximity greeting — when the player hamster and the visiting friend
  // wander close together, fire a small heart shower at the midpoint and
  // bump happiness. Cooldown of ~5 seconds prevents spam if they linger
  // near each other.
  const visPos = getVisitorPosition();
  if (visPos && view.frame > _nextGreetingFrame) {
    const p = hamPos();
    const dist = Math.hypot(visPos.x - p.x, visPos.y - p.y);
    if (dist < 60) {
      const mx = (visPos.x + p.x) / 2;
      const my = (visPos.y + p.y) / 2 - 18;
      spawnHearts(mx, my);
      save.stats.happy = Math.min(100, save.stats.happy + 4);
      _nextGreetingFrame = view.frame + 5 * 60; // 5-second cooldown
    }
  }

  if (entities.poopTick >= POOP_INTERVAL) {
    entities.poopTick = 0;
    spawnPoop();
  }

  decayStats();

  ham.nextBehavior--;
  if (ham.nextBehavior <= 0 && ham.mode === 'wander') {
    ham.nextBehavior = 480 + Math.floor(Math.random() * 420);
    pickAutonomous();
  }

  // Independently of needs, the hamster drifts toward sleepiness over time —
  // but we only force a nap if energy is already low.
  ham.nextNap--;
  if (ham.nextNap <= 0 && ham.mode === 'wander') {
    ham.nextNap = 1800 + Math.floor(Math.random() * 1800);
    if (save.stats.energy < 60) goNap();
  }

  // Periodic autosave so a refresh doesn't drop progress between coin gains.
  if (view.frame % 600 === 0) persist();

  // Once per second, re-check state-based achievements (rich, maxStats,
  // dayNight). These can't be event-driven because they depend on values
  // that drift continuously (coin count, decaying stats, day cycle).
  if (view.frame % 60 === 0) {
    // Note the day phase so the Day & Night achievement can complete. The
    // thresholds match the hud.js color cycle: bright midday vs deep night.
    if (view.dayTime >= 0.30 && view.dayTime <= 0.50) save.sawDay = true;
    if (view.dayTime >= 0.85 && view.dayTime <= 0.98) save.sawNight = true;
    checkAll();
  }

  const xL = 60, xR = view.W - 60, yT = GY_TOP(), yB = GY_BOT();

  if (ham.mode === 'wander') {
    // steer + cap speed. A drained hamster moves visibly slower so neglect
    // shows up in the *motion*, not just the bars. Threshold mirrors the
    // tired-eyes threshold in hamster.js.
    const ax = Math.cos(ham.tgt) * 0.10;
    const ay = Math.sin(ham.tgt) * 0.10;
    ham.vx += ax; ham.vy += ay;
    const spd = Math.sqrt(ham.vx * ham.vx + ham.vy * ham.vy);
    const speedCap = save.stats.energy < 25 ? ham.speed * 0.55 : ham.speed;
    if (spd > speedCap) { ham.vx = ham.vx / spd * speedCap; ham.vy = ham.vy / spd * speedCap; }
    ham.x += ham.vx; ham.y += ham.vy;
    // wall bounces — flip the velocity component that hit, then re-randomize the heading
    if (ham.x < xL) { ham.x = xL; ham.vx =  Math.abs(ham.vx); ham.tgt = Math.atan2(ham.vy,  Math.abs(ham.vx)) + (Math.random() - 0.5) * 0.6; }
    if (ham.x > xR) { ham.x = xR; ham.vx = -Math.abs(ham.vx); ham.tgt = Math.atan2(ham.vy, -Math.abs(ham.vx)) + (Math.random() - 0.5) * 0.6; }
    if (ham.y < yT) { ham.y = yT; ham.vy =  Math.abs(ham.vy); ham.tgt = Math.atan2( Math.abs(ham.vy), ham.vx) + (Math.random() - 0.5) * 0.6; }
    if (ham.y > yB) { ham.y = yB; ham.vy = -Math.abs(ham.vy); ham.tgt = Math.atan2(-Math.abs(ham.vy), ham.vx) + (Math.random() - 0.5) * 0.6; }
    if (Math.abs(ham.vx) > 0.1) ham.dir = ham.vx > 0 ? 1 : -1;
    ham.bob = Math.sin(view.frame * 0.22) * 2;

    // Happy hop: when the hamster's mood is high, occasionally do a brief
    // vertical bounce. Tweaks ham.bob to add a sin-arc spike on top of the
    // normal wander bob; resets after ~20 frames.
    if (ham.happyHopT > 0) {
      ham.happyHopT--;
      const hopT = 1 - ham.happyHopT / 20;
      ham.bob -= Math.sin(hopT * Math.PI) * 12; // negative = up
    } else if (save.stats.happy > 80 && Math.random() < 0.0007) {
      ham.happyHopT = 20;
    }

    ham.leg += spd * 0.18;
    ham.timer--;
    if (ham.timer <= 0) setTgt();

    // Idle micro-animations — only counted during wander so other modes
    // (drinking, napping, etc.) don't "use up" the timer.
    ham.nextIdle--;
    if (ham.nextIdle <= 0) startIdle();

  } else if (ham.mode === 'idle') {
    // Each idle has its own visual signature; the mode block here is just
    // bookkeeping. drawIdleOverlay() in hamster.js paints the floating
    // 'z' for yawn; everything else is conveyed through standard fields
    // (blink, dir, idleScale).
    ham.idleTimer--;
    if (ham.idleType === 'yawn') {
      ham.blink = true; // keep the eyes shut for the duration
      ham.bob = Math.sin(view.frame * 0.10) * 1.4;
    } else if (ham.idleType === 'stretch') {
      // Smooth in-out scale via sin(progress*PI) — peaks mid-stretch.
      const progress = 1 - ham.idleTimer / 60;
      ham.idleScale = 1 + Math.sin(progress * Math.PI) * 0.12;
      ham.bob = Math.sin(view.frame * 0.18) * 3;
    } else if (ham.idleType === 'lookAround') {
      // Three glance phases: left, right, then resume facing whatever the
      // velocity ends up implying after we return to wander.
      if (ham.idleTimer > 50)      ham.dir = -1;
      else if (ham.idleTimer > 25) ham.dir =  1;
      ham.bob = Math.sin(view.frame * 0.22) * 1.5;
    }
    if (ham.idleTimer <= 0) {
      ham.idleType = null;
      ham.idleScale = 1;
      ham.mode = 'wander';
      // Schedule the next idle 6-15s out so the cage isn't a slideshow.
      ham.nextIdle = 360 + Math.floor(Math.random() * 540);
      setTgt();
    }

  } else if (ham.mode === 'happy') {
    ham.vx *= 0.85; ham.vy *= 0.85;
    ham.bob = Math.sin(view.frame * 0.35) * 4;
    ham.leg += 0.15;
    ham.timer--;
    if (ham.timer <= 0) { ham.mode = 'wander'; setTgt(); say(HINT); }

  } else if (ham.mode === 'eating') {
    ham.bob = Math.sin(view.frame * 0.4) * 2;
    ham.leg += 0.08;
    ham.eatTimer--;
    if (ham.eatTimer <= 0) { ham.mode = 'wander'; setTgt(); say(HINT); }

  } else if (ham.mode === 'climbing') {
    ham.climbT += 0.024;
    ham.leg += 0.14;
    ham.dir = -1;
    if (ham.climbT >= 1) { ham.climbT = 1; ham.mode = 'onwheel'; }

  } else if (ham.mode === 'onwheel') {
    // accelerate toward target speed, then hold; squeak periodically for life
    ham.runSpd += (ham.runTgt - ham.runSpd) * 0.04;
    ham.wAngle -= ham.runSpd;
    ham.leg += ham.runSpd * 22;
    ham.bob = Math.sin(view.frame * 0.44) * 1.5;
    ham.wTimer--;
    if (view.frame % 18 === 0) snd('squeak');
    if (ham.wTimer <= 0) {
      // wind down — once nearly still, get off the wheel and award coins
      ham.runTgt *= 0.88;
      if (ham.runSpd < 0.004) {
        save.stats.happy = Math.min(100, save.stats.happy + 18);
        save.stats.energy = Math.max(0, save.stats.energy - 12);
        addCoins(3, WCX(), WCY());
        bumpCounter('wheelRuns'); // unlocks On a Roll / Wheel Warrior / Marathon
        ham.mode = 'descending';
        ham.climbT = 0;
        say('Phew! +3 💰');
      }
    }

  } else if (ham.mode === 'descending') {
    ham.climbT += 0.024;
    ham.leg += 0.10;
    if (ham.climbT >= 1) {
      ham.climbT = 1;
      ham.x = ham.csx; ham.y = ham.csy;
      ham.mode = 'wander'; setTgt(); say(HINT);
    }

  } else if (ham.mode === 'todrink') {
    ham.drnkT += 0.026;
    ham.leg += 0.13;
    ham.dir = 1;
    ham.bob = Math.sin(view.frame * 0.18) * 2;
    if (ham.drnkT >= 1) {
      ham.drnkT = 1;
      ham.mode = 'drinking';
      ham.dframes = 180;
      snd('drink');
    }

  } else if (ham.mode === 'drinking') {
    ham.dframes--;
    ham.bob = Math.sin(view.frame * 0.28) * 1.5;
    ham.leg += 0.04;
    if (ham.dframes % 30 === 0) snd('drink');
    if (ham.dframes <= 0) {
      save.stats.thirst = Math.min(100, save.stats.thirst + 45);
      ham.mode = 'fromdink';
      ham.drnkT = 0;
      say('Refreshed!');
      onTrigger('drink');
    }

  } else if (ham.mode === 'fromdink') {
    ham.drnkT += 0.026;
    ham.leg += 0.13;
    ham.dir = -1;
    if (ham.drnkT >= 1) {
      ham.drnkT = 1;
      ham.x = ham.dsx; ham.y = ham.dsy;
      ham.mode = 'wander'; setTgt(); say(HINT);
    }

  } else if (ham.mode === 'tohut') {
    ham.toHutT += 0.022;
    ham.leg += 0.12;
    ham.dir = HUT_X() > ham.x ? 1 : -1;
    if (ham.toHutT >= 1) {
      ham.toHutT = 1;
      ham.mode = 'napping';
      ham.napTimer = ham.napDuration;
      say(HAMS[save.selected].name + ' is napping... zzz');
    }

  } else if (ham.mode === 'napping') {
    ham.napTimer--;
    // Gain energy gradually rather than in a single burst at the end.
    if (ham.napTimer % 30 === 0) save.stats.energy = Math.min(100, save.stats.energy + 1.6);
    if (ham.napTimer <= 0) {
      ham.mode = 'fromhut';
      ham.fromHutT = 0;
      say(HAMS[save.selected].name + ' woke up!');
      onTrigger('nap');
      bumpCounter('naps'); // Daydreamer (10 naps)
    }

  } else if (ham.mode === 'fromhut') {
    ham.fromHutT += 0.022;
    ham.leg += 0.10;
    if (ham.fromHutT >= 1) {
      ham.fromHutT = 1;
      ham.x = ham.hutSX; ham.y = ham.hutSY;
      ham.mode = 'wander'; setTgt();
      ham.nextNap = 1800 + Math.floor(Math.random() * 1800);
      say(HINT);
    }

  } else if (ham.mode === 'toball') {
    ham.toBallT += 0.022;
    ham.leg += 0.12;
    ham.dir = ball.x > ham.x ? 1 : -1;
    if (ham.toBallT >= 1) {
      ham.toBallT = 1;
      ham.mode = 'playball';
      ham.ballPlayT = 240 + Math.floor(Math.random() * 180);
    }

  } else if (ham.mode === 'playball') {
    ham.bob = Math.sin(view.frame * 0.38) * 3;
    ham.leg += 0.16;
    ham.ballPlayT--;
    // Headbutt the ball periodically. The impulse direction follows ham.dir
    // so the ball always launches *away* from the hamster's face.
    if (ham.ballPlayT % 40 === 20) {
      ball.vx += (Math.random() - 0.5) * 4 * ham.dir;
      ball.vy -= 2.5 + Math.random();
      snd('roll');
    }
    if (ham.ballPlayT <= 0) {
      save.stats.happy = Math.min(100, save.stats.happy + 22);
      save.stats.clean = Math.max(0, save.stats.clean - 3);
      addCoins(2, ball.x, ball.y);
      ham.mode = 'wander'; setTgt(); say('Fun! +2 💰');
    }

  } else if (ham.mode === 'tochew') {
    ham.toBallT += 0.022;
    ham.leg += 0.12;
    ham.dir = CHEW_X() > ham.x ? 1 : -1;
    if (ham.toBallT >= 1) {
      ham.toBallT = 1;
      ham.mode = 'chewing';
      ham.chewT = 200 + Math.floor(Math.random() * 120);
    }

  } else if (ham.mode === 'chewing') {
    ham.bob = Math.sin(view.frame * 0.55) * 1.6;
    ham.leg += 0.04;
    ham.chewT--;
    if (ham.chewT % 18 === 0) snd('eat');
    if (ham.chewT <= 0) {
      save.stats.happy = Math.min(100, save.stats.happy + 14);
      addCoins(1, CHEW_X(), 0);
      ham.mode = 'wander'; setTgt(); say('Crunchy! +1 💰');
      onTrigger('chew');
      bumpCounter('chews'); // Wood Whisperer (20 chews)
    }

  } else if (ham.mode === 'tobath') {
    ham.toBallT += 0.022;
    ham.leg += 0.12;
    ham.dir = SAND_X() > ham.x ? 1 : -1;
    if (ham.toBallT >= 1) {
      ham.toBallT = 1;
      ham.mode = 'bathing';
      ham.sandT = 240;
      snd('splash');
    }

  } else if (ham.mode === 'bathing') {
    ham.bob = Math.sin(view.frame * 0.5) * 3;
    ham.leg += 0.18;
    ham.sandT--;
    if (ham.sandT % 50 === 0) snd('splash');
    if (ham.sandT <= 0) {
      save.stats.clean = Math.min(100, save.stats.clean + 55);
      save.stats.happy = Math.min(100, save.stats.happy + 10);
      ham.mode = 'wander'; setTgt(); say('Squeaky clean!');
      onTrigger('bath');
      bumpCounter('baths'); // Bath Lover (10 baths)
    }

  } else if (ham.mode === 'totreat') {
    ham.toBallT += 0.024;
    ham.leg += 0.12;
    ham.dir = 1;
    if (ham.toBallT >= 1) {
      ham.toBallT = 1;
      ham.mode = 'eattreat';
      ham.treatT = 140;
      snd('eat');
    }

  } else if (ham.mode === 'eattreat') {
    ham.bob = Math.sin(view.frame * 0.42) * 2;
    ham.leg += 0.06;
    ham.treatT--;
    if (ham.treatT % 18 === 0) snd('eat');
    if (ham.treatT <= 0) {
      // Apply per-treat boosts. Defaults guard against an unknown treat id
      // (e.g. if a save has a future treat type we don't know about).
      const b = TREAT_EFFECTS[drag.treatType] || { hunger: 30, happy: 15 };
      save.stats.hunger = Math.min(100, save.stats.hunger + (b.hunger || 0));
      save.stats.happy  = Math.min(100, save.stats.happy  + (b.happy  || 0));
      save.stats.thirst = Math.min(100, save.stats.thirst + (b.thirst || 0));
      const jp = jarPos();
      spawnHearts(jp.x, jp.y - 20);
      ham.mode = 'wander'; setTgt(); say('Yummy treat!');
      noteTreat(drag.treatType); // unlocks Treat Time and tracks for Food Critic
      bumpStat('treatsFed');
    }

  } else if (ham.mode === 'toLadder') {
    ham.toBallT += 0.022;
    ham.leg += 0.12;
    ham.dir = LADDER_X() > ham.x ? 1 : -1;
    if (ham.toBallT >= 1) {
      ham.toBallT = 1;
      ham.mode = 'climbingLadder';
      ham.ladderT = 0;
      ham.ladderY = LADDER_BOTTOM() - 4;
      ham.dir = 1; // facing into the cage during the climb
    }

  } else if (ham.mode === 'climbingLadder') {
    // ~83 frames (≈1.4s) for the full climb — slow enough to be readable.
    ham.ladderT += 0.012;
    ham.leg += 0.18;
    ham.ladderY = LADDER_BOTTOM() - 4 + (LADDER_TOP() - (LADDER_BOTTOM() - 4)) * ham.ladderT;
    if (ham.ladderT >= 1) {
      ham.ladderT = 1;
      ham.mode = 'onLadder';
      ham.ladderTimer = 120; // ~2s perch at the top
    }

  } else if (ham.mode === 'onLadder') {
    // Resting on the platform: gentle bob, no leg cycle.
    ham.bob = Math.sin(view.frame * 0.30) * 1.2;
    ham.ladderTimer--;
    if (ham.ladderTimer <= 0) {
      ham.mode = 'slidingDown';
    }

  } else if (ham.mode === 'slidingDown') {
    // ~17 frames (≈0.28s) to drop — fast enough to read as "wheee!"
    ham.ladderT -= 0.06;
    ham.ladderY = LADDER_BOTTOM() - 4 + (LADDER_TOP() - (LADDER_BOTTOM() - 4)) * ham.ladderT;
    // Sparkle trail behind the hamster as it slides
    if (view.frame % 3 === 0) {
      spawnHearts(LADDER_X() + 6 + (Math.random() - 0.5) * 12, ham.ladderY);
    }
    if (ham.ladderT <= 0) {
      ham.ladderT = 0;
      ham.x = ladderBasePos().x;
      ham.y = ladderBasePos().y;
      save.stats.happy = Math.min(100, save.stats.happy + 16);
      addCoins(2, LADDER_X(), LADDER_BOTTOM() - 20);
      ham.mode = 'wander'; setTgt(); say('Wheee! +2 💰');
      onTrigger('ladder'); // unlocks Top of the World
    }
  }

  // Idle micro-animations (run regardless of mode, except napping has no sprite)
  ham.blinkT--;
  if (ham.blinkT <= 0) {
    ham.blink = !ham.blink;
    ham.blinkT = ham.blink ? 5 : 60 + Math.random() * 110;
  }
  ham.cheek += ham.cheekD * 0.02;
  if (ham.cheek > 1) { ham.cheek = 1; ham.cheekD = -1; }
  if (ham.cheek < 0) { ham.cheek = 0; ham.cheekD =  1; }

  tickBall();
}
