/*
 * roomba.js
 *
 * 掃地機器人 — autonomous cleaning bot. Once purchased from the shop
 * (toys tab), wanders the cage floor and auto-cleans poops + shells it
 * gets close to.
 *
 * Each auto-clean awards the same +1 coin and the same cleanliness boost
 * as a manual click — the 120-coin Roomba purchase pays back over time.
 * Also bumps the `cleaned` counter so Tidy / Janitor achievements
 * continue to accumulate passively while the bot works.
 *
 * State (module-local — Roomba isn't on `ham`/`save` because it's
 * orthogonal to the hamster and doesn't need to persist its position):
 *   active       — mirrors save.owned.roomba; flips on purchase mid-session
 *   x, y         — position on the cage floor
 *   vx, vy       — current velocity
 *   angle        — facing direction (sensor eye), eased toward velocity
 *   spinT        — frames remaining of the post-clean spin animation
 *   cooldown     — frames between cleans (prevents zoomy pellet-vacuum)
 *   wanderTimer  — frames until the next random heading change
 *   target       — { kind: 'poop'|'shell', ref } or null
 */

import { ct } from './canvas.js';
import { view, save, entities } from './state.js';
import { GY_TOP, GY_BOT } from './layout.js';
import { snd } from './audio.js';
import { bumpCounter } from './achievements.js';
import { spawnSparkles, spawnCoinFly } from './particles.js';
import { bumpStat } from './stats.js';
import { persist } from './save.js';

const SPEED            = 0.55;
const SENSE_RADIUS     = 160;
const CLEAN_RADIUS     = 18;
const SPIN_FRAMES      = 30;
const COOLDOWN_FRAMES  = 60;
const WANDER_MIN       = 90;
const WANDER_MAX       = 210;

let active = false;
let x = 0, y = 0;
let vx = 0, vy = 0;
let angle = 0;
let spinT = 0;
let cooldown = 0;
let wanderTimer = 0;
let target = null;

// Called from behavior.js's resetGame so a returning player gets a clean
// roomba state at the start of each session.
export function resetRoomba() {
  active = !!save.owned.roomba;
  x = view.W * 0.40;
  y = (GY_TOP() + GY_BOT()) / 2;
  vx = SPEED; vy = 0;
  angle = 0;
  spinT = 0;
  cooldown = 0;
  wanderTimer = 0;
  target = null;
}

function nearest(arr) {
  let best = null, bestD = SENSE_RADIUS;
  for (const it of arr) {
    const d = Math.hypot(it.x - x, it.y - y);
    if (d < bestD) { best = it; bestD = d; }
  }
  return best;
}

function clean(item, kind) {
  if (kind === 'poop') {
    const idx = entities.poops.indexOf(item);
    if (idx < 0) return;
    entities.flyingPoops.push({ sx: item.x, sy: item.y, pellets: item.pellets, t: 0 });
    entities.poops.splice(idx, 1);
    save.stats.clean = Math.min(100, save.stats.clean + 4);
  } else {
    const idx = entities.shells.indexOf(item);
    if (idx < 0) return;
    entities.flyingItems.push({ sx: item.x, sy: item.y, angle: item.angle, t: 0 });
    entities.shells.splice(idx, 1);
    save.stats.clean = Math.min(100, save.stats.clean + 2);
  }
  // +1 coin reward per clean — matches the manual click reward so the
  // 120-coin Roomba investment pays back over time.
  save.coins += 1;
  bumpStat('coinsEarned', 1);
  spawnCoinFly(x, y - 8, 1);
  entities.binCount = (entities.binCount || 0) + 1;
  bumpCounter('cleaned');
  spawnSparkles(x, y - 4, 5);
  spinT = SPIN_FRAMES;
  cooldown = COOLDOWN_FRAMES;
  target = null;
  snd('coin');
  persist();
}

