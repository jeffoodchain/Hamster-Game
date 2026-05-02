/*
 * visitor.js
 *
 * A friend hamster — one of the HAMS the player isn't currently playing as
 * — occasionally wanders into the cage, hangs out for ~30s, then walks
 * back out. While the visitor is present, the active hamster gets a small
 * continuous happiness boost ("a friend stopped by to say hi"). It's the
 * first multi-actor moment in the game.
 *
 * State machine:
 *   idle      — nobody's here; nextVisitFrame counts down to the next visit
 *   entering  — walking onto the cage from one of the side edges
 *   visiting  — free-wandering inside the cage like the player hamster
 *   leaving   — heading back to the nearest edge to exit
 *
 * Visit cadence:
 *   First visit after entering the play screen: 90–150 seconds (so a new
 *     player is likely to actually witness one in their first session).
 *   Subsequent visits: every 5–10 minutes.
 *
 * Rendering: reuses drawFront() from hamster.js with the new opts argument
 * (isVisitor=true so dirt/tired/cosmetic decorations are suppressed). A
 * little 👋 indicator floats above the visitor's head so it's obvious which
 * one is the guest.
 */

import { ct, st } from './canvas.js';
import { view, save, entities } from './state.js';
import { HAMS } from './config.js';
import { drawFront } from './hamster.js';
import { GY_TOP, GY_BOT } from './layout.js';
import { onTrigger } from './achievements.js';
import { spawnSparkles, spawnHearts, spawnCoinFly } from './particles.js';
import { bumpStat } from './stats.js';
import { snd } from './audio.js';
import { persist } from './save.js';

const VISIT_DURATION_FRAMES        = 30 * 60;       // ~30 seconds in-cage time
const VISIT_INTERVAL_MIN_FRAMES    = 5  * 60 * 60;  // 5 minutes between visits (min)
const VISIT_INTERVAL_MAX_FRAMES    = 10 * 60 * 60;  // 10 minutes (max)
const FIRST_VISIT_MIN_FRAMES       = 90 * 60;       // 1.5 minutes for the first one
const FIRST_VISIT_MAX_FRAMES       = 150 * 60;      // 2.5 minutes

let state = 'idle';
let nextVisitFrame = -1;
let firstVisitDone = false;

// Cooldown between automatic proximity-greeting bursts so they don't
// spam when the player and visitor mill around together.
let nextGreetingFrame = 0;

const v = {
  hamIdx: 0,
  x: 0, y: 0,
  vx: 0, vy: 0,
  dir: 1,
  // Brief mode timers for player interactions:
  //   happyT — pet by the player (hearts pop)
  //   eatT   — fed a seed by the player (eats briefly, gives back coin gift)
  happyT: 0, eatT: 0,
  bob: 0, leg: 0,
  blink: false, blinkT: 90,
  cheek: 0, cheekD: 1,
  tgt: 0, timer: 120,
  lifeTimer: 0,
};

// Public state queries — used by input.js (hit-test) and behavior.js
// (proximity greeting). Returns null when there's no visitor on screen.
export function getVisitorPosition() {
  if (state === 'idle') return null;
  return { x: v.x, y: v.y, hamIdx: v.hamIdx };
}

export function isVisitorClickable() {
  // Don't accept interactions while entering/leaving (off-screen) or
  // already in a pet/eat animation.
  return state === 'visiting' && v.happyT <= 0 && v.eatT <= 0;
}

// Click on the visitor → pet them. Hearts pop above their head; both
// hamsters get a little happiness from the social moment.
export function petVisitor() {
  if (!isVisitorClickable()) return false;
  v.happyT = 90;
  v.vx *= 0.4; v.vy *= 0.4; // slow down so they're "receiving" the pet
  spawnHearts(v.x, v.y - 22);
  save.stats.happy = Math.min(100, save.stats.happy + 6);
  st.textContent = `${HAMS[v.hamIdx].name} loves the attention! ♥`;
  onTrigger('petVisitor'); // unlocks Best Friends achievement
  return true;
}

