/*
 * items.js
 *
 * All habitat items that get redrawn every frame, in roughly back-to-front
 * order. Items split into three categories:
 *
 *   - Pure decorations / interactables that are click targets
 *     (wheel, bottle, hut, bin, chew log, sand bath, treat jar, tunnel).
 *
 *   - Things that animate or move (ball physics, the wheel's spinning treads,
 *     the chew log's "crunch!" overlay, the sand bath's sparkle emitter, the
 *     hut's "zzz" while napping).
 *
 *   - The seed basket and its contents, plus the falling-into-bin animations
 *     for poops and shells.
 *
 * Anything that depends on hamster state reads it directly from `ham`/`mode`
 * via state.js; nothing here advances the game forward — it only renders.
 *
 * `drawSeed` covers both basket seeds AND treat-jar treats (carrot, apple,
 * cucumber, cookie) because they all use the same drag-and-drop visual.
 */

import { ct } from './canvas.js';
import { ham, ball, view, entities, save } from './state.js';
import {
  WCX, WR, WCY, FLY, BCX, BCY, BINX, BINY,
  HUT_X, HUT_Y, CHEW_X, CHEW_Y, SAND_X, SAND_Y,
  JAR_X, JAR_Y, BASKX, BASKY, GY_TOP, GY_BOT,
  LADDER_X, LADDER_TOP, LADDER_BOTTOM,
} from './layout.js';
import { spawnSparkles } from './particles.js';

// ---------- Wheel ----------

export function drawWheel() {
  const r = WR(), ccx = WCX(), ccy = WCY(), fy = FLY();

  // wooden support legs
  ct.strokeStyle = '#a07838';
  ct.lineWidth = 7;
  ct.lineCap = 'round';
  ct.beginPath(); ct.moveTo(ccx - r * 0.5, ccy + r); ct.lineTo(ccx - r * 0.4, fy + 6); ct.stroke();
  ct.beginPath(); ct.moveTo(ccx + r * 0.5, ccy + r); ct.lineTo(ccx + r * 0.4, fy + 6); ct.stroke();
  ct.lineWidth = 9;
  ct.beginPath(); ct.moveTo(ccx - r * 0.55, fy + 4); ct.lineTo(ccx + r * 0.55, fy + 4); ct.stroke();

  // outer ring
  ct.strokeStyle = '#c8a058';
  ct.lineWidth = 13;
  ct.beginPath(); ct.arc(ccx, ccy, r, 0, Math.PI * 2); ct.stroke();
  ct.strokeStyle = '#9a7838';
  ct.lineWidth = 2;
  ct.beginPath(); ct.arc(ccx, ccy, r + 5, 0, Math.PI * 2); ct.stroke();
  ct.beginPath(); ct.arc(ccx, ccy, r - 5, 0, Math.PI * 2); ct.stroke();

  // 8 spokes — they rotate with ham.wAngle
  ct.strokeStyle = '#b88a48';
  ct.lineWidth = 4;
  ct.lineCap = 'round';
  for (let i = 0; i < 8; i++) {
    const a = ham.wAngle + i * Math.PI / 4;
    ct.beginPath();
    ct.moveTo(ccx + Math.cos(a) * 11, ccy + Math.sin(a) * 11);
    ct.lineTo(ccx + Math.cos(a) * (r - 7), ccy + Math.sin(a) * (r - 7));
    ct.stroke();
  }

  // tread inside the rim — clipped to the circle so the lines look like running surface
  ct.save();
  ct.beginPath();
  ct.arc(ccx, ccy, r - 7, 0, Math.PI * 2);
  ct.clip();
  ct.strokeStyle = 'rgba(158,118,58,0.32)';
  ct.lineWidth = 1.5;
  // scroll the tread lines up/down based on rotation so it reads as motion
  const scroll = (ham.wAngle * r / Math.PI) % 7;
  for (let j = -Math.ceil(r / 7); j <= Math.ceil(r / 7); j++) {
    const yy = ccy + j * 7 + scroll;
    ct.beginPath();
    ct.moveTo(ccx - r, yy);
    ct.lineTo(ccx + r, yy);
    ct.stroke();
  }
  ct.restore();

  // hub
  ct.fillStyle = '#c8a058';
  ct.beginPath(); ct.arc(ccx, ccy, 15, 0, Math.PI * 2); ct.fill();
  ct.strokeStyle = '#7a4e28';
  ct.lineWidth = 3;
  ct.beginPath(); ct.arc(ccx, ccy, 15, 0, Math.PI * 2); ct.stroke();
  ct.fillStyle = '#7a4e28';
  ct.beginPath(); ct.arc(ccx, ccy, 5, 0, Math.PI * 2); ct.fill();
}