export function tickRoomba() {
  // Detect just-purchased: when save.owned.roomba flips true mid-session,
  // initialize position. Without this, a freshly-bought roomba would
  // start at (0,0) until the next resetGame.
  const wasActive = active;
  active = !!save.owned.roomba;
  if (active && !wasActive) resetRoomba();
  if (!active) return;

  // Spin animation locks the bot in place — it just rotates, looking like
  // it's processing the cleaned item. No movement during this window.
  if (spinT > 0) {
    spinT--;
    angle += 0.3;
    return;
  }
  if (cooldown > 0) cooldown--;

  // Acquire / verify target
  if (target) {
    const arr = target.kind === 'poop' ? entities.poops : entities.shells;
    if (!arr.includes(target.ref)) target = null; // hand-cleaned / disappeared
  }
  if (!target && cooldown <= 0) {
    const p = nearest(entities.poops);
    const s = nearest(entities.shells);
    // Pick whichever is closer (poops usually take priority since they
    // accumulate faster and dirty the stat).
    if (p && (!s || Math.hypot(p.x - x, p.y - y) <= Math.hypot(s.x - x, s.y - y))) {
      target = { kind: 'poop', ref: p };
    } else if (s) {
      target = { kind: 'shell', ref: s };
    }
  }

  // Drive toward target, or wander if nothing in sight
  if (target && cooldown <= 0) {
    const dx = target.ref.x - x;
    const dy = target.ref.y - y;
    const d  = Math.hypot(dx, dy);
    if (d < CLEAN_RADIUS) {
      clean(target.ref, target.kind);
      return;
    }
    vx = (dx / d) * SPEED;
    vy = (dy / d) * SPEED;
  } else {
    wanderTimer--;
    if (wanderTimer <= 0) {
      const ang = Math.random() * Math.PI * 2;
      vx = Math.cos(ang) * SPEED;
      vy = Math.sin(ang) * SPEED;
      wanderTimer = WANDER_MIN + Math.random() * (WANDER_MAX - WANDER_MIN);
    }
  }

  x += vx;
  y += vy;

  // Floor bounds — same wander zone as the hamster, slightly shrunk so
  // the bot doesn't bump the cage walls too dramatically.
  const xL = 60, xR = view.W - 60;
  const yT = GY_TOP() + 8, yB = GY_BOT() - 4;
  if (x < xL) { x = xL; vx =  Math.abs(vx); wanderTimer = 0; }
  if (x > xR) { x = xR; vx = -Math.abs(vx); wanderTimer = 0; }
  if (y < yT) { y = yT; vy =  Math.abs(vy); wanderTimer = 0; }
  if (y > yB) { y = yB; vy = -Math.abs(vy); wanderTimer = 0; }

  // Ease the visual angle toward actual heading. Without easing, the
  // sensor eye snaps abruptly when wander direction changes.
  const targetAngle = Math.atan2(vy, vx);
  let da = targetAngle - angle;
  while (da >  Math.PI) da -= Math.PI * 2;
  while (da < -Math.PI) da += Math.PI * 2;
  angle += da * 0.10;
}

export function drawRoomba() {
  if (!active) return;
  ct.save();
  ct.translate(x, y);

  // Drop shadow on the floor underneath.
  ct.fillStyle = 'rgba(0,0,0,0.22)';
  ct.beginPath();
  ct.ellipse(0, 9, 14, 4, 0, 0, Math.PI * 2);
  ct.fill();

  // Body — dark matte disc with a slightly lighter inner ring.
  ct.fillStyle = '#3a4048';
  ct.beginPath();
  ct.arc(0, 0, 13, 0, Math.PI * 2);
  ct.fill();
  ct.strokeStyle = '#5a6068';
  ct.lineWidth = 1.5;
  ct.beginPath();
  ct.arc(0, 0, 10, 0, Math.PI * 2);
  ct.stroke();

  // Center indicator. Pulses cyan during the post-clean spin so cleans
  // read clearly even in a quick glance.
  if (spinT > 0) {
    const k = spinT / SPIN_FRAMES;
    ct.fillStyle = `rgba(120,240,255,${(0.4 + k * 0.5).toFixed(2)})`;
    ct.beginPath();
    ct.arc(0, 0, 6, 0, Math.PI * 2);
    ct.fill();
  } else {
    ct.fillStyle = '#7a8088';
    ct.beginPath();
    ct.arc(0, 0, 2.5, 0, Math.PI * 2);
    ct.fill();
  }

  // Sensor eye — small dot that rotates around the rim, pointing where
  // the bot is heading. Bright when active, dim when on cooldown.
  ct.fillStyle = (cooldown > 0 || spinT > 0) ? '#5af0ff' : '#80c0ff';
  ct.beginPath();
  ct.arc(Math.cos(angle) * 7, Math.sin(angle) * 7, 2.4, 0, Math.PI * 2);
  ct.fill();

  ct.restore();
}