// Drag a seed onto the visitor → feed them. Brief eating animation,
// then they leave a small coin gift behind as a thank-you.
export function feedVisitor(seedType) {
  if (!isVisitorClickable()) return false;
  v.eatT = 110;
  v.vx *= 0.3; v.vy *= 0.3;
  spawnHearts(v.x, v.y - 22);
  // Coin gift: 5 for a basic seed, 8 for a fancy treat. Bumps lifetime
  // earned the same way as any other coin gain.
  const reward = (seedType === 'cake' || seedType === 'cookie' || seedType === 'apple') ? 8 : 5;
  save.coins += reward;
  bumpStat('coinsEarned', reward);
  spawnCoinFly(v.x, v.y - 12, reward);
  snd('coin');
  persist();
  st.textContent = `Friend gift: +${reward}💰`;
  onTrigger('feedVisitor'); // unlocks Generous achievement
  return true;
}

function pickRandomVisitor() {
  // Any hamster other than the active one. We always have ≥5 candidates.
  const others = HAMS.map((_, i) => i).filter(i => i !== save.selected);
  return others[Math.floor(Math.random() * others.length)];
}

function scheduleNext() {
  const min = firstVisitDone ? VISIT_INTERVAL_MIN_FRAMES : FIRST_VISIT_MIN_FRAMES;
  const max = firstVisitDone ? VISIT_INTERVAL_MAX_FRAMES : FIRST_VISIT_MAX_FRAMES;
  nextVisitFrame = view.frame + min + Math.floor(Math.random() * (max - min));
}

// Called from behavior.js's resetGame so a half-finished visit doesn't
// carry over when the player switches hamsters.
export function resetVisitor() {
  state = 'idle';
  firstVisitDone = false;
  scheduleNext();
}

function startVisit() {
  v.hamIdx = pickRandomVisitor();
  // Enter from a random side at a random altitude inside the wander zone.
  const fromLeft = Math.random() < 0.5;
  v.x = fromLeft ? -40 : view.W + 40;
  v.y = GY_TOP() + Math.random() * (GY_BOT() - GY_TOP());
  v.dir = fromLeft ? 1 : -1;
  v.vx = v.dir * 0.85;
  v.vy = 0;
  v.bob = 0; v.leg = 0;
  v.blink = false; v.blinkT = 90;
  v.cheek = 0; v.cheekD = 1;
  v.tgt = 0;
  v.timer = 120;
  v.lifeTimer = VISIT_DURATION_FRAMES;
  state = 'entering';
  st.textContent = `${HAMS[v.hamIdx].name} came to visit! 👋`;
  onTrigger('visitor');
  bumpStat('visitorsReceived');
  firstVisitDone = true;
}

// ---------- Per-frame tick ----------

