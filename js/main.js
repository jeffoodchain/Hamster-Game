/*
 * main.js
 *
 * Entry point. Wires the modules together and runs the per-frame render loop.
 *
 * Boot sequence:
 *   1. Load the persisted save (so the picker shows the right coin count).
 *   2. Apply the saved hamster as the initial pick.
 *   3. Size the canvas (DPR-aware) — must happen before anything renders.
 *   4. Initialize HUD button handlers and shop click handlers.
 *   5. Start the requestAnimationFrame loop.
 *
 * The loop has two paths:
 *   - select screen: just redraw the picker; no game logic runs.
 *   - in-game:       tick() advances state, applyDayNight() updates the tint,
 *                    then draw() renders the world in back-to-front order.
 *
 * Imports order in this file is deliberately broad — the side effects of
 * `input.js` (registering canvas event listeners) and `hud.js` button hooks
 * happen at module evaluation time, so importing them once here is enough
 * for them to take effect.
 */

import { loadSave } from './save.js';
import { resize, ct } from './canvas.js';
import { view, save, ham, drag } from './state.js';
import { HAMS } from './config.js';

import { drawSelectScreen } from './selectscreen.js';
import { tick, hamPos } from './behavior.js';
import { applyDayNight, updateHud, initHudButtons } from './hud.js';
import { initShop } from './shop.js';
import { initAchievements } from './achievements.js';
import { initTooltips } from './tooltips.js';
import { tickAmbient, drawAmbient } from './ambient.js';
import { initFirstRun, autoDismissIfStale } from './firstrun.js';
import { updateMusic } from './music.js';
import { tickMinigame, drawMinigame } from './minigame.js';
import { tickVisitor, drawVisitor } from './visitor.js';
import { tickRoomba, drawRoomba } from './roomba.js';
import { initStats, tickPlayTime } from './stats.js';
import { initPhoto } from './photo.js';
import { initHelp } from './help.js';
import './input.js';            // event listeners registered as a side effect
import './background.js';       // resize-listener registered as a side effect

import { bgCv } from './canvas.js';
import {
  drawTunnel, drawWheel, drawTreatJar, drawSandBath, drawChewLog,
  drawPoops, drawShells, drawBottle, drawBasket, drawHut, drawBin,
  drawBall, drawSeed, drawLadder,
} from './items.js';
import { drawFront, drawSide, drawStatusBubble, drawIdleOverlay, drawExcitement } from './hamster.js';
import { updateDrawHearts, updateDrawSparkles, updateDrawCoinFlies } from './particles.js';

// ---------- Boot ----------

loadSave();
// `selected` is the canonical home for which hamster the player chose.
// Older saves might predate the field, so default to 0.
if (typeof save.selected !== 'number') save.selected = 0;

resize();
initHudButtons();
initShop();
initAchievements();
initStats();
initPhoto();
initHelp();
initTooltips();
initFirstRun();

// ---------- Per-frame render ----------

// In-game draw, called only when view.gameScreen === 'game'. Order is
// back-to-front so the hamster (and its drag preview) end up on top.
function draw() {
  ct.clearRect(0, 0, view.W, view.H);
  // The bgCv buffer is at devicePixelRatio resolution, so we explicitly
  // size the destination to W×H logical pixels — see canvas.js / background.js.
  ct.drawImage(bgCv, 0, 0, view.W, view.H);

  // Habitat — order chosen so things in front (basket, hut, bin, ball)
  // overlap things behind (wheel, jar, sand bath, chew log, tunnel, ladder).
  drawTunnel();
  drawLadder();
  drawWheel();
  drawTreatJar();
  drawSandBath();
  drawChewLog();
  drawPoops();
  drawShells();
  drawBottle();
  drawBasket();
  drawHut();
  drawBin();
  drawBall();

  // Ambient critters — drawn after items but before the hamster so the
  // hamster sprite occludes anything that drifts behind it.
  drawAmbient();

  // Visiting friend hamster (visitor.js handles its own state machine).
  // Drawn before the player so a player crossing paths with the visitor
  // appears in front, which reads as "the player's hamster is in focus".
  drawVisitor();

  // Cleaning bot — drawn before the hamster so the hamster passes in
  // front when their paths cross.
  drawRoomba();

  // Hamster — side view while running on the wheel, front view otherwise.
  // 'napping' is intentionally not drawn — the hamster is hidden inside the hut.
  const p = hamPos();
  const isHappy = ham.mode === 'happy';
  if (ham.mode === 'napping') {
    /* hidden inside hut */
  } else if (
    ham.mode === 'onwheel' || ham.mode === 'climbing' ||
    ham.mode === 'climbingLadder' || ham.mode === 'onLadder' ||
    ham.mode === 'slidingDown'
  ) {
    drawSide(p.x, p.y, ham.leg, ham.bob);
  } else {
    drawFront(
      p.x, p.y, ham.dir, ham.bob, ham.blink, ham.cheek,
      ham.mode === 'drinking',
      ham.mode === 'eating' || ham.mode === 'eattreat',
      isHappy,
      ham.mode === 'chewing',
    );
  }

  // Stat-aware thought bubble — drawn after the sprite so it's never occluded.
  drawStatusBubble(p.x, p.y, ham.mode, view.frame);

  // Idle-animation floaters (the 'z' for a yawn, etc.). drawIdleOverlay
  // returns immediately for non-yawn idles — they don't need a floater.
  if (ham.mode === 'idle') drawIdleOverlay(p.x, p.y, ham.idleType, ham.idleTimer);

  // Reactive "!" bubble when the hamster has just been fed.
  if (ham.excitedT > 0) drawExcitement(p.x, p.y, ham.excitedT);

  // Treat Rain — falling treats + score banner. Drawn last among gameplay
  // layers so the falling sprites overlay everything else (just like the
  // particles below).
  drawMinigame();

  updateDrawHearts();
  updateDrawSparkles();
  updateDrawCoinFlies();

  // Drag preview rides above everything so the user can clearly see what
  // they're holding.
  if (drag.active) {
    drawSeed(ct, drag.x, drag.y, drag.type, drag.angle, 1.3);
  }

  // Selected hamster's name in the bottom-left corner.
  ct.fillStyle = 'rgba(80,50,20,0.6)';
  ct.font = 'bold 13px sans-serif';
  ct.textAlign = 'left';
  const h = HAMS[save.selected];
  ct.fillText(`${h.name} (${h.roman})`, 20, view.H - 12);
}

function loop() {
  requestAnimationFrame(loop);

  if (view.gameScreen === 'select') {
    drawSelectScreen();
    return;
  }

  tick();
  tickAmbient();
  tickMinigame();
  tickVisitor();
  tickRoomba();
  tickPlayTime();
  applyDayNight();
  updateHud();
  // Music updates every 15 frames (4×/sec) — the dayTime crossfade and
  // chord rotation don't need finer resolution than that, and we'd rather
  // not flood the audio scheduler with redundant gain ramps.
  if (view.frame % 15 === 0) updateMusic();
  // Once a second is plenty for the first-run banner to notice that the
  // player has just done something interactive and dismiss itself.
  if (view.frame % 60 === 0) autoDismissIfStale();
  draw();
}

loop();