// ---------- Water bottle ----------

export function drawBottle() {
  const bx = BCX(), by = BCY(), bw = 22, bh = 52;

  // metal cap
  ct.fillStyle = '#aaa';
  ct.fillRect(bx - 2, by - 8, bw + 4, 5);

  // glass body + interior water + highlight
  ct.fillStyle = 'rgba(148,208,228,0.75)';
  ct.fillRect(bx, by, bw, bh);
  ct.fillStyle = 'rgba(98,178,218,0.45)';
  ct.fillRect(bx + 2, by + bh * 0.35, bw - 4, bh * 0.62);
  ct.fillStyle = 'rgba(255,255,255,0.35)';
  ct.fillRect(bx + 3, by + 4, 5, bh * 0.38);

  // metal spout
  ct.fillStyle = '#888';
  ct.fillRect(bx + bw / 2 - 3, by + bh, 6, 10);
  ct.fillStyle = '#666';
  ct.beginPath();
  ct.arc(bx + bw / 2, by + bh + 10, 4, 0, Math.PI * 2);
  ct.fill();

  // "H2O" label
  ct.font = '8px sans-serif';
  ct.fillStyle = 'rgba(48,98,118,0.9)';
  ct.textAlign = 'center';
  ct.fillText('H2O', bx + bw / 2, by + bh * 0.22);
}

// ---------- Sleep hut ----------

export function drawHut() {
  const hx2 = HUT_X(), hy2 = HUT_Y(), hw = 54, hh = 46;

  // ground shadow
  ct.fillStyle = 'rgba(0,0,0,0.06)';
  ct.beginPath();
  ct.ellipse(hx2, hy2 + 4, hw * 0.55, 7, 0, 0, Math.PI * 2);
  ct.fill();

  // wooden walls with horizontal plank lines
  ct.fillStyle = '#c8a870';
  ct.fillRect(hx2 - hw / 2, hy2 - hh, hw, hh);
  ct.strokeStyle = 'rgba(100,70,30,0.2)';
  ct.lineWidth = 1;
  for (let i = 0; i < 5; i++) {
    ct.beginPath();
    ct.moveTo(hx2 - hw / 2, hy2 - hh + i * 10);
    ct.lineTo(hx2 + hw / 2, hy2 - hh + i * 10);
    ct.stroke();
  }

  // triangular roof + shingle stripes
  ct.fillStyle = '#8a5a28';
  ct.beginPath();
  ct.moveTo(hx2 - hw / 2 - 6, hy2 - hh);
  ct.lineTo(hx2,              hy2 - hh - 28);
  ct.lineTo(hx2 + hw / 2 + 6, hy2 - hh);
  ct.closePath();
  ct.fill();
  ct.strokeStyle = '#6a4018';
  ct.lineWidth = 1;
  for (let s = 0; s < 4; s++) {
    ct.beginPath();
    ct.moveTo(hx2 - hw / 2 - 6 + s * 18, hy2 - hh);
    ct.lineTo(hx2 - hw / 2 - 6 + s * 18 + 9, hy2 - hh - 14);
    ct.stroke();
  }

  // round door — darker when napping (hamster is inside)
  ct.fillStyle = ham.mode === 'napping' ? '#1a0a04' : '#3a2010';
  ct.beginPath();
  ct.arc(hx2, hy2 - 12, 13, Math.PI, 0);
  ct.lineTo(hx2 + 13, hy2);
  ct.lineTo(hx2 - 13, hy2);
  ct.closePath();
  ct.fill();
  ct.strokeStyle = '#6a3a18';
  ct.lineWidth = 2;
  ct.beginPath();
  ct.arc(hx2, hy2 - 12, 13, Math.PI, 0);
  ct.lineTo(hx2 + 13, hy2);
  ct.stroke();

  // Floating "z z z" while napping; bobs gently up and down via sin(frame).
  if (ham.mode === 'napping') {
    const zOff = Math.sin(view.frame * 0.04) * 4;
    ct.font = '13px sans-serif';
    ct.fillStyle = 'rgba(178,118,78,0.85)';
    ct.textAlign = 'center';
    ct.fillText('z z z', hx2 + 16, hy2 - hh - 32 + zOff);
  }
}

// ---------- Recycle bin ----------

