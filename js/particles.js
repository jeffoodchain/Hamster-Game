/*
 * particles.js
 *
 * The three small particle systems layered on top of the game:
 *   - hearts       — pop out when you pet the hamster or it eats a treat
 *   - sparkles     — chew-log crunches and sand-bath splashes
 *   - coinFlies    — "+N💰" floating-text rewards
 *
 * Each system has a `spawn*` function (queues new particles) and the matching
 * `updateDraw*` function (advances physics + alpha and draws them, dropping
 * any that have faded out). The `updateDraw*` functions are called from the
 * main draw loop; the `spawn*` functions are called from gameplay code.
 *
 * `drawHeart` is also exported because select-screen / portrait code reuses it.
 */

import { ct } from './canvas.js';
import { entities } from './state.js';
import { snd } from './audio.js';

const HEART_COLORS = ['#ff6b8a', '#ff9eb5', '#ff4466', '#ffb3c6', '#ff2255'];

export function spawnHearts(x, y) {
  for (let i = 0; i < 5; i++) {
    entities.hearts.push({
      x: x + (Math.random() - 0.5) * 30,
      y: y - 20,
      vx: (Math.random() - 0.5) * 1.2,
      vy: -(1.2 + Math.random() * 1.4),
      size: 6 + Math.random() * 7,
      color: HEART_COLORS[i % HEART_COLORS.length],
      alpha: 1,
      wobble: Math.random() * Math.PI * 2, // each heart drifts on its own sine
      life: 0,
    });
  }
  snd('heart');
}

export function spawnSparkles(x, y, n = 6) {
  for (let i = 0; i < n; i++) {
    entities.sparkles.push({
      x: x + (Math.random() - 0.5) * 24,
      y: y + (Math.random() - 0.5) * 18,
      vx: (Math.random() - 0.5) * 1.5,
      vy: -1 - Math.random() * 1.5,
      size: 2 + Math.random() * 3,
      life: 0,
      maxLife: 30 + Math.random() * 20,
    });
  }
}

export function spawnCoinFly(x, y, amount) {
  entities.coinFlies.push({ x, y, vy: -1.5, life: 0, amount });
}

// Heart shape via two cubic bezier arcs. Used by particles + the front-view
// hamster's happy-mode eyes (indirectly — the heart shape itself is here).
export function drawHeart(c, x, y, size, color, alpha) {
  c.save();
  c.globalAlpha = alpha;
  c.translate(x, y);
  c.fillStyle = color;
  c.beginPath();
  c.moveTo(0, -size * 0.5);
  c.bezierCurveTo( size * 0.5, -size * 1.1,  size * 1.1, -size * 0.3, 0,  size * 0.6);
  c.bezierCurveTo(-size * 1.1, -size * 0.3, -size * 0.5, -size * 1.1, 0, -size * 0.5);
  c.closePath();
  c.fill();
  // tiny white highlight gives the heart a glossy 3D feel
  c.fillStyle = 'rgba(255,255,255,0.4)';
  c.beginPath();
  c.arc(-size * 0.2, -size * 0.3, size * 0.18, 0, Math.PI * 2);
  c.fill();
  c.restore();
}

export function updateDrawHearts() {
  entities.hearts = entities.hearts.filter((h) => {
    h.life++;
    // Horizontal drift wobbles around the upward velocity.
    h.x += h.vx + Math.sin(h.wobble + h.life * 0.12) * 0.4;
    h.y += h.vy;
    h.vy *= 0.97; // mild deceleration as it rises
    h.alpha = Math.max(0, 1 - h.life / 55);
    if (h.alpha <= 0) return false;
    drawHeart(ct, h.x, h.y, h.size, h.color, h.alpha);
    return true;
  });
}

export function updateDrawSparkles() {
  entities.sparkles = entities.sparkles.filter((s) => {
    s.life++;
    s.x += s.vx;
    s.y += s.vy;
    s.vy += 0.05; // gravity — sparkles arc down
    const a = Math.max(0, 1 - s.life / s.maxLife);
    if (a <= 0) return false;
    ct.save();
    ct.globalAlpha = a;
    ct.fillStyle = '#fff8a0';
    ct.beginPath();
    ct.arc(s.x, s.y, s.size, 0, Math.PI * 2);
    ct.fill();
    // bright white core for the "twinkle" feel
    ct.fillStyle = '#fff';
    ct.beginPath();
    ct.arc(s.x, s.y, s.size * 0.4, 0, Math.PI * 2);
    ct.fill();
    ct.restore();
    return true;
  });
}

export function updateDrawCoinFlies() {
  entities.coinFlies = entities.coinFlies.filter((cf) => {
    cf.life++;
    cf.y += cf.vy;
    cf.vy *= 0.95; // ease the rise to a stop
    const a = Math.max(0, 1 - cf.life / 50);
    if (a <= 0) return false;
    ct.save();
    ct.globalAlpha = a;
    ct.fillStyle = '#e8a020';
    ct.font = 'bold 14px sans-serif';
    ct.textAlign = 'center';
    ct.fillText('+' + cf.amount + '💰', cf.x, cf.y);
    ct.restore();
    return true;
  });
}
