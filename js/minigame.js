/*
 * minigame.js
 *
 * Treat Rain — a 25-second skill round. Triggered by the 🌧️ button on the
 * HUD. Treats spawn from above the cage at a steady rate and fall under
 * light gravity; the player clicks each one before it hits the ground for
 * +1 coin and a small happy/hunger boost. After the round ends, a banner
 * shows the score and the rain button enters a 90-second cooldown so it
 * can't be farmed.
 *
 * State machine (single `state` var):
 *   idle      — nothing happening (button enabled, or showing ⏳ on cooldown)
 *   active    — treats falling, click-to-catch
 *   ending    — score banner shown, remaining treats finish their fall
 *
 * Coordinates: treats are drawn directly onto the main canvas in
 * canvas-logical pixels. They use the existing drawSeed renderer so any
 * seed/treat type from items.js works without new sprites.
 *
 * Click routing: input.js calls tryCatchAt() *before* its normal hit-test
 * cascade. A successful catch returns true and the rest of handleClick is
 * skipped. Misses fall through so the player can still pet/feed during a
 * round (though most clicks during active play will be aimed at treats).
 */

import { ct } from './canvas.js';
import { view, save } from './state.js';
import { snd } from './audio.js';
import { spawnSparkles, spawnCoinFly } from './particles.js';
import { drawSeed } from './items.js';
import { persist } from './save.js';
import { onTrigger } from './achievements.js';
import { setIfHigher } from './stats.js';

const ROUND_FRAMES    = 25 * 60; // 25 seconds at 60fps
const COOLDOWN_FRAMES = 90 * 60; // 90 seconds between rounds
const SPAWN_INTERVAL  = 30;      // frames between spawns (~0.5s)
const TREAT_TYPES     = ['carrot', 'apple', 'cucumber', 'cookie', 'sunflower', 'millet'];

let state        = 'idle';
let roundStart   = 0;
let lastSpawn    = 0;
let cooldownEnd  = 0;
let score        = 0;
let endingTimer  = 0;
const treats     = [];

function spawnTreat() {
  const type = TREAT_TYPES[Math.floor(Math.random() * TREAT_TYPES.length)];
  treats.push({
    x: 60 + Math.random() * (view.W - 120),
    y: 40,
    // Slight horizontal drift so treats don't all fall in straight lines.
    vx: (Math.random() - 0.5) * 0.6,
    vy: 1.5 + Math.random() * 1.0,
    type,
    angle: 0,
    spin: (Math.random() - 0.5) * 0.08,
    caught: false,
    missed: false,
    fade: 1,
  });
}

// ---------- Public API for HUD / input wiring ----------

export function isMinigameActive()    { return state === 'active'; }
export function isMinigameRunning()   { return state !== 'idle'; }
export function isMinigameOnCooldown(){ return view.frame < cooldownEnd; }

export function minigameCooldownSec() {
  return Math.max(0, Math.ceil((cooldownEnd - view.frame) / 60));
}

// Called from the HUD button. Refuses to start when already running or on
// cooldown — the latter plays a "rejected" buzz so the player gets feedback.
export function startTreatRain() {
  if (state !== 'idle') return;
  if (isMinigameOnCooldown()) {
    snd('reject');
    return;
  }
  state = 'active';
  roundStart = view.frame;
  lastSpawn  = view.frame;
  score = 0;
  treats.length = 0;
  snd('buy');
  onTrigger('treatRain'); // first-round achievement
}

// Reset on screen transitions so a half-finished round doesn't carry over
// when the player picks a different hamster.
export function resetMinigame() {
  state = 'idle';
  treats.length = 0;
  score = 0;
  cooldownEnd = 0;
}

// ---------- Per-frame tick ----------

export function tickMinigame() {
  if (state === 'idle') return;

  if (state === 'active') {
    if (view.frame - lastSpawn >= SPAWN_INTERVAL) {
      lastSpawn = view.frame;
      spawnTreat();
    }
    advanceTreats();
    if (view.frame - roundStart >= ROUND_FRAMES) {
      endRound();
    }
  } else if (state === 'ending') {
    advanceTreats();
    endingTimer--;
    if (endingTimer <= 0) {
      state = 'idle';
      treats.length = 0;
    }
  }
}