export function drawBin() {
  const bx = BINX(), by = BINY();

  // shadow
  ct.fillStyle = 'rgba(0,0,0,0.08)';
  ct.beginPath();
  ct.ellipse(bx, by + 6, 26, 6, 0, 0, Math.PI * 2);
  ct.fill();

  // green trapezoidal body + side highlight
  ct.fillStyle = '#7a9e6a';
  ct.beginPath();
  ct.moveTo(bx - 20, by - 30);
  ct.lineTo(bx + 20, by - 30);
  ct.lineTo(bx + 16, by + 4);
  ct.lineTo(bx - 16, by + 4);
  ct.closePath();
  ct.fill();
  ct.fillStyle = 'rgba(255,255,255,0.12)';
  ct.beginPath();
  ct.moveTo(bx - 18, by - 28);
  ct.lineTo(bx -  8, by - 28);
  ct.lineTo(bx - 10, by + 2);
  ct.lineTo(bx - 16, by + 2);
  ct.closePath();
  ct.fill();

  // ribs (decorative vertical lines)
  ct.strokeStyle = 'rgba(40,80,30,0.3)';
  ct.lineWidth = 1.5;
  ct.beginPath(); ct.moveTo(bx - 5, by - 30); ct.lineTo(bx - 4, by + 4); ct.stroke();
  ct.beginPath(); ct.moveTo(bx + 6, by - 30); ct.lineTo(bx + 5, by + 4); ct.stroke();

  // lid + handle
  ct.fillStyle = '#6a8e5a'; ct.fillRect(bx - 23, by - 36, 46, 8);
  ct.fillStyle = '#8ab87a'; ct.fillRect(bx - 21, by - 36, 42, 3);
  ct.fillStyle = '#5a7e4a'; ct.fillRect(bx - 5,  by - 42, 10, 7);
  ct.fillStyle = '#7aae6a'; ct.fillRect(bx - 4,  by - 42, 10, 3);

  // recycle glyph
  ct.fillStyle = 'rgba(255,255,255,0.6)';
  ct.font = 'bold 11px sans-serif';
  ct.textAlign = 'center';
  ct.fillText('♻', bx, by - 12);

  // count badge — appears once anything has been binned this session
  if (entities.binCount > 0) {
    ct.fillStyle = '#e05a2a';
    ct.beginPath();
    ct.arc(bx + 16, by - 32, 9, 0, Math.PI * 2);
    ct.fill();
    ct.fillStyle = '#fff';
    ct.font = 'bold 9px sans-serif';
    ct.textAlign = 'center';
    ct.fillText(entities.binCount, bx + 16, by - 29);
  }
}

// ---------- Chew log (interactive) ----------

export function drawChewLog() {
  const lx = CHEW_X() - 44, ly = CHEW_Y() - 11, lw = 88, lh = 22;

  // shadow
  ct.fillStyle = 'rgba(0,0,0,0.08)';
  ct.beginPath();
  ct.ellipse(lx + lw / 2, ly + lh + 3, lw * 0.45, 5, 0, 0, Math.PI * 2);
  ct.fill();

  // log body — rounded rectangle
  ct.fillStyle = '#a07848';
  ct.beginPath();
  ct.moveTo(lx + lh / 2, ly);
  ct.lineTo(lx + lw - lh / 2, ly);
  ct.arc(lx + lw - lh / 2, ly + lh / 2, lh / 2, -Math.PI / 2, Math.PI / 2);
  ct.lineTo(lx + lh / 2, ly + lh);
  ct.arc(lx + lh / 2, ly + lh / 2, lh / 2, Math.PI / 2, -Math.PI / 2);
  ct.closePath();
  ct.fill();

  // bark grooves
  ct.strokeStyle = '#7a5828';
  ct.lineWidth = 1.5;
  for (let k = 1; k < 5; k++) {
    ct.beginPath();
    ct.moveTo(lx + lw * k / 5, ly + 2);
    ct.lineTo(lx + lw * k / 5, ly + lh - 2);
    ct.stroke();
  }

  // hollow knot
  ct.fillStyle = '#3a2010';
  ct.beginPath();
  ct.ellipse(lx + 18, ly + lh / 2, 10, 8, 0, 0, Math.PI * 2);
  ct.fill();

  // "crunch!" floater + occasional sparkles while the hamster gnaws
  if (ham.mode === 'chewing') {
    const off = Math.sin(view.frame * 0.55) * 2;
    ct.fillStyle = '#fff8d8';
    ct.font = '9px sans-serif';
    ct.textAlign = 'center';
    ct.fillText('crunch!', lx + lw * 0.78, ly - 6 + off);
    if (view.frame % 6 === 0) spawnSparkles(CHEW_X() + 8, CHEW_Y() - 2, 2);
  }
}

