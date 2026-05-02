/*
 * input.js
 *
 * All pointer/touch handling lives here. The flow:
 *
 *   mousedown / touchstart  → handleClick(mx, my)
 *     - on the select screen: check cards + Play button
 *     - in game:              try drag (seed or ball), else hit-test items
 *   mousemove  / touchmove   → update drag preview position OR drag the ball
 *   mouseup    / touchend    → dropSeed() — completes either drag
 *
 * `evPos()` converts a DOM event's clientX/Y into our logical canvas
 * coordinates (the same system every drawing function uses), accounting
 * for the canvas's CSS-vs-buffer scale.
 *
 * Audio gets unlocked on the first click via ensureAudio() — browsers
 * require a user gesture before AudioContext can play sound.
 */

import {
  cv, st, container, fullscreenBtn, hud, backBtn,
  shopModal, shopBtn, sleepOverlay,
} from './canvas.js';
import { view, save, ham, ball, drag, entities } from './state.js';
import {
  WCX, WCY, WR, BCX, BCY, HUT_X, FLY,
  CHEW_X, CHEW_Y, SAND_X, SAND_Y, JAR_X, JAR_Y,
  BASKX, BASKY, BINX, BINY, LADDER_X, LADDER_TOP, LADDER_BOTTOM,
} from './layout.js';
import { ensureAudio, snd } from './audio.js';
import {
  goWheel, goDrink, goNap, goChew, goBath, goLadder,
  petHamster, feedSeed, addCoins, hamPos, resetGame, spawnPoop,
} from './behavior.js';
import { buildBg } from './background.js';
import { cardBounds } from './selectscreen.js';
import { openShopModal } from './shop.js';
import { persist } from './save.js';
import { HAMS } from './config.js';
import { updateHud } from './hud.js';
import { bumpCounter } from './achievements.js';
import { maybeShowFirstRun } from './firstrun.js';
import { startTreatRain, tryCatchAt, isMinigameActive } from './minigame.js';
import { checkDailyStreak } from './streak.js';
import { fadeOutMusic } from './music.js';

function evPos(e) {
  const r = cv.getBoundingClientRect();
  const src = e.touches ? e.touches[0] : e;
  // r.width / r.height are CSS pixels; view.W/H are logical canvas pixels.
  // They normally match (the canvas is 100% of its container) but we scale
  // anyway in case CSS resizes the element to a non-1:1 ratio.
  return {
    x: (src.clientX - r.left) * (view.W / r.width),
    y: (src.clientY - r.top)  * (view.H / r.height),
  };
}

// Try to start a drag operation. Either a seed from the basket or the
// physical ball can be picked up. Returns true if a drag was started.
function tryStartDrag(mx, my) {
  if (view.gameScreen !== 'game') return false;

  // Seeds in the basket
  const bx = BASKX(), by = BASKY();
  for (let i = 0; i < entities.basketSeeds.length; i++) {
    const s = entities.basketSeeds[i];
    if (s.eaten || s.dragging) continue;
    const sx = bx + s.ox;
    const sy = by - 16 + s.oy;
    if (Math.hypot(mx - sx, my - sy) < 16) {
      s.dragging = true;
      drag.active = true;
      drag.seedIdx = i;
      drag.jarTreat = false;
      drag.x = mx; drag.y = my;
      drag.type = s.type;
      drag.angle = s.ox * 0.08;
      return true;
    }
  }

  // Bouncy ball — pick up + carry. Velocity is recovered on release for a fling.
  if (ball.active && !ball.dragging && Math.hypot(mx - ball.x, my - ball.y) < 18) {
    ball.dragging = true;
    ball.dragOffX = mx - ball.x;
    ball.dragOffY = my - ball.y;
    ball.lastX = mx; ball.lastY = my;
    return true;
  }

  return false;
}

// Called on mouseup / touchend. Resolves whichever drag was in progress.
function dropSeed(mx, my) {
  // Ball drop: turn the recent drag motion into a fling velocity.
  if (ball.dragging) {
    ball.dragging = false;
    ball.vx = (mx - ball.lastX) * 0.6;
    ball.vy = (my - ball.lastY) * 0.6;
    snd('roll');
    return;
  }

  if (!drag.active) return;

  // Treat-jar treats are bought-and-fed from the shop, not dragged in-canvas.
  // The flag is here for safety: if jarTreat is somehow active, just clear it.
  if (drag.jarTreat) { drag.active = false; return; }

  const p = hamPos();
  if (Math.hypot(mx - p.x, my - p.y) < 65 && (ham.mode === 'wander' || ham.mode === 'happy')) {
    feedSeed(drag.seedIdx, drag.x);
  } else {
    // Drop missed the hamster — return the seed to the basket.
    const s = entities.basketSeeds[drag.seedIdx];
    if (s) s.dragging = false;
  }
  drag.active = false;
  drag.seedIdx = -1;
}

