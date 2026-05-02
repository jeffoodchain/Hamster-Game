/*
 * tooltips.js
 *
 * Hover tooltips for the habitat. New players see the canvas and have to
 * guess what each thing is for; this module fills in those blanks with a
 * one-line description that follows the cursor.
 *
 * Implementation:
 *   - One absolutely-positioned <div id="tooltip"> in index.html, populated
 *     and repositioned on mousemove
 *   - whichItem(mx,my) returns the id of the item under the cursor (or null)
 *   - TIPS maps each id to its shown text
 *   - Tooltips are suppressed during drags (the player has bigger concerns)
 *     and on the select screen
 *
 * Touch devices are intentionally not handled — without a hover concept
 * tooltips would either need a clumsy long-press or get in the way of
 * normal taps. The bottom status pill (#hst) already gives feedback on
 * mobile actions, which is the same role tooltips serve here.
 */

import { cv, container } from './canvas.js';
import { view, ball, drag, save } from './state.js';
import {
  WCX, WCY, WR, BCX, BCY, HUT_X, FLY,
  CHEW_X, CHEW_Y, SAND_X, SAND_Y, JAR_X, JAR_Y,
  BASKX, BASKY, BINX, BINY, LADDER_X, LADDER_TOP, LADDER_BOTTOM,
} from './layout.js';

const TIPS = {
  wheel:  '🎡 Running Wheel — Click to make your hamster run.',
  bottle: '💧 Water Bottle — Click to drink. Restores thirst.',
  hut:    '🏡 Sleep Hut — Click to nap. Restores energy.',
  basket: '🌻 Seed Basket — Drag a seed onto your hamster to feed.',
  bin:    '♻️ Recycle Bin — Cleaned items get binned here.',
  chew:   '🪵 Chew Log — Click for a satisfying chew. Boosts happiness.',
  sand:   '🏖️ Sand Bath — Click to clean off. Boosts cleanliness.',
  jar:    '🫙 Treat Jar — Click to open the treats shop.',
  ball:   '🔴 Bouncy Ball — Drag to fling, or wait for hamster to play.',
  ladder: '🪜 Climbing Ladder — Click to climb, perch, and slide!',
};

// Returns the id of the item directly under (mx, my), or null. Order
// matches the click handler in input.js: ball first (smallest hit zone),
// then specific items in any order, then large hitboxes last so they
// don't shadow smaller targets sitting on top of them.
function whichItem(mx, my) {
  if (ball.active && Math.hypot(mx - ball.x, my - ball.y) < 18) return 'ball';

  if (Math.hypot(mx - WCX(), my - WCY()) <= WR() + 14) return 'wheel';

  // bottle: tall rectangle around the spout
  const bx = BCX(), by = BCY();
  if (mx >= bx - 12 && mx <= bx + 34 && my >= by - 22 && my <= by + 74) return 'bottle';

  if (Math.abs(mx - HUT_X()) < 36 && my >= FLY() - 50 && my <= FLY() + 20) return 'hut';

  if (Math.hypot(mx - CHEW_X(), my - CHEW_Y()) < 46) return 'chew';
  if (Math.hypot(mx - SAND_X(), my - SAND_Y()) < 36) return 'sand';

  if (Math.abs(mx - JAR_X()) < 22 && Math.abs(my - (JAR_Y() - 16)) < 26) return 'jar';

  // Ladder is only a tooltip target if it's been bought.
  if (save.owned.ladder &&
      Math.abs(mx - LADDER_X()) < 22 &&
      my >= LADDER_TOP() - 12 && my <= LADDER_BOTTOM() + 4) return 'ladder';

  // basket and bin — looser hitboxes since they're large rectangular shapes
  const baskBx = BASKX(), baskBy = BASKY();
  if (Math.abs(mx - baskBx) < 26 && my > baskBy - 30 && my < baskBy + 12) return 'basket';

  const binBx = BINX(), binBy = BINY();
  if (Math.abs(mx - binBx) < 24 && my > binBy - 38 && my < binBy + 6) return 'bin';

  return null;
}

let tipEl = null;

function ensureTipEl() {
  if (!tipEl) tipEl = document.getElementById('tooltip');
  return tipEl;
}

function setTooltip(text, logicalX, logicalY) {
  const el = ensureTipEl();
  if (!el) return;
  if (!text) {
    el.classList.remove('show');
    return;
  }
  // The tooltip is a child of #gameContainer, so its left/top are
  // container-relative. We have to convert from canvas-logical (view.W/H)
  // back into CSS pixels, which depends on the canvas's actual displayed size.
  const r = container.getBoundingClientRect();
  const cssX = (logicalX / view.W) * r.width;
  const cssY = (logicalY / view.H) * r.height;
  el.textContent = text;
  el.style.left = cssX + 'px';
  el.style.top  = cssY + 'px';
  el.classList.add('show');
}

export function initTooltips() {
  cv.addEventListener('mousemove', (e) => {
    // Don't show tooltips during drags or before the player has entered the
    // game. Both states already have other UI commanding the player's attention.
    if (view.gameScreen !== 'game' || drag.active || ball.dragging) {
      setTooltip(null);
      return;
    }
    const r = cv.getBoundingClientRect();
    const mx = (e.clientX - r.left) * (view.W / r.width);
    const my = (e.clientY - r.top)  * (view.H / r.height);
    const item = whichItem(mx, my);
    if (!item) {
      setTooltip(null);
      return;
    }
    setTooltip(TIPS[item], mx, my);
  });

  // Pointer leaving the canvas should always retract the tooltip.
  cv.addEventListener('mouseleave', () => setTooltip(null));
}
