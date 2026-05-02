/*
 * selectscreen.js
 *
 * The hamster picker shown before play begins. Six clickable cards in a 3×2
 * grid; the selected one gets a darker "selected" treatment with a check
 * badge. A "Play" button at the bottom kicks off the game.
 *
 * Hit-testing happens here too: cardBounds(i) returns the click rectangle
 * for each card, which input.js calls into to figure out what was clicked.
 */

import { ct } from './canvas.js';
import { view, save } from './state.js';
import { HAMS } from './config.js';
import { drawHamPortrait } from './hamster.js';

// Card layout — three columns, dynamically sized to fit narrow viewports.
export function cardBounds(i) {
  const cols = 3;
  const cw = Math.min(158, (view.W - 80) / 3);
  const ch = 158;
  const gap = 12;
  const totalW = cols * cw + (cols - 1) * gap;
  const gx = (view.W - totalW) / 2;
  const gy = 86;
  return {
    x: gx + (i % cols) * (cw + gap),
    y: gy + Math.floor(i / cols) * (ch + gap),
    w: cw,
    h: ch,
  };
}

export function drawSelectScreen() {
  // soft cream gradient backdrop
  const grd = ct.createLinearGradient(0, 0, 0, view.H);
  grd.addColorStop(0, '#fdf8f0');
  grd.addColorStop(1, '#ede0c8');
  ct.fillStyle = grd;
  ct.fillRect(0, 0, view.W, view.H);

  // Header + subhead
  ct.fillStyle = '#4a2e10';
  ct.font = 'bold 22px Georgia,serif';
  ct.textAlign = 'center';
  ct.fillText('🐹 Choose Your Hamster', view.W / 2, 42);
  ct.fillStyle = '#9a7050';
  ct.font = '12px sans-serif';
  ct.fillText(
    'Click to select, then press Play  •  💰 ' + save.coins + ' coins saved',
    view.W / 2, 62,
  );

  // separator line
  ct.strokeStyle = 'rgba(150,110,60,0.25)';
  ct.lineWidth = 1;
  ct.beginPath(); ct.moveTo(50, 74); ct.lineTo(view.W - 50, 74); ct.stroke();

  HAMS.forEach((h, i) => {
    const b = cardBounds(i);
    const sel = save.selected === i;
    const hov = view.selHover === i;

    // Card background — selected wins over hover wins over default
    ct.fillStyle   = sel ? '#c8924a' : (hov ? '#f0e0c8' : '#faf4ec');
    ct.strokeStyle = sel ? '#8a5a18' : (hov ? '#c09060' : 'rgba(180,140,90,0.35)');
    ct.lineWidth = sel ? 2.5 : 1.2;
    ct.fillRect(b.x, b.y, b.w, b.h);
    ct.strokeRect(b.x, b.y, b.w, b.h);

    // portrait
    drawHamPortrait(ct, h, b.x + b.w / 2, b.y + 50, h.type === 'syrian' ? 1.1 : 0.88);

    // breed badge in the top-left corner
    ct.fillStyle = h.type === 'syrian' ? '#b86830' : '#4a80a8';
    ct.fillRect(b.x + 6, b.y + 6, h.type === 'syrian' ? 46 : 36, 15);
    ct.fillStyle = '#fff';
    ct.font = 'bold 8px sans-serif';
    ct.textAlign = 'center';
    ct.fillText(h.type === 'syrian' ? 'Syrian' : 'Dwarf',
                b.x + 6 + (h.type === 'syrian' ? 23 : 18), b.y + 16);

    // name + romanization + breed line
    ct.fillStyle = sel ? '#fff' : '#3a2008';
    ct.font = 'bold 16px sans-serif';
    ct.textAlign = 'center';
    ct.fillText(h.name, b.x + b.w / 2, b.y + b.h - 32);
    ct.fillStyle = sel ? 'rgba(255,255,255,0.85)' : '#9a7050';
    ct.font = '11px sans-serif';
    ct.fillText(h.roman, b.x + b.w / 2, b.y + b.h - 16);
    ct.fillStyle = sel ? 'rgba(255,255,255,0.7)' : '#b8987a';
    ct.font = '9px sans-serif';
    ct.fillText(h.desc, b.x + b.w / 2, b.y + b.h - 3);

    // ✓ badge in the top-right when selected
    if (sel) {
      ct.fillStyle = '#6a3e12';
      ct.beginPath();
      ct.arc(b.x + b.w - 10, b.y + 10, 9, 0, Math.PI * 2);
      ct.fill();
      ct.fillStyle = '#fff';
      ct.font = 'bold 10px sans-serif';
      ct.textAlign = 'center';
      ct.fillText('✓', b.x + b.w - 10, b.y + 14);
    }
  });

  // Play button at the bottom — input.js hit-tests against this rect.
  const bx = view.W / 2 - 55, by = view.H - 54, bw = 110, bh = 38;
  ct.fillStyle = '#6a3e12';
  ct.fillRect(bx, by, bw, bh);
  ct.fillStyle = 'rgba(255,255,255,0.14)';
  ct.fillRect(bx, by, bw, bh * 0.45);
  ct.fillStyle = '#fff';
  ct.font = 'bold 14px sans-serif';
  ct.textAlign = 'center';
  ct.fillText('▶  Play', view.W / 2, by + 24);
}