// Top-level click dispatcher. Order matters here: the most specific targets
// (drag handles, draggable items, items inside other items) come first; the
// catch-all "did you click on the hamster" goes last.
function handleClick(mx, my) {
  ensureAudio();

  // ----- Select screen -----
  if (view.gameScreen === 'select') {
    HAMS.forEach((_, i) => {
      const b = cardBounds(i);
      if (mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h) {
        save.selected = i;
        persist();
        snd('click');
      }
    });
    // Play button
    if (mx >= view.W / 2 - 55 && mx <= view.W / 2 + 55 &&
        my >= view.H - 54  && my <= view.H - 16) {
      view.gameScreen = 'game';
      buildBg();
      resetGame();
      st.textContent = `Welcome, ${HAMS[save.selected].name} (${HAMS[save.selected].roman})! ♥`;
      backBtn.style.display = 'block';
      hud.classList.add('show');
      // Drop the first poop after a short grace period so the player has
      // an early thing to clean and learns that interaction.
      setTimeout(spawnPoop, 1500);
      // Slide in the welcome tips for first-time players.
      maybeShowFirstRun();
      // Daily-streak check + bonus toast (no-op if already logged in today).
      checkDailyStreak();
      snd('buy');
    }
    return;
  }

  // ----- Treat Rain mini-game: catches take priority during a round -----
  if (isMinigameActive() && tryCatchAt(mx, my)) return;

  // ----- In game: drag handles -----
  if (tryStartDrag(mx, my)) return;

  // ----- Click on a poop pile -----
  for (let i = entities.poops.length - 1; i >= 0; i--) {
    const p = entities.poops[i];
    let hit = false;
    for (const pel of p.pellets) {
      if (Math.hypot(mx - (p.x + pel.dx), my - (p.y + pel.dy)) < pel.rx * 3) {
        hit = true; break;
      }
    }
    if (hit) {
      entities.flyingPoops.push({ sx: p.x, sy: p.y, pellets: p.pellets, t: 0 });
      entities.poops.splice(i, 1);
      entities.binCount++;
      addCoins(1, p.x, p.y);
      save.stats.clean = Math.min(100, save.stats.clean + 4);
      st.textContent = `Cleaned! ${entities.binCount} poop${entities.binCount === 1 ? '' : 's'} in bin`;
      bumpCounter('cleaned');
      return;
    }
  }

  // ----- Click on a sunflower shell -----
  for (let i = entities.shells.length - 1; i >= 0; i--) {
    const sh = entities.shells[i];
    if (Math.hypot(mx - sh.x, my - sh.y) < 16) {
      entities.flyingItems.push({ sx: sh.x, sy: sh.y, angle: sh.angle, t: 0 });
      entities.shells.splice(i, 1);
      addCoins(1, sh.x, sh.y);
      save.stats.clean = Math.min(100, save.stats.clean + 2);
      st.textContent = 'Shell binned! +1 💰';
      bumpCounter('cleaned');
      return;
    }
  }

  // ----- Wheel: click to start a run, or to abort one -----
  const wr = WR(), wcx = WCX(), wcy = WCY();
  if (Math.hypot(mx - wcx, my - wcy) <= wr + 14) {
    if (ham.mode === 'wander') { goWheel(); return; }
    if (ham.mode === 'onwheel') { ham.wTimer = 0; ham.runTgt = 0; return; }
  }

  // ----- Bottle hitbox -----
  const bx = BCX(), by = BCY();
  if (mx >= bx - 12 && mx <= bx + 34 && my >= by - 22 && my <= by + 74) {
    if (ham.mode === 'wander') { goDrink(); return; }
  }

  // ----- Hut: tap to nap, tap again to wake up -----
  const hutX = HUT_X();
  if (Math.abs(mx - hutX) < 36 && my >= FLY() - 50 && my <= FLY() + 20) {
    if (ham.mode === 'wander') { goNap(); return; }
    if (ham.mode === 'napping') { ham.napTimer = 0; return; }
  }

  // ----- Chew log -----
  if (Math.hypot(mx - CHEW_X(), my - CHEW_Y()) < 46 && ham.mode === 'wander') {
    goChew(); return;
  }

  // ----- Sand bath -----
  if (Math.hypot(mx - SAND_X(), my - SAND_Y()) < 36 && ham.mode === 'wander') {
    goBath(); return;
  }

  // ----- Treat jar: opens the shop straight to the Treats tab -----
  if (Math.abs(mx - JAR_X()) < 22 && Math.abs(my - (JAR_Y() - 16)) < 26) {
    openShopModal('treats');
    return;
  }

  // ----- Climbing ladder (only if owned) -----
  if (save.owned.ladder &&
      Math.abs(mx - LADDER_X()) < 22 &&
      my >= LADDER_TOP() - 12 && my <= LADDER_BOTTOM() + 4) {
    if (ham.mode === 'wander') { goLadder(); return; }
  }

  // ----- Hamster itself (last so item targets aren't shadowed) -----
  const p = hamPos();
  if (Math.hypot(mx - p.x, my - p.y) < 55) {
    if (ham.mode === 'onwheel')  { ham.wTimer = 0; ham.runTgt = 0; return; }
    if (ham.mode === 'napping')  { ham.napTimer = 0;               return; }
    petHamster();
  }
}