// ---------- Sand bath (interactive) ----------

export function drawSandBath() {
  const sx = SAND_X(), sy = SAND_Y(), sr = 32, sh = 28;

  // bottom rim shadow
  ct.fillStyle = '#b8a07a';
  ct.beginPath();
  ct.ellipse(sx, sy + sh, sr, 10, 0, 0, Math.PI * 2);
  ct.fill();

  // walls + top rim
  ct.fillStyle = '#c8b08a';
  ct.fillRect(sx - sr, sy, sr * 2, sh);
  ct.fillStyle = '#b8a07a';
  ct.beginPath();
  ct.ellipse(sx, sy, sr, 10, 0, 0, Math.PI * 2);
  ct.fill();

  // concentric ripples in the sand
  ct.strokeStyle = 'rgba(148,118,68,0.4)';
  ct.lineWidth = 1;
  for (let m = 1; m < 4; m++) {
    ct.beginPath();
    ct.ellipse(sx, sy, sr * m / 4, 10 * m / 4, 0, 0, Math.PI * 2);
    ct.stroke();
  }

  // While bathing, push fresh sparkles into the particle queue. We don't go
  // through spawnSparkles() here because we want a tighter, sand-bath-shaped
  // emission pattern (wider X, shallower Y) than the generic burst.
  if (ham.mode === 'bathing' && view.frame % 4 === 0) {
    entities.sparkles.push({
      x: sx + (Math.random() - 0.5) * sr * 1.4,
      y: sy + (Math.random() - 0.5) * 8,
      vx: (Math.random() - 0.5) * 1.6,
      vy: -1.5 - Math.random(),
      size: 1.5 + Math.random() * 1.5,
      life: 0,
      maxLife: 35,
    });
  }
}

// ---------- Treat jar ----------

export function drawTreatJar() {
  const x = JAR_X(), y = JAR_Y();

  // shadow
  ct.fillStyle = 'rgba(0,0,0,0.08)';
  ct.beginPath();
  ct.ellipse(x, y + 4, 17, 4, 0, 0, Math.PI * 2);
  ct.fill();

  // glass jar
  ct.fillStyle = 'rgba(190,220,235,0.55)';
  ct.fillRect(x - 13, y - 32, 26, 32);
  ct.strokeStyle = '#a8b8c0';
  ct.lineWidth = 1.4;
  ct.strokeRect(x - 13, y - 32, 26, 32);

  // little carrot/treat blobs visible inside
  const treats = [
    ['#e08040', -7,  -4],
    ['#d44820',  2,  -6],
    ['#e8a050', -3, -12],
    ['#e0682a',  6,  -3],
    ['#d05030', -8, -18],
    ['#e0884a',  4, -15],
  ];
  treats.forEach((t) => {
    ct.fillStyle = t[0];
    ct.beginPath();
    ct.arc(x + t[1], y - 2 + t[2], 3, 0, Math.PI * 2);
    ct.fill();
    ct.fillStyle = 'rgba(255,200,140,0.5)';
    ct.beginPath();
    ct.arc(x + t[1] - 1, y - 2 + t[2] - 1, 1.2, 0, Math.PI * 2);
    ct.fill();
  });

  // glass highlight stripe
  ct.fillStyle = 'rgba(255,255,255,0.25)';
  ct.fillRect(x - 11, y - 30, 4, 28);

  // lid
  ct.fillStyle = '#c89058';
  ct.fillRect(x - 15, y - 39, 30, 8);
  ct.strokeStyle = '#8a5a28';
  ct.lineWidth = 1;
  ct.strokeRect(x - 15, y - 39, 30, 8);

  // label
  ct.fillStyle = '#fff8e0';
  ct.fillRect(x - 11, y - 22, 22, 9);
  ct.fillStyle = '#8a4010';
  ct.font = 'bold 7px sans-serif';
  ct.textAlign = 'center';
  ct.fillText('TREATS', x, y - 15);
}

// ---------- Bouncy ball ----------

