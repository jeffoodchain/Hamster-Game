/*
 * background.js
 *
 * Builds the *static* parts of the habitat into an offscreen canvas (`bgCv`
 * from canvas.js). The main draw loop then blits that single image each
 * frame instead of redrawing dozens of bedding strands and decorations every
 * tick — a big win for fps.
 *
 * Things drawn here:
 *   - back wall and bedding floor
 *   - 200 randomly-placed bedding strands (deterministic via mkRng so the
 *     same scattering re-appears after a resize)
 *   - sand patch and hay pile
 *   - picket fence between the wheel area and the chew log
 *   - tilted wood plank, two pebbles, plant tufts, burrow hole, tree stump
 *   - the cage glass frame and a faint highlight strip
 *
 * Things NOT drawn here (those move or animate, so they live in items.js
 * and get redrawn every frame):
 *   - chew log, sand bath, treat jar, bouncy ball, tunnel, basket, bottle,
 *     wheel, hut, bin, the hamster itself, particles, poops.
 */

import { bgCv, onResize } from './canvas.js';
import { view, save } from './state.js';
import { FLY, mkRng } from './layout.js';
import { THEMES } from './config.js';

// Look up the active theme palette — falls back to classic for any save
// that has an unknown theme id (e.g. an old save from before this layer,
// or one that referenced a theme we've since removed).
function activeTheme() {
  return THEMES[save.activeTheme] || THEMES.classic;
}

export function buildBg() {
  const dpr = window.devicePixelRatio || 1;
  bgCv.width = view.W * dpr;
  bgCv.height = view.H * dpr;
  const c = bgCv.getContext('2d');
  c.setTransform(dpr, 0, 0, dpr, 0, 0); // draw in logical pixels, just like the main canvas

  const r = mkRng(7); // fixed seed — bedding scatters identically each rebuild
  const fy = FLY();
  const tL = 14, tR = view.W - 14, tT = 30, tB = view.H - 10;
  const t = activeTheme();

  // back wall + bedding floor
  c.fillStyle = t.wall;  c.fillRect(tL, tT, tR - tL, tB - tT);
  c.fillStyle = t.floor; c.fillRect(tL, fy, tR - tL, tB - fy);

  // 200 short bedding strands
  c.strokeStyle = t.bedding;
  c.lineWidth = 1;
  for (let i = 0; i < 200; i++) {
    const bx = tL + r() * (tR - tL);
    const by = fy + 4 + r() * (tB - fy - 10);
    const ln = 4 + r() * 14;
    const an = r() * Math.PI;
    c.beginPath();
    c.moveTo(bx, by);
    c.lineTo(bx + Math.cos(an) * ln, by + Math.sin(an) * ln);
    c.stroke();
  }

  // sand patch under the chew/sand area, and hay pile at the bottom-left
  c.fillStyle = t.sand;
  c.beginPath();
  c.ellipse(view.W * 0.55, fy + 2, view.W * 0.24, 24, 0, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = t.hay;
  c.beginPath();
  c.ellipse(view.W * 0.30, fy + 18, 58, 17, 0, 0, Math.PI * 2);
  c.fill();

  // picket fence between f1 and f2
  const f1 = view.W * 0.22, f2 = view.W * 0.44;
  const fc = 13, fsp = (f2 - f1) / fc;
  for (let j = 0; j <= fc; j++) {
    c.fillStyle = t.fence;
    c.fillRect(f1 + j * fsp - 3, fy - 20, 6, 22);
  }
  c.fillStyle = t.fenceRail;
  c.fillRect(f1, fy - 10, f2 - f1, 4);

  // tilted wooden plank near the basket — uses the same wood color as the fence
  c.fillStyle = t.fence;
  c.save();
  c.translate(view.W * 0.24, fy + 2);
  c.rotate(-0.22);
  c.fillRect(0, -16, 56, 16);
  c.strokeStyle = '#a07838';
  c.lineWidth = 1.5;
  for (let n = 1; n < 5; n++) {
    c.beginPath();
    c.moveTo(56 * n / 5, -16);
    c.lineTo(56 * n / 5, 0);
    c.stroke();
  }
  c.restore();

  // two pebbles on the bedding
  [[view.W * 0.27, fy + 14, 10, 7], [view.W * 0.33, fy + 20, 8, 6]].forEach((p) => {
    c.fillStyle = '#888068';
    c.beginPath();
    c.ellipse(p[0], p[1], p[2], p[3], 0.3, 0, Math.PI * 2);
    c.fill();
  });

  // plant tufts (a few short stems with tips, scattered)
  function tuft(px, py, col, n) {
    for (let i = 0; i < n; i++) {
      const ang = -Math.PI / 2 + (r() - 0.5) * 1.1;
      const len = 16 + r() * 20;
      const ex = px + Math.cos(ang) * len;
      const ey = py + Math.sin(ang) * len;
      c.strokeStyle = col;
      c.lineWidth = 1.2;
      c.beginPath();
      c.moveTo(px, py);
      c.quadraticCurveTo(px + (r() - 0.5) * 10, py - len * 0.5, ex, ey);
      c.stroke();
      c.fillStyle = col;
      c.beginPath();
      c.arc(ex, ey, 1.5 + r() * 2, 0, Math.PI * 2);
      c.fill();
    }
  }
  tuft(view.W * 0.62, fy - 10, '#8a7a5e', 3);
  tuft(view.W * 0.66, fy - 6,  '#7a6a4e', 4);
  tuft(view.W * 0.78, fy - 8,  '#9a8a68', 4);
  tuft(view.W * 0.83, fy - 4,  '#7e6e52', 3);

  // burrow hole
  c.fillStyle = '#8a7050';
  c.beginPath();
  c.ellipse(view.W * 0.60, fy - 10, 28, 17, 0, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = '#2a1a0a';
  c.beginPath();
  c.ellipse(view.W * 0.60, fy - 10, 18, 11, 0, 0, Math.PI * 2);
  c.fill();

  // background tree stump (decoration only)
  const tx = view.W * 0.46, ty = fy - 54, trd = 22, tth = 46;
  c.fillStyle = '#c8a86a';
  c.fillRect(tx - trd, ty, trd * 2, tth);
  c.strokeStyle = '#a07838';
  c.lineWidth = 1.5;
  for (let q = 0; q < 8; q++) {
    c.beginPath();
    c.moveTo(tx - trd, ty + q * tth / 8);
    c.lineTo(tx + trd, ty + q * tth / 8);
    c.stroke();
  }
  c.fillStyle = '#b09058';
  c.beginPath();
  c.ellipse(tx, ty,       trd, 7, 0, 0, Math.PI * 2);
  c.fill();
  c.beginPath();
  c.ellipse(tx, ty + tth, trd, 7, 0, 0, Math.PI * 2);
  c.fill();

  // glass frame: tinted stroke + a faint vertical highlight + the cage rim
  c.strokeStyle = t.glass;
  c.lineWidth = 6;
  c.strokeRect(tL, tT, tR - tL, tB - tT);
  c.fillStyle = 'rgba(255,255,255,0.07)';
  c.fillRect(tL + 6, tT + 6, 26, tB - tT - 12);
  c.fillStyle = t.rim;
  c.fillRect(tL, tT, tR - tL, 7);
}

// Rebuild the background whenever the canvas resizes — but only after the
// game screen is up. main.js calls buildBg() directly when entering play;
// this listener keeps the cached image in sync afterwards.
onResize(() => {
  if (view.gameScreen === 'game') buildBg();
});
