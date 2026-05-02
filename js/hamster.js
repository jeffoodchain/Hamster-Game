/*
 * hamster.js
 *
 * Renders the hamster sprite itself, in two views:
 *   drawFront  — the default view: face-on, used for everything except the wheel
 *   drawSide   — used while running on the wheel and during the climb up,
 *                because the hamster needs to look like it's going *somewhere*
 *
 * Plus three small extras:
 *   drawHamPortrait — the head-only portrait shown on the hamster picker cards
 *   drawCosmetic    — bow / hat / crown drawn on top of the head
 *   drawYuanbao     — the gold ingot above the lucky chubby dwarf
 *
 * The sprite is composed of layered canvas primitives (no images): body
 * ellipse, belly, ears, eyes, nose, whiskers, four feet, optional dorsal
 * stripe. Mood/state expresses through eye shape (open / squinting / blinking),
 * cheek puff, and arm pose (up to the bottle, up to the mouth, etc.).
 */

import { ct } from './canvas.js';
import { ham, save } from './state.js';
import { HAMS } from './config.js';

// ---------- Yuan bao (lucky gold ingot for 阿財) ----------

export function drawYuanbao(c, x, y, size) {
  c.save();
  c.translate(x, y);
  c.scale(size, size);

  // base shape
  c.fillStyle = '#d4a020';
  c.beginPath();
  c.moveTo(-7, -2);
  c.quadraticCurveTo(-7, -4, -6, -5);
  c.quadraticCurveTo(-3, -6,  0, -6);
  c.quadraticCurveTo( 3, -6,  6, -5);
  c.quadraticCurveTo( 7, -4,  7, -2);
  c.quadraticCurveTo( 5,  0,  0,  1);
  c.quadraticCurveTo(-5,  0, -7, -2);
  c.closePath();
  c.fill();

  // bright top crescent
  c.fillStyle = '#f0d060';
  c.beginPath();
  c.moveTo(-5, -3.5);
  c.quadraticCurveTo(-2, -5, 0, -5);
  c.quadraticCurveTo( 2, -5, 5, -3.5);
  c.quadraticCurveTo( 3, -2, 0, -1.5);
  c.quadraticCurveTo(-3, -2, -5, -3.5);
  c.closePath();
  c.fill();

  // glints
  c.fillStyle = 'rgba(255,245,200,0.7)';
  c.beginPath(); c.ellipse(-2, -4, 2,   1,   0, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.ellipse( 2, -4, 1.5, 0.8, 0, 0, Math.PI * 2); c.fill();

  // shadow under-curve
  c.fillStyle = 'rgba(160,100,20,0.4)';
  c.beginPath();
  c.moveTo(-6, -1);
  c.quadraticCurveTo(-3, 0.5, 0, 0.8);
  c.quadraticCurveTo( 3, 0.5, 6, -1);
  c.quadraticCurveTo( 4, 0.2, 0, 0.5);
  c.quadraticCurveTo(-4, 0.2, -6, -1);
  c.closePath();
  c.fill();

  // 福 character — "fortune"
  c.fillStyle = '#8a2010';
  c.font = 'bold 5px sans-serif';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText('福', 0, -2.5);
  c.restore();
}

// ---------- Cosmetics (drawn on the head, after the body) ----------

export function drawCosmetic(c, x, y, scale, kind) {
  if (kind === 'none' || !kind) return;
  c.save();
  c.translate(x, y);
  c.scale(scale, scale);
  if (kind === 'bow') {
    // two pinched lobes meeting at a center knot
    c.fillStyle = '#e85a8a';
    c.beginPath();
    c.moveTo(-12, 0); c.quadraticCurveTo(-14, -6, -9, -7); c.quadraticCurveTo(-3, -3, -2, 0);
    c.quadraticCurveTo(-3, 3, -9, 7); c.quadraticCurveTo(-14, 6, -12, 0);
    c.closePath(); c.fill();
    c.beginPath();
    c.moveTo(12, 0); c.quadraticCurveTo(14, -6, 9, -7); c.quadraticCurveTo(3, -3, 2, 0);
    c.quadraticCurveTo(3, 3, 9, 7); c.quadraticCurveTo(14, 6, 12, 0);
    c.closePath(); c.fill();
    c.fillStyle = '#c0306a';
    c.beginPath(); c.arc(0, 0, 3, 0, Math.PI * 2); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.5)';
    c.beginPath(); c.ellipse(-7, -3, 2, 1, 0, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse( 7, -3, 2, 1, 0, 0, Math.PI * 2); c.fill();
  } else if (kind === 'hat') {
    // top hat: brim + crown + gold band hint
    c.fillStyle = '#3a4090';
    c.beginPath();
    c.moveTo(-14, 4); c.lineTo(14, 4); c.lineTo(14, 2); c.lineTo(10, -12);
    c.lineTo(-10, -12); c.lineTo(-14, 2); c.closePath(); c.fill();
    c.fillStyle = '#202458';
    c.fillRect(-14, 2, 28, 3);
    c.fillStyle = '#e8c040';
    c.beginPath(); c.arc(0, -4, 3, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#a08020';
    c.lineWidth = 1;
    c.beginPath(); c.arc(0, -4, 3, 0, Math.PI * 2); c.stroke();
  } else if (kind === 'crown') {
    // gold crown with three jewels
    c.fillStyle = '#f0c020';
    c.beginPath();
    c.moveTo(-12, 4); c.lineTo(-12, -4); c.lineTo(-8, -1); c.lineTo(-4, -9);
    c.lineTo(0, -4); c.lineTo(4, -9); c.lineTo(8, -1); c.lineTo(12, -4);
    c.lineTo(12, 4); c.closePath(); c.fill();
    c.strokeStyle = '#a08020';
    c.lineWidth = 1;
    c.stroke();
    c.fillStyle = '#f08080'; c.beginPath(); c.arc(-4, -7, 1.5, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#80a8f0'; c.beginPath(); c.arc( 0, -2, 1.5, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#80f0a0'; c.beginPath(); c.arc( 4, -7, 1.5, 0, Math.PI * 2); c.fill();
  } else if (kind === 'wizard') {
    // tall pointy purple hat with golden stars
    c.fillStyle = '#5a2a8a';
    c.beginPath();
    c.moveTo(-12, 4);
    c.lineTo( 12, 4);
    c.lineTo(  0, -18);   // pointy tip
    c.closePath();
    c.fill();
    // brim — slightly darker than the cone
    c.fillStyle = '#3a1a5a';
    c.fillRect(-14, 2, 28, 3);
    // golden "stars" — small filled circles, three of them in a vertical
    // staircase up the cone. Cheaper than drawing actual five-pointed
    // stars and reads just as well at this size.
    c.fillStyle = '#f0c020';
    c.beginPath(); c.arc(-3,  -3, 1.4, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc( 2,  -8, 1.1, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(-2, -12, 0.9, 0, Math.PI * 2); c.fill();
  }
  c.restore();
}

// ---------- Front-view sprite ----------

// `dir` flips the sprite horizontally so the hamster faces left or right.
// `drinking`, `eatAnim`, `happy`, `chewing` are mode flags from behavior.js
// — they pose the arms and adjust eye/cheek shape to communicate state.
//
// `opts` (optional) lets us re-render the same sprite for a non-player
// hamster (the visiting friend system in visitor.js):
//   opts.hamIdx     — index into HAMS to draw, instead of save.selected
//   opts.leg        — leg-cycle phase, instead of the player's ham.leg
//   opts.isVisitor  — when true, skip everything that's about the *player's*
//                     state: dirt smudges, tired eyes, cosmetic, lucky coin.
//                     Visitors always look clean and rested — they're guests.
export function drawFront(x, y, dir, bob, blink, cheek, drinking, eatAnim, happy, chewing, opts) {
  opts = opts || {};
  const isVisitor = !!opts.isVisitor;
  const hamIdx = opts.hamIdx !== undefined ? opts.hamIdx : save.selected;
  const legPhase = opts.leg !== undefined ? opts.leg : ham.leg;
  const h = HAMS[hamIdx];
  const isSyr = h.type === 'syrian';
  // Idle 'stretch' animation scales the body up briefly. Visitors don't
  // participate (they have no idle state of their own), so they stay at 1.
  const idleSc = isVisitor ? 1 : (ham.idleScale || 1);
  const sc = (isSyr ? 1.15 : 1) * h.fat * idleSc;

  ct.save();
  ct.translate(x, y + bob);
  ct.scale(dir * sc, sc);

  // body (slightly squashed circle) + lighter belly oval
  ct.save();
  ct.scale(1, 0.82);
  ct.beginPath(); ct.arc(0, 0, 38, 0, Math.PI * 2);
  ct.fillStyle = h.body; ct.fill();
  ct.restore();
  ct.beginPath(); ct.arc(0, 10, 24, 0, Math.PI * 2);
  ct.fillStyle = h.belly; ct.fill();

  // dorsal stripe (only some breeds have one)
  if (h.stripe) {
    ct.strokeStyle = h.stripe;
    ct.lineWidth = 4;
    ct.lineCap = 'round';
    ct.beginPath(); ct.moveTo(0, -35); ct.lineTo(0, 10); ct.stroke();
  }

  // Dirt smudges when cleanliness is low. Drawn over the body but under the
  // facial features so they read as ground-in dust without obscuring eyes/nose.
  // Visitors are always considered clean — they don't track their own stats.
  if (!isVisitor && save.stats.clean < 30) {
    ct.fillStyle = 'rgba(80,60,40,0.32)';
    ct.beginPath(); ct.ellipse(-15, 12, 3,   2,    0.4, 0, Math.PI * 2); ct.fill();
    ct.beginPath(); ct.ellipse( 20,  5, 2.5, 1.8, -0.2, 0, Math.PI * 2); ct.fill();
    ct.beginPath(); ct.ellipse( -8, 22, 2,   1.5,  0.2, 0, Math.PI * 2); ct.fill();
    ct.beginPath(); ct.ellipse( 10, -8, 2.5, 1.5,  0.5, 0, Math.PI * 2); ct.fill();
  }

  // ears (outer + inner)
  [[-22, -28], [22, -28]].forEach((e) => {
    ct.beginPath(); ct.arc(e[0], e[1], isSyr ? 13 : 10, 0, Math.PI * 2);
    ct.fillStyle = h.ear; ct.fill();
    ct.beginPath(); ct.arc(e[0], e[1], isSyr ? 8 : 6, 0, Math.PI * 2);
    ct.fillStyle = h.earIn; ct.fill();
  });

  // cheek puff — grows when eating, chewing, or happy. Chewing puffs the
  // most because the hamster is actually loading up its cheek pouches.
  let cp = cheek + (eatAnim ? 0.5 : 0) + (happy ? 0.4 : 0) + (chewing ? 0.6 : 0);
  if (cp > 1) cp = 1;
  ct.fillStyle = 'rgba(240,200,178,0.3)';
  ct.beginPath(); ct.arc(-24, 4, 16 + cp * 8, 0, Math.PI * 2); ct.fill();
  ct.beginPath(); ct.arc( 24, 4, 16 + cp * 8, 0, Math.PI * 2); ct.fill();

  // eyes: happy (squinting arcs + cheek blush) > blinking (flat slits) >
  // tired (half-lidded — only the lower curve of the eye is visible) > normal.
  // Putting `blink` ahead of `tired` means tired hamsters still actually blink
  // periodically; the half-lid is for the *between* moments.
  const tired = !isVisitor && save.stats.energy < 25;
  if (happy) {
    ct.strokeStyle = h.eye;
    ct.lineWidth = 2.5;
    ct.lineCap = 'round';
    ct.beginPath(); ct.arc(-13, -10, 5, Math.PI + 0.3, Math.PI * 2 - 0.3); ct.stroke();
    ct.beginPath(); ct.arc( 13, -10, 5, Math.PI + 0.3, Math.PI * 2 - 0.3); ct.stroke();
    ct.fillStyle = 'rgba(255,150,150,0.3)';
    ct.beginPath(); ct.ellipse(-22, 0, 9, 6, 0, 0, Math.PI * 2); ct.fill();
    ct.beginPath(); ct.ellipse( 22, 0, 9, 6, 0, 0, Math.PI * 2); ct.fill();
  } else if (blink) {
    // blinking: short horizontal slits
    ct.strokeStyle = h.eye;
    ct.lineWidth = 2.5;
    ct.beginPath(); ct.moveTo(-19, -10); ct.lineTo(-7, -10); ct.stroke();
    ct.beginPath(); ct.moveTo(  7, -10); ct.lineTo(19, -10); ct.stroke();
  } else if (tired) {
    // half-lidded: arc(0,π) draws the *lower* half of each eye in canvas
    // coordinates (Y is flipped), then fill closes the chord into a half-moon.
    ct.fillStyle = h.eye;
    ct.beginPath(); ct.arc(-13, -10, 6, 0, Math.PI); ct.fill();
    ct.beginPath(); ct.arc( 13, -10, 6, 0, Math.PI); ct.fill();
  } else {
    // normal: filled circles with a small white catch-light
    [[-13, -10], [13, -10]].forEach((e, i) => {
      ct.beginPath(); ct.arc(e[0], e[1], 6, 0, Math.PI * 2);
      ct.fillStyle = h.eye; ct.fill();
      // Albino syrians have red eyes — overlay an extra red wash so they read as red.
      if (h.eye === '#c03020') {
        ct.fillStyle = 'rgba(255,80,60,0.3)';
        ct.beginPath(); ct.arc(e[0], e[1], 6, 0, Math.PI * 2); ct.fill();
      }
      ct.beginPath(); ct.arc(e[0] + (i ? 2 : -2), e[1] - 2, 2, 0, Math.PI * 2);
      ct.fillStyle = 'rgba(255,255,255,0.7)'; ct.fill();
    });
  }

  // nose
  ct.beginPath(); ct.ellipse(0, -2, 5, 4, 0, 0, Math.PI * 2);
  ct.fillStyle = h.nose; ct.fill();

  // mouth (only drawn when emoting — neutral sprite has no mouth line)
  if (happy) {
    ct.strokeStyle = h.nose;
    ct.lineWidth = 1.5;
    ct.beginPath(); ct.arc(0, 2, 5, 0.2, Math.PI - 0.2); ct.stroke();
  } else if (eatAnim || chewing) {
    ct.strokeStyle = h.nose;
    ct.lineWidth = 1.2;
    ct.beginPath(); ct.arc(0, 2, 4, 0.1, Math.PI - 0.1); ct.stroke();
  }

  // whiskers (3 each side)
  ct.strokeStyle = 'rgba(100,78,58,0.4)';
  ct.lineWidth = 1;
  [[-30, -4, -8, -6], [-30, 2, -8, 0], [-30, 8, -8, 6],
   [ 30, -4,  8, -6], [ 30, 2,  8, 0], [ 30, 8,  8, 6]].forEach((w) => {
    ct.beginPath(); ct.moveTo(w[0], w[1]); ct.lineTo(w[2], w[3]); ct.stroke();
  });

  // feet swing in/out as the leg phase advances — gives the wander
  // animation life. Player hamster uses ham.leg; visitor uses its own.
  const ls = Math.sin(legPhase) * 10;
  ct.fillStyle = h.body;
  ct.beginPath(); ct.ellipse(-14 + ls * 0.5, 30, 9, 6,  0.3, 0, Math.PI * 2); ct.fill();
  ct.beginPath(); ct.ellipse( 14 - ls * 0.5, 30, 9, 6, -0.3, 0, Math.PI * 2); ct.fill();

  // arms-up-to-the-bottle pose, plus a small water droplet
  if (drinking) {
    ct.strokeStyle = h.body;
    ct.lineWidth = 6;
    ct.lineCap = 'round';
    ct.beginPath(); ct.moveTo(-8, 4); ct.lineTo(-20, -15); ct.stroke();
    ct.beginPath(); ct.moveTo( 8, 4); ct.lineTo( 24, -19); ct.stroke();
    ct.fillStyle = 'rgba(98,178,218,0.75)';
    ct.beginPath(); ct.arc(26, -23, 3, 0, Math.PI * 2); ct.fill();
    ct.beginPath(); ct.arc(32, -17, 2, 0, Math.PI * 2); ct.fill();
  }
  // arms-up-to-the-mouth pose (eating or chewing)
  if (eatAnim || chewing) {
    ct.strokeStyle = h.body;
    ct.lineWidth = 6;
    ct.lineCap = 'round';
    ct.beginPath(); ct.moveTo(-8, 4); ct.lineTo(-18, -12); ct.stroke();
    ct.beginPath(); ct.moveTo( 8, 4); ct.lineTo( 18, -14); ct.stroke();
  }

  ct.restore();

  // overlay: cosmetic on head + lucky-coin ingot for 阿財. Skipped for
  // visitors — those are *the player's* decorations, not properties of the
  // hamster breed itself (well, except for yuanbao, but a visitor's lucky
  // coin would muddy the visual cue).
  if (!isVisitor) {
    drawCosmetic(ct, x, y - 32 * sc + bob, 1, save.equipped);
    if (h.yuanbao) drawYuanbao(ct, x, y - 48 * sc + bob, 1.15);
  }
}

// ---------- Side-view sprite (used while running on the wheel) ----------

export function drawSide(x, y, leg, bob) {
  const h = HAMS[save.selected];
  const isSyr = h.type === 'syrian';
  const sc = (isSyr ? 1.15 : 1) * h.fat;

  ct.save();
  ct.translate(x, y + bob);
  ct.scale(sc, sc);

  // body + belly + tail-side stripe (if any)
  ct.fillStyle = h.body;
  ct.beginPath(); ct.ellipse(0, 0, 40, 26, 0, 0, Math.PI * 2); ct.fill();
  ct.fillStyle = h.belly;
  ct.beginPath(); ct.ellipse(6, 5, 20, 16, 0.15, 0, Math.PI * 2); ct.fill();
  if (h.stripe) {
    ct.strokeStyle = h.stripe;
    ct.lineWidth = 3;
    ct.beginPath(); ct.moveTo(-38, 0); ct.lineTo(30, -4); ct.stroke();
  }

  // Dirt smudges (matches the front view — see drawFront).
  if (save.stats.clean < 30) {
    ct.fillStyle = 'rgba(80,60,40,0.32)';
    ct.beginPath(); ct.ellipse(-15,  5, 3,   2,    0.4, 0, Math.PI * 2); ct.fill();
    ct.beginPath(); ct.ellipse( 10,  8, 2.5, 1.8, -0.2, 0, Math.PI * 2); ct.fill();
    ct.beginPath(); ct.ellipse(-25, -2, 2.5, 1.5,  0.3, 0, Math.PI * 2); ct.fill();
  }

  // head + ear
  ct.fillStyle = h.body;
  ct.beginPath(); ct.arc(34, -8, isSyr ? 22 : 19, 0, Math.PI * 2); ct.fill();
  ct.beginPath(); ct.arc(28, -24, isSyr ? 11 : 8, 0, Math.PI * 2);
  ct.fillStyle = h.ear; ct.fill();
  ct.beginPath(); ct.arc(28, -24, isSyr ? 7 : 4, 0, Math.PI * 2);
  ct.fillStyle = h.earIn; ct.fill();

  // cheek + eye
  ct.fillStyle = 'rgba(240,200,178,0.38)';
  ct.beginPath(); ct.ellipse(36, -2, 15, 11, 0.25, 0, Math.PI * 2); ct.fill();
  ct.beginPath(); ct.arc(45, -13, 5, 0, Math.PI * 2);
  ct.fillStyle = h.eye; ct.fill();
  if (h.eye === '#c03020') {
    ct.fillStyle = 'rgba(255,80,60,0.3)';
    ct.beginPath(); ct.arc(45, -13, 5, 0, Math.PI * 2); ct.fill();
  }
  ct.beginPath(); ct.arc(44, -14, 1.5, 0, Math.PI * 2);
  ct.fillStyle = 'rgba(255,255,255,0.7)'; ct.fill();

  // nose
  ct.beginPath(); ct.ellipse(51, -6, 4, 3, 0, 0, Math.PI * 2);
  ct.fillStyle = h.nose; ct.fill();

  // whiskers
  ct.strokeStyle = 'rgba(100,78,58,0.5)';
  ct.lineWidth = 0.9;
  [[51, -9, 66, -11], [51, -6, 66, -6], [51, -3, 66, -1]].forEach((w) => {
    ct.beginPath(); ct.moveTo(w[0], w[1]); ct.lineTo(w[2], w[3]); ct.stroke();
  });

  // small tail
  ct.fillStyle = h.body;
  ct.beginPath(); ct.ellipse(-36, 1, 7, 4, 0.2, 0, Math.PI * 2); ct.fill();

  // four legs running in opposed pairs (phase offsets give the gallop)
  const legs = [
    { ox: -12, base: 22, ph: 0 },
    { ox:   4, base: 24, ph: Math.PI },
    { ox: -20, base: 20, ph: Math.PI * 0.5 },
    { ox:  12, base: 22, ph: Math.PI * 1.5 },
  ];
  legs.forEach((l) => {
    const sw = Math.sin(leg + l.ph) * 12;
    const lift = Math.max(0, Math.sin(leg + l.ph)) * 8;
    ct.strokeStyle = h.body;
    ct.lineWidth = 6;
    ct.lineCap = 'round';
    ct.beginPath();
    ct.moveTo(l.ox, l.base - 4);
    ct.lineTo(l.ox + sw * 0.4, l.base + 8 - lift);
    ct.stroke();
    // foot pad
    ct.fillStyle = h.earIn;
    ct.beginPath();
    ct.ellipse(l.ox + sw * 0.4 + 3, l.base + 10 - lift, 5, 3, sw * 0.05, 0, 0, Math.PI * 2);
    ct.fill();
  });

  ct.restore();

  drawCosmetic(ct, x + 18 * sc, y - 26 * sc + bob, 1, save.equipped);
  if (h.yuanbao) drawYuanbao(ct, x, y - 48 * sc + bob, 1.15);
}

// ---------- Picker portrait (head only, used on the select screen) ----------

export function drawHamPortrait(c, h, x, y, scale) {
  c.save();
  c.translate(x, y);
  c.scale(scale * h.fat, scale * h.fat);
  const isSyr = h.type === 'syrian';
  const br = isSyr ? 30 : 24;

  // body lump
  c.fillStyle = h.body;
  c.save(); c.scale(1, 0.82);
  c.beginPath(); c.arc(0, 0, br, 0, Math.PI * 2); c.fill();
  c.restore();

  // belly
  c.fillStyle = h.belly;
  c.beginPath(); c.arc(0, 8, isSyr ? 19 : 15, 0, Math.PI * 2); c.fill();

  if (h.stripe) {
    c.strokeStyle = h.stripe;
    c.lineWidth = 3;
    c.lineCap = 'round';
    c.beginPath(); c.moveTo(0, -22); c.lineTo(0, 6); c.stroke();
  }

  // ears
  const er = isSyr ? 10 : 8, ei = isSyr ? 6 : 5;
  [[-16, -22], [16, -22]].forEach((e) => {
    c.beginPath(); c.arc(e[0], e[1], er, 0, Math.PI * 2); c.fillStyle = h.ear; c.fill();
    c.beginPath(); c.arc(e[0], e[1], ei, 0, Math.PI * 2); c.fillStyle = h.earIn; c.fill();
  });

  // eyes
  [[-9, -7], [9, -7]].forEach((e) => {
    c.beginPath(); c.arc(e[0], e[1], 4.5, 0, Math.PI * 2); c.fillStyle = h.eye; c.fill();
    if (h.eye === '#c03020') {
      c.fillStyle = 'rgba(255,80,60,0.35)';
      c.beginPath(); c.arc(e[0], e[1], 4.5, 0, Math.PI * 2); c.fill();
    }
    c.fillStyle = 'rgba(255,255,255,0.65)';
    c.beginPath(); c.arc(e[0] - 1, e[1] - 1, 1.2, 0, Math.PI * 2); c.fill();
  });

  // nose + whiskers
  c.fillStyle = h.nose;
  c.beginPath(); c.ellipse(0, -1, 3.5, 3, 0, 0, Math.PI * 2); c.fill();
  c.strokeStyle = 'rgba(100,80,60,0.4)';
  c.lineWidth = 0.8;
  [[-18, -3, -7, -4], [-18, 1, -7, 0], [18, -3, 7, -4], [18, 1, 7, 0]].forEach((w) => {
    c.beginPath(); c.moveTo(w[0], w[1]); c.lineTo(w[2], w[3]); c.stroke();
  });

  c.restore();
  if (h.yuanbao) drawYuanbao(c, x, y - 38, 0.9);
}

// Convenience: keep the original `feetY` formula in one place.
// (Used by behavior.js to drop poops/shells at the hamster's feet.)
export const HAM_FEET_OFFSET = 28;

// `ham` is exported by state.js; expose `getH` via this thin helper so callers
// don't have to remember the indirection. Kept here because hamster
// rendering is the only place we look up the hamster definition.
export function getH() { return HAMS[save.selected]; }

// ---------- Status bubble (cloud above hamster) ----------

// Pick at most one icon to show. Priority order is biological urgency:
// thirst kills fastest, then hunger; energy/cleanliness are secondary; happy
// is last so it doesn't drown out the others when the hamster is just bored.
function pickStatusBubble(stats) {
  if (stats.thirst < 30) return { icon: '💧', tint: '#7ad0f0' };
  if (stats.hunger < 30) return { icon: '🍽️', tint: '#f0b870' };
  if (stats.energy < 25) return { icon: '💤', tint: '#a0b8d8' };
  if (stats.clean  < 25) return { icon: '🛁', tint: '#d8a8e0' };
  if (stats.happy  < 30) return { icon: '😢', tint: '#e0a0a0' };
  return null;
}

// Soft elliptical shadow drawn under the hamster on the cage floor. The
// shadow stays put while the hamster bobs/hops — its width and opacity
// shrink slightly when the hamster is high (negative bob), so the lift
// reads visually instead of being just a number.
//
// Skipped when the hamster isn't on the ground at all (wheel, climbing,
// ladder, napping). For visitors, callers pass a 'wander' mode and an
// `opts.hamIdx` override so the shadow uses the visitor's body scale.
export function drawShadow(x, y, mode, bob, opts) {
  if (mode === 'napping' || mode === 'onwheel' || mode === 'climbing' ||
      mode === 'descending' || mode === 'climbingLadder' ||
      mode === 'onLadder' || mode === 'slidingDown') return;
  opts = opts || {};
  const isVisitor = !!opts.isVisitor;
  const hamIdx = opts.hamIdx !== undefined ? opts.hamIdx : save.selected;
  const h = HAMS[hamIdx];
  const idleSc = isVisitor ? 1 : (ham.idleScale || 1);
  const sc = (h.type === 'syrian' ? 1.15 : 1) * h.fat * idleSc;
  // Lift factor: 0 when on the ground, ~1 at the peak of a happy-hop.
  const lift = Math.max(0, -bob) / 12;
  const shadowW = (28 - lift * 6) * sc;
  const shadowH = (4.5 - lift * 1.5) * sc;
  const alpha = Math.max(0.06, 0.18 - lift * 0.08);
  ct.save();
  ct.fillStyle = `rgba(50,30,12,${alpha.toFixed(3)})`;
  ct.beginPath();
  ct.ellipse(x, y + 30 * sc, shadowW, shadowH, 0, 0, Math.PI * 2);
  ct.fill();
  ct.restore();
}

// Brief "!" bubble that appears the moment a seed is dropped on the
// hamster, before the eat animation settles in. Pops in, drifts up, fades
// out over its 30-frame lifetime.
export function drawExcitement(x, y, t) {
  if (t <= 0) return;
  const totalFrames = 30;
  const progress = (totalFrames - t) / totalFrames;
  // Pop in fast, then float up: scale eases-out, y drifts linearly.
  const scale = Math.min(1, progress * 3);
  const yOff = -8 - progress * 12;
  const alpha = Math.max(0, 1 - progress);
  ct.save();
  ct.globalAlpha = alpha;
  // Yellow round bubble with a brown "!"
  ct.translate(x, y - 36 + yOff);
  ct.scale(scale, scale);
  ct.fillStyle = '#ffe680';
  ct.strokeStyle = '#a06820';
  ct.lineWidth = 1.5;
  ct.beginPath();
  ct.arc(0, 0, 9, 0, Math.PI * 2);
  ct.fill();
  ct.stroke();
  ct.fillStyle = '#5a3010';
  ct.font = 'bold 12px sans-serif';
  ct.textAlign = 'center';
  ct.textBaseline = 'middle';
  ct.fillText('!', 0, 1);
  ct.restore();
}

// Floating-letter overlay for idle micro-animations. Currently only 'yawn'
// produces visible text (a slowly rising "z"); 'stretch' and 'lookAround'
// are conveyed entirely through the sprite itself (idleScale / dir flips)
// and don't need a label. Called from main.js's draw after drawFront.
export function drawIdleOverlay(x, y, idleType, idleTimer) {
  if (idleType !== 'yawn') return;
  // The "z" rises and fades over the 60-frame yawn. Two letters offset so
  // it reads more like a sleepy aura than a single character.
  const totalFrames = 60;
  const progress = (totalFrames - idleTimer) / totalFrames;
  const yOff = -progress * 22;
  const alpha = Math.min(1, 1 - progress) * 0.85;
  ct.save();
  ct.globalAlpha = Math.max(0, alpha);
  ct.fillStyle = '#7a4818';
  ct.font = 'bold 14px sans-serif';
  ct.textAlign = 'center';
  ct.fillText('z', x + 28, y - 26 + yOff);
  ct.font = 'bold 11px sans-serif';
  ct.fillText('z', x + 36, y - 18 + yOff * 1.2);
  ct.restore();
}

// Draws a small thought-cloud above the hamster with whichever icon is most
// urgent. Called from main.js's draw loop after the sprite, so it always
// renders on top. Skipped while napping (we hide the hamster anyway) and
// while running on the wheel (the bubble would clip into the rim).
export function drawStatusBubble(x, y, mode, frame) {
  if (mode === 'napping' || mode === 'onwheel' || mode === 'climbing' || mode === 'descending') return;
  const bubble = pickStatusBubble(save.stats);
  if (!bubble) return;

  const bob = Math.sin(frame * 0.06) * 2;
  const bx = x + 32;     // offset to upper-right of the hamster's head
  const by = y - 56 + bob;

  ct.save();
  ct.fillStyle = '#fff';
  ct.strokeStyle = bubble.tint;
  ct.lineWidth = 2;

  // Cloud shape — three overlapping circles, then filled & stroked together.
  ct.beginPath();
  ct.arc(bx - 8, by + 4, 6, 0, Math.PI * 2);
  ct.arc(bx + 8, by + 4, 6, 0, Math.PI * 2);
  ct.arc(bx,     by - 5, 9, 0, Math.PI * 2);
  ct.fill();
  ct.stroke();

  // Two trailing dots (smaller-then-smaller) toward the hamster's head, the
  // standard "thought" trail.
  ct.lineWidth = 1.5;
  ct.beginPath(); ct.arc(bx - 14, by + 12, 2.5, 0, Math.PI * 2); ct.fill(); ct.stroke();
  ct.beginPath(); ct.arc(bx - 18, by + 18, 1.5, 0, Math.PI * 2); ct.fill(); ct.stroke();

  // Icon inside. We don't worry about font fallback since these are emoji.
  ct.font = '14px sans-serif';
  ct.textAlign = 'center';
  ct.textBaseline = 'middle';
  ct.fillStyle = '#000';
  ct.fillText(bubble.icon, bx, by - 3);

  ct.restore();
}