export function drawBall() {
  if (!ball.active) return;

  // shadow
  ct.fillStyle = 'rgba(0,0,0,0.18)';
  ct.beginPath();
  ct.ellipse(ball.x, ball.y + 13, 14, 4, 0, 0, Math.PI * 2);
  ct.fill();

  // body — radial gradient gives it a soft 3D shading
  const grd = ct.createRadialGradient(ball.x - 4, ball.y - 4, 2, ball.x, ball.y, 14);
  grd.addColorStop(0, '#ff9494');
  grd.addColorStop(1, '#c43028');
  ct.fillStyle = grd;
  ct.beginPath();
  ct.arc(ball.x, ball.y, 13, 0, Math.PI * 2);
  ct.fill();

  // white stripe — rotates with ball.spin so the ball reads as actually rolling
  ct.save();
  ct.translate(ball.x, ball.y);
  ct.rotate(ball.spin);
  ct.fillStyle = '#fff';
  ct.fillRect(-13, -3, 26, 6);
  ct.restore();

  ct.strokeStyle = 'rgba(120,20,20,0.4)';
  ct.lineWidth = 1.5;
  ct.beginPath();
  ct.arc(ball.x, ball.y, 13, 0, Math.PI * 2);
  ct.stroke();

  // specular highlight
  ct.fillStyle = 'rgba(255,255,255,0.55)';
  ct.beginPath();
  ct.arc(ball.x - 4, ball.y - 4, 3.5, 0, Math.PI * 2);
  ct.fill();
}

// Ball physics — bounces off the floor area and walls with damping. The
// hamster's "playball" mode in behavior.js applies impulses to vx/vy.
export function tickBall() {
  if (!ball.active || ball.dragging) return;
  ball.x += ball.vx;
  ball.y += ball.vy;
  ball.spin += ball.vx * 0.08;
  ball.vx *= 0.97;
  ball.vy *= 0.97;
  if (ball.y < GY_TOP() + 10) { ball.y = GY_TOP() + 10; ball.vy = Math.abs(ball.vy) * 0.6; }
  if (ball.y > GY_BOT() - 2)  { ball.y = GY_BOT() - 2;  ball.vy = -Math.abs(ball.vy) * 0.6; }
  if (ball.x < 60)            { ball.x = 60;            ball.vx = Math.abs(ball.vx) * 0.6; }
  if (ball.x > view.W - 70)   { ball.x = view.W - 70;   ball.vx = -Math.abs(ball.vx) * 0.6; }
}

// ---------- Climbing ladder (purchased toy, interactive) ----------

export function drawLadder() {
  if (!save.owned.ladder) return;
  const x   = LADDER_X();
  const top = LADDER_TOP();
  const bot = LADDER_BOTTOM();

  // Subtle shadow at the base
  ct.fillStyle = 'rgba(0,0,0,0.10)';
  ct.beginPath();
  ct.ellipse(x, bot + 3, 18, 4, 0, 0, Math.PI * 2);
  ct.fill();

  // Two side rails — a tiny bit taller than the rung area so the ladder
  // reads as having "uprights" past the top platform.
  ct.fillStyle = '#a07840';
  ct.fillRect(x - 12, top - 6, 4, bot - top + 12);
  ct.fillRect(x +  8, top - 6, 4, bot - top + 12);

  // Rungs every ~14px. Slightly darker than the rails so the contrast reads.
  ct.fillStyle = '#7a5418';
  for (let y = top + 4; y < bot - 4; y += 14) {
    ct.fillRect(x - 12, y, 24, 4);
  }

  // Top platform — wider than the rails so the hamster has somewhere to perch.
  ct.fillStyle = '#b08850';
  ct.fillRect(x - 16, top - 10, 32, 6);
  ct.strokeStyle = '#6a4818';
  ct.lineWidth = 1;
  ct.strokeRect(x - 16, top - 10, 32, 6);

  // Wood grain on the platform edge
  ct.strokeStyle = 'rgba(110, 70, 28, 0.4)';
  ct.lineWidth = 0.8;
  for (let i = -14; i < 14; i += 5) {
    ct.beginPath(); ct.moveTo(x + i, top - 9); ct.lineTo(x + i, top - 5); ct.stroke();
  }
}

// ---------- Tunnel (purchased toy, decorative) ----------