// Treat Rain button — start a round (the mini-game module handles the
// already-running and on-cooldown cases internally).
const rainBtn = document.getElementById('rainBtn');
if (rainBtn) rainBtn.addEventListener('click', () => { startTreatRain(); });

// "Change Hamster" — leave the play screen and return to the picker.
backBtn.addEventListener('click', () => {
  view.gameScreen = 'select';
  backBtn.style.display = 'none';
  hud.classList.remove('show');
  st.textContent = '';
  view.selHover = -1;
  persist();
  sleepOverlay.style.background = 'transparent';
  // Music keeps oscillators running for life-of-page; fade them down so
  // the pad doesn't drone under the picker UI.
  fadeOutMusic();
  snd('click');
});

// ---------- Pointer wiring ----------

cv.addEventListener('mousedown', (e) => {
  const pos = evPos(e);
  handleClick(pos.x, pos.y);
});

cv.addEventListener('mousemove', (e) => {
  const pos = evPos(e);
  if (view.gameScreen === 'select') {
    // Update card hover highlight
    view.selHover = -1;
    HAMS.forEach((_, i) => {
      const b = cardBounds(i);
      if (pos.x >= b.x && pos.x <= b.x + b.w && pos.y >= b.y && pos.y <= b.y + b.h) {
        view.selHover = i;
      }
    });
    return;
  }
  if (ball.dragging) {
    // Save the previous position so dropSeed can compute a fling velocity.
    ball.lastX = ball.x; ball.lastY = ball.y;
    ball.x = pos.x - (ball.dragOffX || 0);
    ball.y = pos.y - (ball.dragOffY || 0);
    return;
  }
  if (drag.active) { drag.x = pos.x; drag.y = pos.y; }
});

cv.addEventListener('mouseup', (e) => {
  const pos = evPos(e);
  dropSeed(pos.x, pos.y);
});

// Touch handlers — preventDefault stops the browser from interpreting these
// as scroll/zoom so our drag still works on phones.
cv.addEventListener('touchstart', (e) => {
  e.preventDefault();
  const pos = evPos(e);
  handleClick(pos.x, pos.y);
}, { passive: false });

cv.addEventListener('touchmove', (e) => {
  e.preventDefault();
  const pos = evPos(e);
  if (ball.dragging) {
    ball.lastX = ball.x; ball.lastY = ball.y;
    ball.x = pos.x - (ball.dragOffX || 0);
    ball.y = pos.y - (ball.dragOffY || 0);
    return;
  }
  if (drag.active) { drag.x = pos.x; drag.y = pos.y; }
}, { passive: false });

cv.addEventListener('touchend', (e) => {
  e.preventDefault();
  if (e.changedTouches.length > 0) {
    const t = e.changedTouches[0];
    const r = cv.getBoundingClientRect();
    dropSeed(
      (t.clientX - r.left) * (view.W / r.width),
      (t.clientY - r.top)  * (view.H / r.height),
    );
  }
}, { passive: false });

// ---------- Keyboard navigation ----------

// Digit keys map 1:1 to the HUD buttons in left-to-right order. Pressing
// the digit just clicks the underlying button so disabled-state, sounds,
// and modal opens all behave identically to a mouse click. Skipped when
// any modifier is held so we don't intercept browser shortcuts (Cmd+1 etc).
const HUD_KEYS = {
  '1': 'rainBtn',
  '2': 'dayBtn',
  '3': 'muteBtn',
  '4': 'photoBtn',
  '5': 'statsBtn',
  '6': 'achBtn',
  '7': 'shopBtn',
};

const MODAL_IDS = ['shopModal', 'achModal', 'statsModal', 'helpModal', 'firstRunOverlay'];

document.addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;

  // Escape closes whatever modal is open. We only target *our* modals so
  // the file-picker dialog (browser-level) isn't affected.
  if (e.key === 'Escape') {
    let closed = false;
    for (const id of MODAL_IDS) {
      const el = document.getElementById(id);
      if (el && el.classList.contains('show')) {
        el.classList.remove('show');
        closed = true;
      }
    }
    if (closed) e.preventDefault();
    return;
  }

  // HUD digit shortcuts only fire on the play screen — pressing 1 on the
  // picker would target a hidden button.
  if (view.gameScreen !== 'game') return;
  if (Object.prototype.hasOwnProperty.call(HUD_KEYS, e.key)) {
    const btn = document.getElementById(HUD_KEYS[e.key]);
    if (btn && !btn.disabled) {
      btn.click();
      e.preventDefault();
    }
  }
});