export function tickVisitor() {
  if (nextVisitFrame === -1) scheduleNext();

  if (state === 'idle') {
    if (view.frame >= nextVisitFrame) startVisit();
    return;
  }

  // Animation tickers run in every non-idle state.
  v.blinkT--;
  if (v.blinkT <= 0) {
    v.blink = !v.blink;
    v.blinkT = v.blink ? 5 : 60 + Math.random() * 110;
  }
  v.cheek += v.cheekD * 0.02;
  if (v.cheek > 1) { v.cheek = 1; v.cheekD = -1; }
  if (v.cheek < 0) { v.cheek = 0; v.cheekD =  1; }

  if (state === 'entering') {
    v.x += v.vx;
    v.bob = Math.sin(view.frame * 0.22) * 2;
    v.leg += 0.18;
    // Once clearly inside the cage, switch to free-wandering. Sparkles to
    // mark the arrival the moment the friend is fully visible.
    if ((v.dir === 1 && v.x > 100) || (v.dir === -1 && v.x < view.W - 100)) {
      state = 'visiting';
      v.tgt = Math.random() * Math.PI * 2;
      v.timer = 80 + Math.random() * 120;
      spawnSparkles(v.x, v.y - 10, 5);
    }
    return;
  }

  if (state === 'visiting') {
    // Pet/eat micro-animations pause the wander so the visitor visibly
    // pauses to receive the interaction. Hearts/sparkles continue.
    if (v.happyT > 0) {
      v.happyT--;
      v.bob = Math.sin(view.frame * 0.30) * 3;
      v.leg += 0.10;
      // Re-spawn a heart every 25 frames during the pet so the effect
      // lingers visibly through the whole timer.
      if (v.happyT === 60 || v.happyT === 30) spawnHearts(v.x, v.y - 22);
      // Still let the lifeTimer count down so visit length is honored.
      v.lifeTimer--;
      return;
    }
    if (v.eatT > 0) {
      v.eatT--;
      v.bob = Math.sin(view.frame * 0.40) * 2;
      v.leg += 0.05;
      v.lifeTimer--;
      return;
    }

    // Same wander integration as the main hamster, but with its own state.
    const ax = Math.cos(v.tgt) * 0.10;
    const ay = Math.sin(v.tgt) * 0.10;
    v.vx += ax; v.vy += ay;
    const spd = Math.sqrt(v.vx * v.vx + v.vy * v.vy);
    const maxSpd = 0.9;
    if (spd > maxSpd) { v.vx = v.vx / spd * maxSpd; v.vy = v.vy / spd * maxSpd; }
    v.x += v.vx;
    v.y += v.vy;

    const xL = 60, xR = view.W - 60, yT = GY_TOP(), yB = GY_BOT();
    if (v.x < xL) { v.x = xL; v.vx =  Math.abs(v.vx); v.tgt = Math.atan2(v.vy,  Math.abs(v.vx)) + (Math.random() - 0.5) * 0.6; }
    if (v.x > xR) { v.x = xR; v.vx = -Math.abs(v.vx); v.tgt = Math.atan2(v.vy, -Math.abs(v.vx)) + (Math.random() - 0.5) * 0.6; }
    if (v.y < yT) { v.y = yT; v.vy =  Math.abs(v.vy); v.tgt = Math.atan2( Math.abs(v.vy), v.vx) + (Math.random() - 0.5) * 0.6; }
    if (v.y > yB) { v.y = yB; v.vy = -Math.abs(v.vy); v.tgt = Math.atan2(-Math.abs(v.vy), v.vx) + (Math.random() - 0.5) * 0.6; }

    if (Math.abs(v.vx) > 0.1) v.dir = v.vx > 0 ? 1 : -1;
    v.bob = Math.sin(view.frame * 0.22) * 2;
    v.leg += spd * 0.18;
    v.timer--;
    if (v.timer <= 0) {
      v.tgt = Math.random() * Math.PI * 2;
      v.timer = 80 + Math.random() * 120;
    }

    // Friend-bonus: small continuous happy boost while the visitor is here.
    if (view.frame % 30 === 0) {
      save.stats.happy = Math.min(100, save.stats.happy + 0.5);
    }

    v.lifeTimer--;
    if (v.lifeTimer <= 0) {
      // Pick the closer side to walk out through — feels natural rather
      // than arbitrary.
      v.dir = v.x < view.W / 2 ? -1 : 1;
      v.vx = v.dir * 0.9;
      v.vy = 0;
      state = 'leaving';
      st.textContent = `${HAMS[v.hamIdx].name} is heading home... 👋`;
    }
    return;
  }

  if (state === 'leaving') {
    v.x += v.vx;
    v.bob = Math.sin(view.frame * 0.22) * 2;
    v.leg += 0.18;
    if (v.x < -50 || v.x > view.W + 50) {
      // Drop a goodbye gift on the floor at the last on-screen position.
      // Player can click it to claim a small random coin reward.
      const giftX = Math.max(80, Math.min(view.W - 80, v.dir > 0 ? view.W - 60 : 60));
      const giftY = GY_BOT() - 8;
      entities.gifts = entities.gifts || [];
      entities.gifts.push({ x: giftX, y: giftY, hamIdx: v.hamIdx, t: 0 });
      state = 'idle';
      scheduleNext();
    }
  }
}

// ---------- Render ----------

export function drawVisitor() {
  if (state === 'idle') return;
  drawFront(
    v.x, v.y, v.dir, v.bob, v.blink, v.cheek,
    /* drinking */  false,
    /* eatAnim */   v.eatT > 0,
    /* happy */     v.happyT > 0,
    /* chewing */   false,
    { hamIdx: v.hamIdx, leg: v.leg, isVisitor: true },
  );
  // Floating wave indicator. Drawn with a stroke as well as a fill so it
  // stays readable against any background tint (day/night).
  const bobOff = Math.sin(view.frame * 0.10) * 2;
  ct.font = '16px sans-serif';
  ct.textAlign = 'center';
  ct.lineWidth = 2;
  ct.strokeStyle = 'rgba(60,40,20,0.6)';
  ct.fillStyle = '#fff';
  ct.strokeText('👋', v.x + 28, v.y - 30 + bobOff);
  ct.fillText('👋',   v.x + 28, v.y - 30 + bobOff);
}