export function drawTunnel() {
  if (!save.owned.tunnel) return;
  const tx = view.W * 0.08, ty = GY_BOT() - 12, tw = 110, th = 30;

  ct.fillStyle = 'rgba(0,0,0,0.18)';
  ct.beginPath();
  ct.ellipse(tx + tw / 2, ty + th + 4, tw * 0.4, 5, 0, 0, Math.PI * 2);
  ct.fill();

  // gradient body
  const grd = ct.createLinearGradient(tx, ty, tx, ty + th);
  grd.addColorStop(0,    '#5ab0d8');
  grd.addColorStop(0.5,  '#3a90c0');
  grd.addColorStop(1,    '#205878');
  ct.fillStyle = grd;
  ct.beginPath();
  ct.moveTo(tx + th / 2, ty);
  ct.lineTo(tx + tw - th / 2, ty);
  ct.arc(tx + tw - th / 2, ty + th / 2, th / 2, -Math.PI / 2, Math.PI / 2);
  ct.lineTo(tx + th / 2, ty + th);
  ct.arc(tx + th / 2, ty + th / 2, th / 2, Math.PI / 2, -Math.PI / 2);
  ct.closePath();
  ct.fill();

  // ribbed segments
  for (let i = 0; i < 6; i++) {
    ct.strokeStyle = 'rgba(20,40,60,0.3)';
    ct.lineWidth = 2;
    ct.beginPath();
    ct.moveTo(tx + th / 2 + i * ((tw - th) / 5), ty + 2);
    ct.lineTo(tx + th / 2 + i * ((tw - th) / 5), ty + th - 2);
    ct.stroke();
  }

  // dark mouth on each end
  ct.fillStyle = '#1a3848';
  ct.beginPath();
  ct.ellipse(tx + th / 2 - 2, ty + th / 2, 5, th * 0.35, 0, 0, Math.PI * 2);
  ct.fill();
  ct.beginPath();
  ct.ellipse(tx + tw - th / 2 + 2, ty + th / 2, 5, th * 0.35, 0, 0, Math.PI * 2);
  ct.fill();
}

// ---------- Seeds & treats (single drawer for both) ----------

