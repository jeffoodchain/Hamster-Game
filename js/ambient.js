/*
 * ambient.js
 *
 * Atmospheric, non-interactive critters that drift through the cage to make
 * the world feel alive. They're spawned and despawned based on the time of
 * day:
 *   - Butterflies (3 in flight at peak) appear during the day. They drift
 *     in from one edge, bob with a sine-modulated path, and exit through
 *     the opposite edge. Wing flap is a fast scaling animation.
 *   - Fireflies (up to 6) appear at night. They wander randomly in a small
 *     box, pulsing their glow with a sine wave. They have a finite lifespan
 *     and fade out before being recycled.
 *
 * Nothing here interacts with gameplay — it's pure window dressing layered
 * between habitat items and the hamster sprite. Cheap to run: the per-frame
 * cost is bounded by the small population caps.
 */

import { ct } from './canvas.js';
import { view } from './state.js';

// Honor the user's OS-level "reduced motion" preference: skip the
// continuous ambient creatures (they're never essential to gameplay,
// only mood) but keep the rendering machinery in place in case the
// preference flips later (some OSes can change it on the fly).
const reducedMotion = !!(window.matchMedia
  && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

const butterflies = [];
const fireflies = [];

const BUTTERFLY_COLORS = ['#ff8aa0', '#ffe080', '#a0c4ff', '#ffaa50', '#c890e0'];

function spawnButterfly() {
  // Enter from a random side at a random altitude in the upper half of the cage.
  const fromLeft = Math.random() < 0.5;
  butterflies.push({
    x: fromLeft ? -20 : view.W + 20,
    y: 80 + Math.random() * (view.H * 0.42),
    vx: (fromLeft ? 1 : -1) * (0.4 + Math.random() * 0.6),
    bob: Math.random() * Math.PI * 2,    // sine offset for vertical drift
    flap: Math.random() * Math.PI * 2,   // wing-flap phase
    color: BUTTERFLY_COLORS[Math.floor(Math.random() * BUTTERFLY_COLORS.length)],
    life: 0,
  });
}

function spawnFirefly() {
  fireflies.push({
    x: 60 + Math.random() * (view.W - 120),
    y: 100 + Math.random() * (view.H * 0.45),
    vx: (Math.random() - 0.5) * 0.3,
    vy: (Math.random() - 0.5) * 0.2,
    pulse: Math.random() * Math.PI * 2, // independent glow pulse per firefly
    life: 0,
    maxLife: 240 + Math.random() * 240,
  });
}

// `view.dayTime` runs 0..1: dawn → day → dusk → night. Two windows here
// match (loosely) the color overlay computed in hud.js.
function isDay()   { return view.dayTime > 0.20 && view.dayTime < 0.60; }
function isNight() { return view.dayTime > 0.75 || view.dayTime < 0.10; }

export function tickAmbient() {
  // Reduced-motion users get a still cage — no fluttering creatures at all.
  if (reducedMotion) return;

  // Butterflies — keep ~3 in flight during the day. Spawning is throttled
  // so we don't get a sudden swarm right after the day phase begins.
  if (isDay() && butterflies.length < 3 && view.frame % 90 === 0) {
    spawnButterfly();
  }
  for (let i = butterflies.length - 1; i >= 0; i--) {
    const b = butterflies[i];
    b.x += b.vx;
    b.bob += 0.18;
    b.y += Math.sin(b.bob) * 0.6; // gentle vertical bob
    b.flap += 0.4;
    b.life++;
    // Exit conditions: off-screen, very old, or day phase ended.
    if (b.x < -30 || b.x > view.W + 30 || b.life > 1200 || !isDay()) {
      butterflies.splice(i, 1);
    }
  }

  // Fireflies — slowly accumulate up to 6 at night. They wander on a
  // damped random walk; if velocity drifts too high we clamp it to keep
  // motion gentle.
  if (isNight() && fireflies.length < 6 && view.frame % 60 === 0) {
    spawnFirefly();
  }
  for (let i = fireflies.length - 1; i >= 0; i--) {
    const f = fireflies[i];
    f.x += f.vx;
    f.y += f.vy;
    f.vx += (Math.random() - 0.5) * 0.04;
    f.vy += (Math.random() - 0.5) * 0.04;
    if (f.vx >  0.4) f.vx =  0.4;
    if (f.vx < -0.4) f.vx = -0.4;
    if (f.vy >  0.3) f.vy =  0.3;
    if (f.vy < -0.3) f.vy = -0.3;
    f.pulse += 0.05;
    f.life++;
    if (f.life > f.maxLife || !isNight()) fireflies.splice(i, 1);
  }
}

export function drawAmbient() {
  // ---------- Butterflies ----------
  for (const b of butterflies) {
    ct.save();
    ct.translate(b.x, b.y);
    // Wings open and close — sin(flap) compressed to 0..1, then scaled.
    const wingScale = 0.4 + Math.abs(Math.sin(b.flap)) * 0.6;
    ct.fillStyle = b.color;
    // body
    ct.fillRect(-1, -3, 2, 7);
    // wings (two ellipses, mirror-tilted)
    ct.beginPath();
    ct.ellipse(-4, -1, 4 * wingScale, 6, -0.3, 0, Math.PI * 2);
    ct.fill();
    ct.beginPath();
    ct.ellipse(4, -1, 4 * wingScale, 6, 0.3, 0, Math.PI * 2);
    ct.fill();
    // tiny highlight dot on each wing for that "spotted butterfly" feel
    ct.fillStyle = 'rgba(255,255,255,0.6)';
    ct.beginPath(); ct.arc(-4, -1, 1, 0, Math.PI * 2); ct.fill();
    ct.beginPath(); ct.arc( 4, -1, 1, 0, Math.PI * 2); ct.fill();
    ct.restore();
  }

  // ---------- Fireflies ----------
  for (const f of fireflies) {
    // Glow brightness pulses; alpha also fades in/out at the start/end of life.
    const pulseGlow = (Math.sin(f.pulse) + 1) * 0.5;
    const lifeFade = Math.min(1, f.life / 30) * Math.min(1, (f.maxLife - f.life) / 30);
    const alpha = lifeFade * (0.4 + pulseGlow * 0.6);
    ct.save();
    ct.globalAlpha = alpha;
    // soft glow
    const grd = ct.createRadialGradient(f.x, f.y, 0, f.x, f.y, 14);
    grd.addColorStop(0,    'rgba(255,250,160,0.9)');
    grd.addColorStop(0.4,  'rgba(255,224,80,0.3)');
    grd.addColorStop(1,    'rgba(255,224,80,0)');
    ct.fillStyle = grd;
    ct.beginPath();
    ct.arc(f.x, f.y, 14, 0, Math.PI * 2);
    ct.fill();
    // bright core
    ct.fillStyle = '#fff8c0';
    ct.beginPath();
    ct.arc(f.x, f.y, 1.6, 0, Math.PI * 2);
    ct.fill();
    ct.restore();
  }
}