// Shared physics step — runs in both active and ending states so the few
// treats still in the air at the buzzer finish their fall gracefully.
function advanceTreats() {
  for (const t of treats) {
    if (t.caught || t.missed) {
      // already triggered — fade out the visual
      t.fade -= 0.08;
      continue;
    }
    t.x += t.vx;
    t.y += t.vy;
    t.vy += 0.04; // light gravity
    t.angle += t.spin;
    if (t.y > view.H - 40) t.missed = true;
  }
  // Drop fully-faded entries to keep the array small.
  for (let i = treats.length - 1; i >= 0; i--) {
    if (treats[i].fade <= 0) treats.splice(i, 1);
  }
}

function endRound() {
  state = 'ending';
  endingTimer = 180; // 3 seconds of score banner
  cooldownEnd = view.frame + COOLDOWN_FRAMES;
  if (score > 0) {
    save.coins += score;
    // Caught treats also satisfy the hamster a little — they fell into the
    // cage, after all. Capped so a great round can't max stats from zero.
    save.stats.happy  = Math.min(100, save.stats.happy  + Math.min(40, score * 2));
    save.stats.hunger = Math.min(100, save.stats.hunger + Math.min(20, score));
    persist();
    snd('coin');
  }
  // Achievement: 25+ in a single round.
  if (score >= 25) onTrigger('treatStorm');
  setIfHigher('bestRain', score);
}

// ---------- Click handler (called from input.js) ----------

export function tryCatchAt(mx, my) {
  if (state !== 'active') return false;
  for (const t of treats) {
    if (t.caught || t.missed) continue;
    if (Math.hypot(mx - t.x, my - t.y) < 18) {
      t.caught = true;
      score++;
      spawnSparkles(t.x, t.y, 4);
      spawnCoinFly(t.x, t.y, 1);
      snd('eat');
      return true;
    }
  }
  return false;
}

// ---------- Render (called from main.js's draw loop) ----------

export function drawMinigame() {
  if (state === 'idle') return;

  // Falling/caught treats. Drawn at scale 1.6 so they're easier to click.
  for (const t of treats) {
    let alpha;
    if (t.caught) alpha = t.fade;
    else if (t.missed) alpha = t.fade * 0.5;
    else alpha = 1;
    ct.save();
    ct.globalAlpha = Math.max(0, alpha);
    drawSeed(ct, t.x, t.y, t.type, t.angle, 1.6);
    if (t.caught) {
      // expanding sparkle ring as the treat fades — emphasises the catch
      ct.strokeStyle = `rgba(255,220,80,${Math.max(0, t.fade)})`;
      ct.lineWidth = 2;
      ct.beginPath();
      ct.arc(t.x, t.y, 14 + (1 - t.fade) * 10, 0, Math.PI * 2);
      ct.stroke();
    }
    ct.restore();
  }

  // Banner at top — different copy per state.
  if (state === 'active') {
    const elapsed = view.frame - roundStart;
    const remain = Math.max(0, Math.ceil((ROUND_FRAMES - elapsed) / 60));
    drawBanner(`🌧️ Treat Rain · ${remain}s · ${score} caught`);
  } else if (state === 'ending') {
    drawBanner(`Round over · Caught ${score} · +${score}💰`);
  }
}

function drawBanner(text) {
  const bw = 320, bh = 32;
  const bx = view.W / 2 - bw / 2;
  const by = 50;
  ct.save();
  ct.fillStyle = 'rgba(60, 35, 15, 0.85)';
  // roundRect is widely supported in modern browsers; this game already
  // requires ES modules so we don't worry about the fallback case.
  ct.beginPath();
  if (typeof ct.roundRect === 'function') {
    ct.roundRect(bx, by, bw, bh, 14);
  } else {
    ct.rect(bx, by, bw, bh);
  }
  ct.fill();
  ct.fillStyle = '#fff';
  ct.font = 'bold 13px sans-serif';
  ct.textAlign = 'center';
  ct.textBaseline = 'middle';
  ct.fillText(text, view.W / 2, by + bh / 2);
  ct.restore();
}