// Used both for basket seeds (sunflower/millet/pumpkin) and shop treats
// (carrot/apple/cucumber/cookie). Treated uniformly so the drag preview in
// input.js doesn't need to branch.
export function drawSeed(c, x, y, type, angle, scale) {
  c.save();
  c.translate(x, y);
  c.rotate(angle || 0);
  c.scale(scale || 1, scale || 1);
  if (type === 'sunflower') {
    c.fillStyle = '#2a2018';
    c.beginPath(); c.ellipse(0, 0, 4, 6.5, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = 'rgba(200,190,170,0.55)';
    c.beginPath(); c.ellipse(0, 0, 1, 5, 0, 0, Math.PI * 2); c.fill();
  } else if (type === 'millet') {
    c.fillStyle = '#d4b44a';
    c.beginPath(); c.arc(0, 0, 3.5, 0, Math.PI * 2); c.fill();
    c.fillStyle = 'rgba(255,240,180,0.5)';
    c.beginPath(); c.arc(-1, -1, 1.2, 0, Math.PI * 2); c.fill();
  } else if (type === 'pumpkin') {
    c.fillStyle = '#b8c888';
    c.beginPath(); c.ellipse(0, 0, 3.5, 5.5, 0, 0, Math.PI * 2); c.fill();
    c.strokeStyle = 'rgba(100,120,60,0.4)';
    c.lineWidth = 0.6;
    c.beginPath(); c.moveTo(0, -5); c.lineTo(0, 5); c.stroke();
  } else if (type === 'carrot') {
    c.fillStyle = '#e88030';
    c.beginPath(); c.moveTo(0, -6); c.lineTo(3, 5); c.lineTo(-3, 5); c.closePath(); c.fill();
    c.fillStyle = '#5aa840';
    [[-2, -6], [2, -6], [0, -8]].forEach(([dx, dy]) => { c.beginPath(); c.arc(dx, dy, 1.5, 0, Math.PI * 2); c.fill(); });
  } else if (type === 'apple') {
    c.fillStyle = '#e44040';
    c.beginPath(); c.arc(0, 1, 5, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#5a8030';
    c.beginPath(); c.ellipse(2, -4, 2.5, 1.2, 0.6, 0, Math.PI * 2); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.4)';
    c.beginPath(); c.arc(-2, -1, 1.2, 0, Math.PI * 2); c.fill();
  } else if (type === 'cucumber') {
    c.fillStyle = '#5aa860';
    c.beginPath(); c.ellipse(0, 0, 3, 6, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = 'rgba(180,220,150,0.7)';
    c.beginPath(); c.ellipse(-1, 0, 1, 5, 0, 0, Math.PI * 2); c.fill();
  } else if (type === 'cookie') {
    c.fillStyle = '#b87838';
    c.beginPath(); c.arc(0, 0, 5.5, 0, Math.PI * 2); c.fill();
    // chocolate chips
    c.fillStyle = '#4a2810';
    c.beginPath(); c.arc(-2, -1, 1, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc( 2,  1, 1, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc( 1, -2, 0.8, 0, Math.PI * 2); c.fill();
  } else if (type === 'cake') {
    // Pink slice with white frosting and a cherry on top.
    c.fillStyle = '#f0a8c0';
    c.fillRect(-5, -2, 10, 7);
    c.fillStyle = '#ffd0e0';
    c.fillRect(-5, -3, 10, 2);
    // sprinkles on the frosting
    c.fillStyle = '#ff8030'; c.fillRect(-3, -2.5, 1, 0.8);
    c.fillStyle = '#5080f0'; c.fillRect( 1, -2.5, 1, 0.8);
    c.fillStyle = '#80c060'; c.fillRect(-1, -3,   1, 0.8);
    // cherry
    c.fillStyle = '#e02850';
    c.beginPath(); c.arc(0, -5, 1.6, 0, Math.PI * 2); c.fill();
    // tiny stem
    c.strokeStyle = '#5aa040';
    c.lineWidth = 0.7;
    c.beginPath(); c.moveTo(0, -6.5); c.lineTo(1, -7.5); c.stroke();
  }
  c.restore();
}

// ---------- Basket ----------

export function drawBasket() {
  const bx = BASKX(), by = BASKY();

  // shadow
  ct.fillStyle = '#c8a06a';
  ct.beginPath();
  ct.ellipse(bx, by + 6, 26, 10, 0, 0, Math.PI * 2);
  ct.fill();

  // body trapezoid + wickerwork lines
  ct.fillStyle = '#b89058';
  ct.beginPath();
  ct.moveTo(bx - 26, by);
  ct.lineTo(bx + 26, by);
  ct.lineTo(bx + 22, by - 22);
  ct.lineTo(bx - 22, by - 22);
  ct.closePath();
  ct.fill();
  ct.strokeStyle = 'rgba(100,70,30,0.3)';
  ct.lineWidth = 1;
  for (let i = 0; i < 4; i++) {
    ct.beginPath();
    ct.moveTo(bx - 24, by - 5 - i * 5);
    ct.lineTo(bx + 24, by - 5 - i * 5);
    ct.stroke();
  }
  ct.beginPath(); ct.moveTo(bx - 12, by - 22); ct.lineTo(bx - 10, by); ct.stroke();
  ct.beginPath(); ct.moveTo(bx,      by - 22); ct.lineTo(bx,       by); ct.stroke();
  ct.beginPath(); ct.moveTo(bx + 12, by - 22); ct.lineTo(bx + 10, by); ct.stroke();

  // top rim
  ct.fillStyle = '#d4a870';
  ct.beginPath();
  ct.ellipse(bx, by - 22, 26, 7, 0, 0, Math.PI * 2);
  ct.fill();
  ct.strokeStyle = '#a07840';
  ct.lineWidth = 1.5;
  ct.beginPath();
  ct.ellipse(bx, by - 22, 26, 7, 0, 0, Math.PI * 2);
  ct.stroke();

  // handle
  ct.strokeStyle = '#a07840';
  ct.lineWidth = 4;
  ct.lineCap = 'round';
  ct.beginPath();
  ct.arc(bx, by - 32, 14, Math.PI, 0);
  ct.stroke();

  // visible seeds: only those not currently dragged or eaten
  entities.basketSeeds.forEach((s) => {
    if (!s.dragging && !s.eaten) {
      drawSeed(ct, bx + s.ox, by - 16 + s.oy, s.type, s.ox * 0.08, 1);
    }
  });
}

// Reset the basket back to its starting layout. Called from behavior.js's
// resetGame.
export function initBasket() {
  entities.basketSeeds = [];
  const offsets = [[-8, -6], [4, -8], [-12, 2], [6, 2], [-4, 8], [8, -2]];
  const SEED = ['sunflower', 'millet', 'pumpkin'];
  offsets.forEach((o, i) => {
    entities.basketSeeds.push({ type: SEED[i % 3], ox: o[0], oy: o[1], dragging: false, eaten: false });
  });
}

// ---------- Sunflower shells ----------

export function drawShell(c, x, y, angle) {
  c.save();
  c.translate(x, y);
  c.rotate(angle);
  // left half
  c.save(); c.translate(-4, 0);
  c.fillStyle = '#c8a830';
  c.beginPath(); c.ellipse(0, 0, 5, 8, -0.25, 0, Math.PI * 2); c.fill();
  c.strokeStyle = '#1a1208';
  c.lineWidth = 1;
  c.beginPath(); c.moveTo(-1, -7); c.lineTo(-2, 7); c.stroke();
  c.beginPath(); c.moveTo( 2, -6); c.lineTo( 1, 6); c.stroke();
  c.fillStyle = 'rgba(220,190,120,0.5)';
  c.beginPath(); c.ellipse(0, 1, 2.5, 5, 0, 0, Math.PI * 2); c.fill();
  c.restore();
  // right half
  c.save(); c.translate(4, 0);
  c.fillStyle = '#b89020';
  c.beginPath(); c.ellipse(0, 0, 5, 8, 0.25, 0, Math.PI * 2); c.fill();
  c.strokeStyle = '#1a1208';
  c.lineWidth = 1;
  c.beginPath(); c.moveTo( 1, -7); c.lineTo( 2, 7); c.stroke();
  c.beginPath(); c.moveTo(-2, -6); c.lineTo(-1, 6); c.stroke();
  c.fillStyle = 'rgba(220,190,120,0.5)';
  c.beginPath(); c.ellipse(0, 1, 2.5, 5, 0, 0, Math.PI * 2); c.fill();
  c.restore();
  // crack down the middle
  c.strokeStyle = 'rgba(80,50,10,0.6)';
  c.lineWidth = 1.5;
  c.beginPath(); c.moveTo(0, -8); c.lineTo(0, 8); c.stroke();
  c.restore();
}

export function drawShells() {
  entities.shells.forEach((s) => drawShell(ct, s.x, s.y, s.angle));
}

// ---------- Poops + flying-into-bin animations ----------

function drawPellet(px, py, rx, ry, angle, alpha) {
  ct.save();
  ct.globalAlpha = alpha || 1;
  ct.translate(px, py);
  ct.rotate(angle);
  // base + slight highlight to give the pellet some shading
  ct.fillStyle = '#3d2008';
  ct.beginPath(); ct.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2); ct.fill();
  ct.fillStyle = '#5a3010';
  ct.beginPath(); ct.ellipse(-rx * 0.10, -ry * 0.15, rx * 0.7,  ry * 0.55, 0, 0, Math.PI * 2); ct.fill();
  ct.fillStyle = 'rgba(180,120,60,0.55)';
  ct.beginPath(); ct.ellipse(-rx * 0.28, -ry * 0.32, rx * 0.26, ry * 0.20, 0, 0, Math.PI * 2); ct.fill();
  ct.fillStyle = 'rgba(255,220,180,0.4)';
  ct.beginPath(); ct.arc(-rx * 0.38, -ry * 0.38, rx * 0.12, 0, Math.PI * 2); ct.fill();
  ct.restore();
}

export function drawPoops() {
  // Poops on the ground — animate-in with a quick scale-up over the first 12 frames.
  entities.poops.forEach((p) => {
    p.age++;
    const sc = p.age < 12 ? p.age / 12 : 1;
    p.pellets.forEach((pel) => {
      ct.save();
      ct.translate(p.x + pel.dx, p.y + pel.dy);
      ct.scale(sc, sc);
      ct.translate(-(p.x + pel.dx), -(p.y + pel.dy));
      drawPellet(p.x + pel.dx, p.y + pel.dy, pel.rx, pel.ry, pel.angle, 1);
      ct.restore();
    });
  });

  // Poops launched toward the bin — interpolated arc with sin(t*PI) lift.
  entities.flyingPoops = entities.flyingPoops.filter((fp) => {
    fp.t += 0.055;
    if (fp.t > 1) return false;
    const t = fp.t;
    const bx = BINX(), by = BINY() - 18;
    const x = fp.sx + (bx - fp.sx) * t;
    const y = fp.sy + (by - fp.sy) * t - Math.sin(t * Math.PI) * 55;
    const sc = (1 - t) * 0.9 + 0.1; // shrink as it flies
    fp.pellets.forEach((pel) => {
      drawPellet(x + pel.dx * sc, y + pel.dy * sc, pel.rx * sc, pel.ry * sc, pel.angle, 1 - t * 0.4);
    });
    return true;
  });

  // Same flying-arc shape, but for sunflower shells.
  entities.flyingItems = entities.flyingItems.filter((fi) => {
    fi.t += 0.055;
    if (fi.t > 1) return false;
    const t = fi.t;
    const bx = BINX(), by = BINY() - 18;
    const x = fi.sx + (bx - fi.sx) * t;
    const y = fi.sy + (by - fi.sy) * t - Math.sin(t * Math.PI) * 50;
    const sc = (1 - t) * 0.8 + 0.1;
    ct.save();
    ct.scale(sc, sc);
    drawShell(ct, x / sc, y / sc, fi.angle);
    ct.restore();
    return true;
  });
}
